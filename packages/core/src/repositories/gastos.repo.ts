import { getSupabaseClient } from "../client";
import type { Gasto } from "../types/domain";
import type { Database } from "../types/database";

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
    facturaPath: row.factura_path ?? undefined,
    fecha: row.fecha,
    createdAt: row.created_at,
  };
}

export async function listarGastos(): Promise<Gasto[]> {
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(filaAGasto);
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
>;

export async function actualizarGasto(id: string, cambios: CambiosGasto): Promise<Gasto> {
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .update({
      ...(cambios.monto !== undefined ? { monto: cambios.monto } : {}),
      ...(cambios.descripcion !== undefined ? { descripcion: cambios.descripcion } : {}),
      ...(cambios.categoriaId !== undefined ? { categoria_id: cambios.categoriaId } : {}),
      ...(cambios.categoriaDetalle !== undefined ? { categoria_detalle: cambios.categoriaDetalle || null } : {}),
      ...(cambios.cuentaId !== undefined ? { cuenta_id: cambios.cuentaId || null } : {}),
      ...(cambios.metodoPago !== undefined ? { metodo_pago: cambios.metodoPago || null } : {}),
      ...(cambios.fecha !== undefined ? { fecha: cambios.fecha } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return filaAGasto(data);
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("gastos").delete().eq("id", id);
  if (error) throw error;
}
