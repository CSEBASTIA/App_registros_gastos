import { getSupabaseClient } from "../client";
import { z } from "zod";
import type { Billetera, Gasto, Ubicacion } from "../types/domain";
import type { Database } from "../types/database";
import { cambiosGastoSchema } from "../schemas/gasto.schema";
import { billeteraCompatible } from "../schemas/ubicacion.schema";
import { traerTodasLasFilas, validarRango, type RangoFechas } from "../lib/paginacion";
import { filaDeUbicacion, ubicacionDeFila } from "../lib/ubicacion";

type GastoRow = Database["public"]["Tables"]["gastos"]["Row"];

/** La tabla usa snake_case (categoria_id, created_at); el dominio usa camelCase. */
function filaAGasto(row: GastoRow): Gasto {
  return {
    id: row.id,
    monto: Number(row.monto),
    descripcion: row.descripcion,
    categoriaId: row.categoria_id ?? "",
    categoriaDetalle: row.categoria_detalle ?? undefined,
    cuentaId: row.cuenta_id ?? undefined,
    metodoPago: (row.metodo_pago as Gasto["metodoPago"]) ?? undefined,
    mesesDiferido: row.meses_diferido ?? undefined,
    tasaInteres: row.tasa_interes !== null ? Number(row.tasa_interes) : undefined,
    facturaPath: row.factura_path ?? undefined,
    billetera: (row.billetera as Gasto["billetera"]) ?? undefined,
    ubicacion: ubicacionDeFila(row),
    lugarId: row.lugar_id ?? undefined,
    fecha: row.fecha,
    // Sin la migración de hora del pago la columna no existe.
    pagadoEn: row.pagado_en ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Gastos más recientes primero. Trae todas las páginas (sin el tope de 1.000
 * filas de Supabase). Con `rango`, solo ese periodo: descarga mucho menos.
 */
export async function listarGastos(rango: RangoFechas = {}): Promise<Gasto[]> {
  return listarGastosFiltrados(rango);
}

/** Últimos movimientos sin descargar el historial completo para el resumen. */
export async function listarGastosRecientes(limite = 8): Promise<Gasto[]> {
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map(filaAGasto);
}

/** Los pagos de un lugar (detalle del resumen por lugar), los más recientes primero. */
export async function listarGastosDeLugar(lugarId: string, rango: RangoFechas = {}): Promise<Gasto[]> {
  return listarGastosFiltrados(rango, z.string().uuid("Lugar no válido.").parse(lugarId));
}

async function listarGastosFiltrados(rango: RangoFechas, lugarId?: string): Promise<Gasto[]> {
  const { desde, hasta } = validarRango(rango);
  const filas = await traerTodasLasFilas<GastoRow>((inicio, fin) => {
    let consulta = getSupabaseClient().from("gastos").select("*");
    if (lugarId) consulta = consulta.eq("lugar_id", lugarId);
    if (desde) consulta = consulta.gte("fecha", desde);
    if (hasta) consulta = consulta.lte("fecha", hasta);
    return consulta
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(inicio, fin);
  });
  return filas.map(filaAGasto);
}

export async function crearGasto(
  gasto: Omit<Gasto, "id" | "createdAt">
): Promise<Gasto> {
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .insert({
      monto: gasto.monto,
      descripcion: gasto.descripcion,
      categoria_id: gasto.categoriaId,
      categoria_detalle: gasto.categoriaDetalle ?? null,
      cuenta_id: gasto.cuentaId ?? null,
      metodo_pago: gasto.metodoPago ?? null,
      meses_diferido: gasto.mesesDiferido ?? null,
      // Solo si se indicó: así crear gastos funciona también en una base sin
      // la migración 20261015170000 (que agrega la columna).
      ...(gasto.tasaInteres !== undefined ? { tasa_interes: gasto.tasaInteres } : {}),
      // Igual con la migración de billeteras y ubicación (20261016120000).
      ...(gasto.billetera !== undefined ? { billetera: gasto.billetera } : {}),
      ...(gasto.ubicacion !== undefined ? filaDeUbicacion(gasto.ubicacion) : {}),
      ...(gasto.lugarId !== undefined ? { lugar_id: gasto.lugarId } : {}),
      factura_path: gasto.facturaPath ?? null,
      fecha: gasto.fecha,
    })
    .select()
    .single();

  if (error) throw error;
  return filaAGasto(data);
}

export type CambiosGasto = Partial<
  Pick<Gasto, "monto" | "descripcion" | "categoriaId" | "categoriaDetalle" | "cuentaId" | "metodoPago" | "fecha">
> & {
  /** `""` quita la billetera. */
  billetera?: Billetera | "";
  /** `null` quita la ubicación y el lugar; un valor nuevo recalcula el lugar. */
  ubicacion?: Ubicacion | null;
  /** Elegir el lugar a mano; `""` lo quita. */
  lugarId?: string;
};

/** Valida solo lo que se envía: antes la edición llegaba a la base sin pasar por zod. */
export async function actualizarGasto(id: string, cambiosSinValidar: CambiosGasto): Promise<Gasto> {
  const cambios = cambiosGastoSchema.parse(cambiosSinValidar);
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .update({
      ...(cambios.monto !== undefined ? { monto: cambios.monto } : {}),
      ...(cambios.descripcion !== undefined ? { descripcion: cambios.descripcion } : {}),
      ...(cambios.categoriaId !== undefined ? { categoria_id: cambios.categoriaId } : {}),
      ...(cambios.categoriaDetalle !== undefined ? { categoria_detalle: cambios.categoriaDetalle || null } : {}),
      ...(cambios.cuentaId !== undefined ? { cuenta_id: cambios.cuentaId || null } : {}),
      ...(cambios.metodoPago !== undefined ? { metodo_pago: cambios.metodoPago || null } : {}),
      ...(cambios.billetera !== undefined ? { billetera: cambios.billetera || null } : {}),
      // Pasar a efectivo o transferencia quita la billetera, en vez de chocar con la base.
      ...(cambios.billetera === undefined && cambios.metodoPago !== undefined && !billeteraCompatible(cambios.metodoPago)
        ? { billetera: null }
        : {}),
      ...(cambios.ubicacion !== undefined ? filaDeUbicacion(cambios.ubicacion) : {}),
      ...(cambios.lugarId !== undefined ? { lugar_id: cambios.lugarId || null } : {}),
      ...(cambios.fecha !== undefined ? { fecha: cambios.fecha } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return filaAGasto(data);
}

/** Un gasto por id (para la pantalla de edición). Con RLS, solo los propios. */
export async function obtenerGasto(id: string): Promise<Gasto> {
  const { data, error } = await getSupabaseClient().from("gastos").select("*").eq("id", id).single();
  if (error) throw error;
  return filaAGasto(data);
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("gastos").delete().eq("id", id);
  if (error) throw error;
}
