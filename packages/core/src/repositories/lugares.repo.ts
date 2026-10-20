import { getSupabaseClient } from "../client";
import { z } from "zod";
import type { Billetera, Lugar } from "../types/domain";
import type { Database } from "../types/database";
import { fechaIso } from "../schemas/limites";

type LugarRow = Database["public"]["Tables"]["lugares"]["Row"];

function filaALugar(row: LugarRow): Lugar {
  return {
    id: row.id,
    nombre: row.nombre,
    latitud: Number(row.latitud),
    longitud: Number(row.longitud),
    radioM: row.radio_m,
    direccion: row.direccion ?? undefined,
    createdAt: row.created_at,
  };
}

/** Guarda la dirección de un lugar propio (RLS impide tocar los ajenos). Sin la migración del correo no hace nada. */
export async function guardarDireccionLugar(id: string, direccion: string): Promise<void> {
  const limpia = z.string().trim().min(1).max(200).parse(direccion);
  const { error } = await getSupabaseClient().from("lugares").update({ direccion: limpia }).eq("id", id);
  if (error && error.code !== "PGRST204" && error.code !== "42703") throw error;
}

/**
 * Lugares del usuario, por nombre. Los crea la base al guardar gastos con
 * ubicación; RLS deja ver solo los propios.
 */
export async function listarLugares(): Promise<Lugar[]> {
  const { data, error } = await getSupabaseClient()
    .from("lugares")
    .select("*")
    .order("nombre")
    .order("id");
  if (error) throw error;
  return (data ?? []).map(filaALugar);
}

/** Qué quedó limpio tras borrar las ubicaciones. */
export interface UbicacionesBorradas {
  gastos: number;
  avisos: number;
  lugares: number;
}

/**
 * "Borrar todas mis ubicaciones" (derecho de eliminación de la LOPDP): quita
 * la ubicación y el lugar de todos los gastos, la ubicación de los avisos de
 * la bandeja y borra los lugares, en un solo paso de la base. Los gastos y
 * los saldos no cambian. Apagar la preferencia es aparte (la decide la app).
 */
export async function borrarMisUbicaciones(): Promise<UbicacionesBorradas> {
  const { data, error } = await getSupabaseClient().rpc("borrar_mis_ubicaciones");
  if (error) throw error;
  const r = (data ?? {}) as Partial<UbicacionesBorradas>;
  return { gastos: Number(r.gastos ?? 0), avisos: Number(r.avisos ?? 0), lugares: Number(r.lugares ?? 0) };
}

// ---------------------------------------------------------------------
// Resumen por lugar (Fase 5)
// ---------------------------------------------------------------------

/** Cuánto se pagó en un lugar dentro de un rango de fechas. */
export interface ResumenLugar {
  lugarId: string;
  nombre: string;
  latitud: number;
  longitud: number;
  pagos: number;
  total: number;
  promedio: number;
  /** Parte del total pagado en lugares durante el rango, en % (1 decimal). */
  porcentaje: number;
  primerPago: string;
  ultimoPago: string;
  /** La categoría más frecuente en ese lugar. */
  categoriaId?: string;
  /** La billetera más usada ahí; undefined si ningún pago fue con billetera. */
  billetera?: Billetera;
}

/** Lugares con el mismo nombre (sin mirar mayúsculas ni espacios), por ejemplo sucursales. */
export interface ResumenComercio {
  comercio: string;
  locales: number;
  pagos: number;
  total: number;
  promedio: number;
  ultimoPago: string;
  lugarIds: string[];
}

/** Igual que la base: hasta 2 años por consulta. */
export const DIAS_MAXIMOS_RESUMEN = 731;

/** Valida el rango antes de ir a la red, con los mismos mensajes que la base. */
export function validarRangoResumen(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = fechaIso().parse(desde);
  const h = fechaIso().parse(hasta);
  if (h < d) throw new Error("La fecha final es anterior a la inicial.");
  const dias = (Date.parse(`${h}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000;
  if (dias > DIAS_MAXIMOS_RESUMEN) throw new Error("El rango máximo es de 2 años.");
  return { desde: d, hasta: h };
}

/**
 * Los lugares donde se pagó entre `desde` y `hasta` (inclusive), del que más
 * suma al que menos. Los gastos sin lugar no cuentan.
 */
export async function resumenPorLugar(desde: string, hasta: string): Promise<ResumenLugar[]> {
  const rango = validarRangoResumen(desde, hasta);
  const { data, error } = await getSupabaseClient().rpc("resumen_por_lugar", { p_desde: rango.desde, p_hasta: rango.hasta });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    lugarId: r.lugar_id,
    nombre: r.nombre,
    latitud: Number(r.latitud),
    longitud: Number(r.longitud),
    pagos: Number(r.pagos),
    total: Number(r.total),
    promedio: Number(r.promedio),
    porcentaje: Number(r.porcentaje ?? 0),
    primerPago: r.primer_pago,
    ultimoPago: r.ultimo_pago,
    categoriaId: r.categoria_id ?? undefined,
    billetera: (r.billetera as Billetera | null) ?? undefined,
  }));
}

/**
 * Como `resumenPorLugar`, pero junta los lugares que se llaman igual. Para
 * juntar dos sucursales basta con ponerles el mismo nombre (`renombrarLugar`):
 * cada una conserva su ubicación.
 */
export async function resumenPorComercio(desde: string, hasta: string): Promise<ResumenComercio[]> {
  const rango = validarRangoResumen(desde, hasta);
  const { data, error } = await getSupabaseClient().rpc("resumen_por_comercio", { p_desde: rango.desde, p_hasta: rango.hasta });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    comercio: r.comercio,
    locales: Number(r.locales),
    pagos: Number(r.pagos),
    total: Number(r.total),
    promedio: Number(r.promedio),
    ultimoPago: r.ultimo_pago,
    lugarIds: r.lugar_ids ?? [],
  }));
}

const nombreLugarSchema = z.string().trim().min(1, "Ponle un nombre al lugar.").max(80, "Máximo 80 caracteres.");

/** Cambia el nombre de un lugar propio (RLS impide tocar los ajenos). */
export async function renombrarLugar(id: string, nombre: string): Promise<Lugar> {
  const limpio = nombreLugarSchema.parse(nombre);
  const { data, error } = await getSupabaseClient().from("lugares").update({ nombre: limpio }).eq("id", id).select().single();
  if (error) throw error;
  return filaALugar(data);
}

/** Borra un lugar: sus gastos se quedan, sin lugar (y sin salir del historial). */
export async function eliminarLugar(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("lugares").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Pasa todos los pagos de `origenId` a `destinoId` y borra `origenId`, en un
 * solo paso de la base. Devuelve cuántos pagos se movieron. Los dos tienen
 * que ser del usuario.
 */
export async function fusionarLugares(origenId: string, destinoId: string): Promise<number> {
  const ids = z.string().uuid();
  ids.parse(origenId);
  ids.parse(destinoId);
  if (origenId === destinoId) throw new Error("Elige dos lugares distintos.");
  const { data, error } = await getSupabaseClient().rpc("fusionar_lugares", { p_origen: origenId, p_destino: destinoId });
  if (error) throw error;
  return Number(data ?? 0);
}
