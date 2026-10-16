import type { Ubicacion } from "../types/domain";
import { ubicacionSegura } from "../schemas/ubicacion.schema";

/**
 * Lo que cada app sabe hacer con el GPS: el teléfono con `expo-location`, la
 * web con la ubicación del navegador. Core decide cuándo pedirla, cuánto
 * esperar y qué hacer si falla, igual en todas las plataformas.
 */
export interface ProveedorUbicacion {
  /** Pide el permiso; puede mostrar el diálogo del sistema. Solo "mientras usas la app". */
  pedirPermiso(): Promise<boolean>;
  /** ¿Ya hay permiso? Sin mostrar nada. */
  tienePermiso(): Promise<boolean>;
  /** La posición actual. Puede tardar o fallar. */
  posicion(): Promise<{ latitud: number; longitud: number; precisionM?: number | null }>;
}

/** Donde la app guarda la preferencia: AsyncStorage en el teléfono, localStorage en la web. */
export interface AlmacenPreferencias {
  getItem(clave: string): Promise<string | null> | string | null;
  setItem(clave: string, valor: string): Promise<void> | void;
  removeItem(clave: string): Promise<void> | void;
}

export type MotivoSinUbicacion = "apagada" | "sin_permiso" | "tiempo_agotado" | "invalida" | "error";

export type ResultadoUbicacion = { ubicacion: Ubicacion; motivo?: undefined } | { ubicacion?: undefined; motivo: MotivoSinUbicacion };

/** El formulario nunca espera más que esto al GPS: después guarda el gasto sin ubicación. */
export const TIEMPO_MAXIMO_UBICACION_MS = 8_000;

/** Un mensaje para mostrar cuando el gasto se guardó sin ubicación (undefined = no avisar). */
export const MENSAJE_SIN_UBICACION: Record<MotivoSinUbicacion, string | undefined> = {
  apagada: undefined,
  sin_permiso: "El gasto se guardó sin ubicación: la app no tiene permiso. Puedes darlo en los ajustes del teléfono.",
  tiempo_agotado: "El gasto se guardó sin ubicación: el GPS tardó demasiado.",
  invalida: "El gasto se guardó sin ubicación: el GPS dio un dato imposible.",
  error: "El gasto se guardó sin ubicación: no se pudo leer el GPS.",
};

/**
 * La preferencia es por usuario, no por teléfono: si otra persona inicia
 * sesión en el mismo equipo, no hereda un consentimiento que no dio.
 */
export function clavePreferenciaUbicacion(usuarioId: string): string {
  return `fintrack.guardarUbicacion.${usuarioId}`;
}

/** Apagada por defecto; cualquier valor raro o un fallo del almacén cuenta como apagada. */
export async function leerPreferenciaUbicacion(almacen: AlmacenPreferencias, usuarioId: string): Promise<boolean> {
  try {
    return (await almacen.getItem(clavePreferenciaUbicacion(usuarioId))) === "si";
  } catch {
    return false;
  }
}

/**
 * Encender la preferencia pide el permiso en ese momento: solo queda
 * encendida si el usuario lo concede. Apagarla no necesita permiso.
 * Devuelve cómo quedó.
 */
export async function cambiarPreferenciaUbicacion(
  almacen: AlmacenPreferencias,
  proveedor: ProveedorUbicacion,
  usuarioId: string,
  activar: boolean
): Promise<{ activa: boolean; motivo?: "sin_permiso" }> {
  const clave = clavePreferenciaUbicacion(usuarioId);
  if (!activar) {
    await almacen.removeItem(clave);
    return { activa: false };
  }
  let concedido = false;
  try {
    concedido = await proveedor.pedirPermiso();
  } catch {
    concedido = false;
  }
  if (!concedido) {
    await almacen.removeItem(clave);
    return { activa: false, motivo: "sin_permiso" };
  }
  await almacen.setItem(clave, "si");
  return { activa: true };
}

// core compila sin tipos de DOM ni de Node (como fetchConTimeout).
const entorno = globalThis as any;

/** Promesa con tiempo máximo; al vencer devuelve `vencida` (la otra sigue sola y se ignora). */
async function conTiempoMaximo<T>(promesa: Promise<T>, ms: number): Promise<{ valor: T } | { vencida: true }> {
  let temporizador: unknown;
  const vencimiento = new Promise<{ vencida: true }>((resolver) => {
    temporizador = entorno.setTimeout(() => resolver({ vencida: true }), ms);
  });
  try {
    return await Promise.race([promesa.then((valor) => ({ valor })), vencimiento]);
  } finally {
    entorno.clearTimeout(temporizador);
  }
}

/**
 * La ubicación para un gasto que se está guardando. **Nunca lanza ni pide
 * permiso**: si la preferencia está apagada, no hay permiso, el GPS tarda más
 * de `tiempoMaximoMs` o da un dato imposible, responde sin ubicación y con el
 * motivo, y el gasto se guarda igual.
 */
export async function ubicacionParaGasto(
  almacen: AlmacenPreferencias,
  proveedor: ProveedorUbicacion,
  usuarioId: string,
  tiempoMaximoMs: number = TIEMPO_MAXIMO_UBICACION_MS
): Promise<ResultadoUbicacion> {
  if (!(await leerPreferenciaUbicacion(almacen, usuarioId))) return { motivo: "apagada" };
  try {
    if (!(await proveedor.tienePermiso())) return { motivo: "sin_permiso" };
    const r = await conTiempoMaximo(proveedor.posicion(), tiempoMaximoMs);
    if ("vencida" in r) return { motivo: "tiempo_agotado" };
    const ubicacion = ubicacionSegura({
      latitud: r.valor.latitud,
      longitud: r.valor.longitud,
      ...(r.valor.precisionM != null ? { precisionM: r.valor.precisionM } : {}),
    });
    return ubicacion ? { ubicacion } : { motivo: "invalida" };
  } catch {
    return { motivo: "error" };
  }
}

/**
 * Enlace para "Abrir en Mapas", sin clave de API. En Android `geo:` abre la
 * app de mapas que el usuario tenga; en iPhone, Apple Maps; en la web, Google
 * Maps. Solo lleva las coordenadas (redondeadas), nada más del gasto.
 */
export function enlaceMapa(
  u: Pick<Ubicacion, "latitud" | "longitud">,
  plataforma: "android" | "ios" | "web" = "web"
): string {
  const punto = `${Math.round(u.latitud * 10_000) / 10_000},${Math.round(u.longitud * 10_000) / 10_000}`;
  if (plataforma === "android") return `geo:${punto}?q=${punto}`;
  if (plataforma === "ios") return `https://maps.apple.com/?q=${punto}`;
  return `https://www.google.com/maps/search/?api=1&query=${punto}`;
}
