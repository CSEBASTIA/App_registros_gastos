// Ubicación de los pagos en la web, con la ubicación del navegador. Las
// reglas —apagada por defecto, preferencia por usuario, tiempo máximo, nunca
// lanzar— están en core (`ubicacionDispositivo`); aquí solo se conecta el
// navegador. Solo funciona con HTTPS o en localhost (lo exige el navegador).
import {
  cambiarPreferenciaUbicacion,
  enlaceMapa,
  getSupabaseClient,
  leerPreferenciaUbicacion,
  ubicacionParaGasto,
  type AlmacenPreferencias,
  type ProveedorUbicacion,
  type ResultadoUbicacion,
  type Ubicacion,
} from "core";

const almacen: AlmacenPreferencias = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
  removeItem: (k) => window.localStorage.removeItem(k),
};

function posicionDelNavegador(): Promise<GeolocationPosition> {
  return new Promise((resolver, rechazar) => {
    if (!("geolocation" in navigator)) return rechazar(new Error("Este navegador no da la ubicación."));
    navigator.geolocation.getCurrentPosition(resolver, rechazar, {
      enableHighAccuracy: false,
      timeout: 8_000,
      maximumAge: 120_000,
    });
  });
}

async function estadoPermiso(): Promise<PermissionState | undefined> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return undefined; // navegador sin API de permisos
  }
}

const proveedor: ProveedorUbicacion = {
  // En la web no hay "pedir permiso" aparte: el navegador lo pregunta al pedir la posición.
  async pedirPermiso() {
    try {
      await posicionDelNavegador();
      return true;
    } catch (e) {
      if ((e as GeolocationPositionError)?.code === 1) return false; // PERMISSION_DENIED
      return (await estadoPermiso()) === "granted";
    }
  },
  async tienePermiso() {
    const estado = await estadoPermiso();
    // Sin API de permisos no se puede saber sin preguntar: se intenta (ya lo concedió al activar).
    return estado === undefined ? true : estado === "granted";
  },
  async posicion() {
    const p = await posicionDelNavegador();
    return { latitud: p.coords.latitude, longitud: p.coords.longitude, precisionM: p.coords.accuracy };
  },
};

async function usuarioActual(): Promise<string | undefined> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id;
}

/** ¿El usuario con sesión activó "Guardar la ubicación de mis pagos"? */
export async function guardarUbicacionActiva(): Promise<boolean> {
  const id = await usuarioActual();
  return id ? leerPreferenciaUbicacion(almacen, id) : false;
}

/** Encender pide el permiso en ese momento; si se niega, queda apagada y vuelve `motivo: "sin_permiso"`. */
export async function cambiarGuardarUbicacion(activar: boolean): Promise<{ activa: boolean; motivo?: "sin_permiso" }> {
  const id = await usuarioActual();
  if (!id) return { activa: false };
  return cambiarPreferenciaUbicacion(almacen, proveedor, id, activar);
}

/** La ubicación para el gasto que se está guardando: nunca lanza, espera como mucho 8 s. */
export async function ubicacionParaNuevoGasto(): Promise<ResultadoUbicacion> {
  const id = await usuarioActual();
  if (!id) return { motivo: "apagada" };
  return ubicacionParaGasto(almacen, proveedor, id);
}

/** Enlace para "Abrir en Mapas" (Google Maps, sin clave de API). */
export function enlaceMapaWeb(u: Pick<Ubicacion, "latitud" | "longitud">): string {
  return enlaceMapa(u, "web");
}
