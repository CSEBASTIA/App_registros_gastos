import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  avisosDeCorreos,
  desdeParaSincronizar,
  eliminarTransaccionesDetectadas,
  getSupabaseClient,
  insertarTransaccionesDetectadas,
  listarCuentas,
  type CorreosTraidos,
  type ResultadoSincronizacion,
} from "core";
import * as outlook from "./outlookAuth";
import * as gmail from "./gmailAuth";
import { traerCorreosNuevos as traerDeOutlook } from "./graphMail";
import { traerCorreosNuevos as traerDeGmail } from "./gmailApi";

/** Marca de la última búsqueda completa (ISO). Se borra al desconectar o cerrar sesión. */
export const CLAVE_ULTIMA_SYNC = "correo_ultima_sync";

export type ProveedorCorreo = "gmail" | "outlook";

export const ETIQUETA_PROVEEDOR: Record<ProveedorCorreo, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

const CLAVE_PROVEEDOR_ACTIVO = "correo_proveedor_activo";
/** Id de la persona que conectó el correo en este teléfono. */
const CLAVE_DUENO = "correo_dueno";

async function obtenerSeguro(clave: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}
async function guardarSeguro(clave: string, valor: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(clave, valor);
  } catch {
    /* no-op */
  }
}
async function borrarSeguro(clave: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(clave);
  } catch {
    /* no-op */
  }
}

function moduloDe(proveedor: ProveedorCorreo) {
  return proveedor === "gmail" ? gmail : outlook;
}

export function proveedorConfigurado(proveedor: ProveedorCorreo): boolean {
  return moduloDe(proveedor).correoConfigurado();
}

export function algunProveedorConfigurado(): boolean {
  return gmail.correoConfigurado() || outlook.correoConfigurado();
}

/** Id de la persona con sesión iniciada (lee la sesión local, sin red). */
async function usuarioActual(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/** Cuál proveedor está conectado ahora mismo (solo puede haber uno activo por vez), o null si ninguno. */
export async function proveedorConectado(): Promise<ProveedorCorreo | null> {
  const guardado = (await obtenerSeguro(CLAVE_PROVEEDOR_ACTIVO)) as ProveedorCorreo | null;
  if (!guardado) return null;

  // Segunda barrera (la primera es olvidar el correo al cerrar sesión): la
  // conexión pertenece a quien la hizo. Si hay otra persona, se olvida.
  const dueno = await obtenerSeguro(CLAVE_DUENO);
  const usuario = await usuarioActual();
  if (dueno && dueno !== usuario) {
    await olvidarCorreoDelDispositivo();
    return null;
  }
  if (!dueno && usuario) await guardarSeguro(CLAVE_DUENO, usuario); // conexiones de antes de esta barrera

  const sigueConectado = await moduloDe(guardado).hayCorreoConectado();
  return sigueConectado ? guardado : null;
}

export async function conectarProveedor(proveedor: ProveedorCorreo): Promise<void> {
  const usuario = await usuarioActual();
  if (!usuario) throw new Error("Inicia sesión para conectar tu correo.");

  // Solo un proveedor conectado a la vez: si había otro, se desconecta primero.
  const actual = await proveedorConectado();
  if (actual && actual !== proveedor) await moduloDe(actual).desconectarCorreo();

  await moduloDe(proveedor).conectarCorreo();
  await guardarSeguro(CLAVE_PROVEEDOR_ACTIVO, proveedor);
  await guardarSeguro(CLAVE_DUENO, usuario);
}

/** Desconecta el proveedor activo. `revocado` indica si el permiso se quitó también en el servidor del proveedor. */
export async function desconectarProveedorActivo(): Promise<{
  proveedor: ProveedorCorreo | null;
  revocado: boolean;
}> {
  const actual = await proveedorConectado();
  const { revocado } = actual ? await moduloDe(actual).desconectarCorreo() : { revocado: false };
  await borrarSeguro(CLAVE_PROVEEDOR_ACTIVO);
  await borrarSeguro(CLAVE_DUENO);
  return { proveedor: actual, revocado };
}

/** Trae correos nuevos del proveedor conectado, sea cual sea. */
export async function traerCorreosDelProveedorActivo(desde: Date): Promise<CorreosTraidos> {
  const proveedor = await proveedorConectado();
  if (!proveedor) throw new Error("El correo no está conectado.");
  return proveedor === "gmail" ? traerDeGmail(desde) : traerDeOutlook(desde);
}

/**
 * Busca avisos bancarios nuevos y los deja en la Bandeja. La marca guardada
 * es la hora en que EMPEZÓ la búsqueda (antes era la hora en que terminó: los
 * correos que llegaban mientras tanto se saltaban para siempre), y solo se
 * avanza si se pudieron leer todos los correos.
 */
export async function sincronizarCorreo(): Promise<ResultadoSincronizacion & { marca: string | null }> {
  const inicio = new Date();
  const desde = desdeParaSincronizar(await AsyncStorage.getItem(CLAVE_ULTIMA_SYNC), inicio);

  const { correos, truncado, fallidos } = await traerCorreosDelProveedorActivo(desde);
  const avisos = avisosDeCorreos(correos, await listarCuentas());
  const { enviados, descartados } = await insertarTransaccionesDetectadas(avisos);

  let marca: string | null = null;
  if (fallidos === 0) {
    marca = inicio.toISOString();
    await AsyncStorage.setItem(CLAVE_ULTIMA_SYNC, marca);
  }
  return { revisados: correos.length, enviados, descartados, truncado, fallidos, marca };
}

/**
 * Desconecta el correo y borra lo que la app guardó de él. Primero se borran
 * los datos: si eso falla (sin internet), el correo sigue conectado y la
 * persona puede reintentar; al revés, quedaban datos sin forma de borrarlos
 * desde esta pantalla. Los gastos ya confirmados se quedan.
 */
export async function desconectarYBorrarCorreo(): Promise<{
  proveedor: ProveedorCorreo | null;
  revocado: boolean;
  borrados: number;
}> {
  const borrados = await eliminarTransaccionesDetectadas();
  await AsyncStorage.removeItem(CLAVE_ULTIMA_SYNC);
  const { proveedor, revocado } = await desconectarProveedorActivo();
  return { proveedor, revocado, borrados };
}

/**
 * Al cerrar sesión: el permiso de correo es del teléfono, no de la cuenta. Sin
 * esto, quien iniciara sesión después en el mismo teléfono seguía leyendo el
 * correo de la persona anterior y guardando sus movimientos en su propia
 * cuenta. Borra los tokens de ambos proveedores (y revoca el de Google) y la
 * marca de búsqueda. Nunca lanza: cerrar sesión no debe fallar por esto.
 */
export async function olvidarCorreoDelDispositivo(): Promise<void> {
  await borrarSeguro(CLAVE_PROVEEDOR_ACTIVO);
  await borrarSeguro(CLAVE_DUENO);
  await AsyncStorage.removeItem(CLAVE_ULTIMA_SYNC).catch(() => {});
  await Promise.allSettled([gmail.desconectarCorreo(), outlook.desconectarCorreo()]);
}
