import type { Ubicacion } from "../types/domain";

type Columnas = {
  latitud?: number | string | null;
  longitud?: number | string | null;
  precision_m?: number | null;
};

/**
 * Columnas de la base → `Ubicacion`. Postgres devuelve numeric como texto en
 * algunos clientes, y una base sin la migración de billeteras no trae las
 * columnas: en ambos casos se responde algo coherente.
 */
export function ubicacionDeFila(fila: Columnas): Ubicacion | undefined {
  if (fila.latitud == null || fila.longitud == null) return undefined;
  const latitud = Number(fila.latitud);
  const longitud = Number(fila.longitud);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return undefined;
  return {
    latitud,
    longitud,
    ...(fila.precision_m != null ? { precisionM: Number(fila.precision_m) } : {}),
  };
}

/** `Ubicacion` → columnas; `null` las vacía todas (quitar la ubicación). */
export function filaDeUbicacion(u: Ubicacion | null): { latitud: number | null; longitud: number | null; precision_m: number | null } {
  return {
    latitud: u ? u.latitud : null,
    longitud: u ? u.longitud : null,
    precision_m: u?.precisionM ?? null,
  };
}
