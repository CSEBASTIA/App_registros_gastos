import { getSupabaseClient } from "../client";
import type { Presupuesto } from "../types/domain";
import type { Database } from "../types/database";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

function filaAPresupuesto(row: PresupuestoRow): Presupuesto {
  return {
    id: row.id,
    categoriaId: row.categoria_id ?? "",
    montoLimite: Number(row.monto_limite),
    mes: row.mes,
  };
}

export async function listarPresupuestos(mes?: string): Promise<Presupuesto[]> {
  let query = getSupabaseClient().from("presupuestos").select("*");
  if (mes) query = query.eq("mes", mes);

  const { data, error } = await query.order("mes", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(filaAPresupuesto);
}

export async function crearPresupuesto(
  presupuesto: Omit<Presupuesto, "id">
): Promise<Presupuesto> {
  const { data, error } = await getSupabaseClient()
    .from("presupuestos")
    .insert({
      categoria_id: presupuesto.categoriaId,
      monto_limite: presupuesto.montoLimite,
      mes: presupuesto.mes,
    })
    .select()
    .single();

  if (error) throw error;
  return filaAPresupuesto(data);
}

export async function eliminarPresupuesto(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("presupuestos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
