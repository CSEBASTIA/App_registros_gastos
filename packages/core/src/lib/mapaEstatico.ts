import type { Ubicacion } from "../types/domain";

/**
 * Un mapa pequeño alrededor de un punto, hecho con 3×3 teselas de
 * OpenStreetMap (imágenes de 256 px). No necesita librerías nativas: sirve
 * en el teléfono y en la web con un simple <Image>.
 *
 * Privacidad: al pedir las teselas, el servidor de mapas ve la zona
 * aproximada (unos 600 m a zoom 16) y la IP. Por eso el mapa solo se carga
 * cuando el usuario abre el detalle de una transacción con ubicación.
 */
export const TAMANO_TESELA = 256;
export const ZOOM_MAPA = 16;
export const PLANTILLA_TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Obligatoria al mostrar teselas de OpenStreetMap, con enlace a su página de derechos. */
export const ATRIBUCION_MAPA = "© OpenStreetMap contributors";
export const URL_ATRIBUCION_MAPA = "https://www.openstreetmap.org/copyright";

const LATITUD_MAXIMA = 85.05112878; // límite de la proyección de los mapas web

export interface Tesela {
  url: string;
  /** 0, 1 o 2 dentro de la cuadrícula de 3×3. */
  columna: number;
  fila: number;
}

export interface MapaEstatico {
  teselas: Tesela[];
  /** Dónde cae el punto dentro de la cuadrícula de 768×768 px. */
  puntoX: number;
  puntoY: number;
  /** Radio del círculo de precisión del GPS, en píxeles (si se conoce). */
  radioPrecisionPx?: number;
}

/** Posición del punto en unidades de tesela (proyección de los mapas web). */
export function posicionEnTeselas(latitud: number, longitud: number, zoom = ZOOM_MAPA): { x: number; y: number } {
  const n = 2 ** zoom;
  const lat = Math.max(-LATITUD_MAXIMA, Math.min(LATITUD_MAXIMA, latitud));
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((longitud + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/** Metros que mide un píxel a esa latitud y zoom. */
export function metrosPorPixel(latitud: number, zoom = ZOOM_MAPA): number {
  return (156543.03392 * Math.cos((latitud * Math.PI) / 180)) / 2 ** zoom;
}

export function mapaEstatico(
  u: Pick<Ubicacion, "latitud" | "longitud" | "precisionM">,
  opciones: { zoom?: number; plantilla?: string } = {},
): MapaEstatico {
  const zoom = opciones.zoom ?? ZOOM_MAPA;
  const plantilla = opciones.plantilla ?? PLANTILLA_TESELAS;
  const n = 2 ** zoom;
  const { x, y } = posicionEnTeselas(u.latitud, u.longitud, zoom);
  const primeraX = Math.floor(x) - 1;
  const primeraY = Math.floor(y) - 1;

  const teselas: Tesela[] = [];
  for (let fila = 0; fila < 3; fila++) {
    const ty = primeraY + fila;
    if (ty < 0 || ty >= n) continue; // fuera del mundo (cerca de los polos)
    for (let columna = 0; columna < 3; columna++) {
      // La longitud da la vuelta: a la derecha de 180° sigue -180°.
      const tx = (((primeraX + columna) % n) + n) % n;
      const url = plantilla.replace("{z}", String(zoom)).replace("{x}", String(tx)).replace("{y}", String(ty));
      teselas.push({ url, columna, fila });
    }
  }

  return {
    teselas,
    puntoX: (x - primeraX) * TAMANO_TESELA,
    puntoY: (y - primeraY) * TAMANO_TESELA,
    radioPrecisionPx:
      u.precisionM !== undefined ? Math.round(u.precisionM / metrosPorPixel(u.latitud, zoom)) : undefined,
  };
}
