/**
 * Ninguna llamada de red de la app tenía límite de tiempo: con mala señal
 * una pantalla podía quedarse "Cargando…" para siempre. Este envoltorio de
 * `fetch` corta la petición a los `ms` milisegundos y lanza un error claro.
 * Se le pasa a Supabase (`global.fetch`) y a las llamadas a Gmail/Graph.
 */

// Tipos mínimos: core compila sin la lib DOM, y cada app (web / React
// Native) trae su propio `fetch`, `AbortController` y temporizadores.
type FetchLike = (input: any, init?: any) => Promise<any>;
interface SenalAbort {
  aborted: boolean;
  addEventListener(tipo: "abort", fn: () => void, opciones?: { once?: boolean }): void;
}
const entorno = globalThis as any;

export class ErrorTiempoAgotado extends Error {
  constructor(segundos: number) {
    super(`La conexión tardó más de ${segundos} s. Revisa tu internet e inténtalo de nuevo.`);
    this.name = "ErrorTiempoAgotado";
  }
}

export interface OpcionesTimeout {
  /** Límite para peticiones normales. Por defecto 15 s. */
  ms?: number;
  /** Límite para subir archivos a Storage (facturas). Por defecto 60 s. */
  msSubidas?: number;
  /** fetch a envolver; por defecto el global. */
  fetchBase?: FetchLike;
}

function urlDe(input: any): string {
  if (typeof input === "string") return input;
  if (input && typeof input.href === "string") return input.href; // URL
  if (input && typeof input.url === "string") return input.url; // Request
  return "";
}

export function crearFetchConTimeout(opciones: OpcionesTimeout = {}): FetchLike {
  const ms = opciones.ms ?? 15_000;
  const msSubidas = opciones.msSubidas ?? 60_000;

  return async (input, init = {}) => {
    const fetchBase: FetchLike = opciones.fetchBase ?? entorno.fetch;
    const metodo = String(init.method ?? "GET").toUpperCase();
    const esSubida = metodo !== "GET" && urlDe(input).includes("/storage/v1/object");
    const limite = esSubida ? msSubidas : ms;

    const controlador = new entorno.AbortController();
    // Respeta la cancelación que pida quien llama (ej. supabase-js).
    const externa = init.signal as SenalAbort | undefined;
    if (externa) {
      if (externa.aborted) controlador.abort();
      else externa.addEventListener("abort", () => controlador.abort(), { once: true });
    }

    let agotado = false;
    const temporizador = entorno.setTimeout(() => {
      agotado = true;
      controlador.abort();
    }, limite);

    try {
      return await fetchBase(input, { ...init, signal: controlador.signal });
    } catch (err) {
      if (agotado) throw new ErrorTiempoAgotado(Math.round(limite / 1000));
      throw err;
    } finally {
      entorno.clearTimeout(temporizador);
    }
  };
}
