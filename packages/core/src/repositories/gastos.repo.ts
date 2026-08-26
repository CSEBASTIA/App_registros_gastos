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
      fecha: gasto.fecha,
    })
    .select()
    .single();

  if (error) throw error;
  return filaAGasto(data);
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("gastos").delete().eq("id", id);
  if (error) throw error;
}
