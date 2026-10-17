import { getSupabaseClient } from "../client";
import type { Ingreso } from "../types/domain";
import type { Database } from "../types/database";
import { cambiosIngresoSchema, type CambiosIngreso } from "../schemas/ingreso.schema";
import { traerTodasLasFilas, validarRango, type RangoFechas } from "../lib/paginacion";

type IngresoRow = Database["public"]["Tables"]["ingresos"]["Row"];

function filaAIngreso(row: IngresoRow): Ingreso {
  return {
    id: row.id,
    monto: Number(row.monto),
    descripcion: row.descripcion,
    categoriaId: row.categoria_id ?? undefined,
    categoriaDetalle: row.categoria_detalle ?? undefined,
    cuentaId: row.cuenta_id ?? undefined,
    fecha: row.fecha,
    createdAt: row.created_at,
  };
}

/** Igual que `listarGastos`: todas las páginas y, opcionalmente, solo un periodo. */
export async function listarIngresos(rango: RangoFechas = {}): Promise<Ingreso[]> {
  const { desde, hasta } = validarRango(rango);
  const filas = await traerTodasLasFilas<IngresoRow>((inicio, fin) => {
    let consulta = getSupabaseClient().from("ingresos").select("*");
    if (desde) consulta = consulta.gte("fecha", desde);
    if (hasta) consulta = consulta.lte("fecha", hasta);
    return consulta
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(inicio, fin);
  });
  return filas.map(filaAIngreso);
}

/** Últimos ingresos sin descargar el historial completo para el resumen. */
export async function listarIngresosRecientes(limite = 8): Promise<Ingreso[]> {
  const { data, error } = await getSupabaseClient()
    .from("ingresos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map(filaAIngreso);
}

export async function crearIngreso(
  ingreso: Omit<Ingreso, "id" | "createdAt">
): Promise<Ingreso> {
  const { data, error } = await getSupabaseClient()
    .from("ingresos")
    .insert(filaNuevaIngreso(ingreso))
    .select()
    .single();

  if (error) throw error;
  return filaAIngreso(data);
}

function filaNuevaIngreso(ingreso: Omit<Ingreso, "id" | "createdAt">) {
  return {
    monto: ingreso.monto,
    descripcion: ingreso.descripcion,
    categoria_id: ingreso.categoriaId ?? null,
    categoria_detalle: ingreso.categoriaDetalle ?? null,
    cuenta_id: ingreso.cuentaId ?? null,
    fecha: ingreso.fecha,
  };
}

/** Igual que `crearGastosEnLote`: una sola escritura, se guardan todos o ninguno. */
export async function crearIngresosEnLote(ingresos: Omit<Ingreso, "id" | "createdAt">[]): Promise<Ingreso[]> {
  if (ingresos.length === 0) return [];
  const { data, error } = await getSupabaseClient().from("ingresos").insert(ingresos.map(filaNuevaIngreso)).select();
  if (error) throw error;
  return (data ?? []).map(filaAIngreso);
}

/**
 * Edita un ingreso. Valida los cambios y envía solo los campos presentes;
 * si cambian el monto o la cuenta, la base reajusta los saldos sola.
 */
export async function actualizarIngreso(id: string, cambios: CambiosIngreso): Promise<Ingreso> {
  const c = cambiosIngresoSchema.parse(cambios);
  const { data, error } = await getSupabaseClient()
    .from("ingresos")
    .update({
      ...(c.monto !== undefined ? { monto: c.monto } : {}),
      ...(c.descripcion !== undefined ? { descripcion: c.descripcion } : {}),
      ...(c.categoriaId !== undefined ? { categoria_id: c.categoriaId } : {}),
      ...(c.categoriaDetalle !== undefined ? { categoria_detalle: c.categoriaDetalle } : {}),
      ...(c.cuentaId !== undefined ? { cuenta_id: c.cuentaId } : {}),
      ...(c.fecha !== undefined ? { fecha: c.fecha } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return filaAIngreso(data);
}

/** Un ingreso por id (para la pantalla de edición). Con RLS, solo los propios. */
export async function obtenerIngreso(id: string): Promise<Ingreso> {
  const { data, error } = await getSupabaseClient().from("ingresos").select("*").eq("id", id).single();
  if (error) throw error;
  return filaAIngreso(data);
}

export async function eliminarIngreso(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("ingresos").delete().eq("id", id);
  if (error) throw error;
}
