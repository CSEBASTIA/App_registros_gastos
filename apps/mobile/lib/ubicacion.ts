// Ubicación de los pagos en el teléfono (y en la versión web, donde
// expo-location usa la ubicación del navegador). Las reglas —apagada por
// defecto, preferencia por usuario, tiempo máximo, nunca lanzar— están en
// core (`ubicacionDispositivo`); aquí solo se conecta el GPS y el almacén.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import {
  cambiarPreferenciaUbicacion,
  enlaceMapa,
  leerPreferenciaUbicacion,
  ubicacionAnticipada,
  ubicacionParaGasto,
  type ProveedorUbicacion,
  type ResultadoUbicacion,
  type Ubicacion,
} from "core";
import { supabase } from "./supabase";

const proveedor: ProveedorUbicacion = {
  // Solo "mientras usas la app": el permiso en segundo plano está bloqueado en app.json.
  async pedirPermiso() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  },
  async tienePermiso() {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  },
  async posicion() {
    // Una posición de hace menos de 2 minutos y con menos de 200 m de margen
    // sirve y es instantánea. (En la web no existe: se pide la actual.)
    const reciente =
      Platform.OS === "web" ? null : await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
    const p = reciente ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { latitud: p.coords.latitude, longitud: p.coords.longitude, precisionM: p.coords.accuracy };
  },
};

async function usuarioActual(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

/** ¿El usuario con sesión activó "Guardar la ubicación de mis pagos"? */
export async function guardarUbicacionActiva(): Promise<boolean> {
  const id = await usuarioActual();
  return id ? leerPreferenciaUbicacion(AsyncStorage, id) : false;
}

/** Encender pide el permiso en ese momento; si se niega, queda apagada y vuelve `motivo: "sin_permiso"`. */
export async function cambiarGuardarUbicacion(activar: boolean): Promise<{ activa: boolean; motivo?: "sin_permiso" }> {
  const id = await usuarioActual();
  if (!id) return { activa: false };
  return cambiarPreferenciaUbicacion(AsyncStorage, proveedor, id, activar);
}

/**
 * La ubicación para el gasto que se está guardando. Nunca lanza ni pide
 * permiso, y espera como mucho 8 s: si no hay, el gasto se guarda sin ella
 * (`MENSAJE_SIN_UBICACION[motivo]` dice qué mostrar, o nada).
 */
export async function ubicacionParaNuevoGasto(): Promise<ResultadoUbicacion> {
  const id = await usuarioActual();
  if (!id) return { motivo: "apagada" };
  return ubicacionParaGasto(AsyncStorage, proveedor, id);
}

/**
 * Empieza a buscar la ubicación al abrir el formulario de un gasto: al
 * guardar ya está, y es la de donde anotas el pago (no la de varios segundos
 * después). Solo si la persona activó la preferencia: si no, no toca el GPS.
 */
export function anticiparUbicacionDeGasto(): { obtener(): Promise<ResultadoUbicacion> } {
  return ubicacionAnticipada(ubicacionParaNuevoGasto);
}

/** Abre el punto en la app de mapas del teléfono (Android: la que elija el usuario; iPhone: Apple Maps). */
export function abrirEnMapas(u: Pick<Ubicacion, "latitud" | "longitud">): Promise<void> {
  const plataforma = Platform.OS === "android" ? "android" : Platform.OS === "ios" ? "ios" : "web";
  return Linking.openURL(enlaceMapa(u, plataforma));
}
