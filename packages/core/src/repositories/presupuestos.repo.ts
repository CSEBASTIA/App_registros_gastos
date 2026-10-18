import { getSupabaseClient } from "../client";
import type { AvisoPresupuesto, Presupuesto } from "../types/domain";
import type { Database } from "../types/database";
import { MES_ISO } from "../schemas/limites";
import { faltaEnLaBase } from "../lib/mensajeError";

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

/**
 * Crea el límite de una categoría para un mes, o lo actualiza si ya existía:
 * hay un solo presupuesto por (usuario, categoría, mes), garantizado por un
 * índice único en la base. `usuario_id` no se envía: lo pone la base con
 * `auth.uid()` y RLS impide escribir en nombre de otro usuario.
 */
export async function guardarPresupuesto(
  presupuesto: Omit<Presupuesto, "id">
): Promise<Presupuesto> {
  const { data, error } = await getSupabaseClient()
    .from("presupuestos")
    .upsert(
      {
        categoria_id: presupuesto.categoriaId,
        monto_limite: presupuesto.montoLimite,
        mes: presupuesto.mes,
      },
      { onConflict: "usuario_id,categoria_id,mes" }
    )
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

/**
 * Presupuestos del mes que acaban de cruzar el 75 %, el 100 % o el límite
 * (uno por presupuesto: el nivel más alto que todavía no se avisó). La base
 * los deja anotados, así cada nivel se avisa una sola vez por mes, venga el
 * gasto de la app o de un pago con billetera registrado solo. En una base
 * sin la migración devuelve una lista vacía.
 */
export async function revisarMisPresupuestos(mes: string): Promise<AvisoPresupuesto[]> {
  if (!MES_ISO.test(mes)) throw new Error("Mes inválido: se espera AAAA-MM.");
  const { data, error } = await getSupabaseClient().rpc("revisar_mis_presupuestos", { p_mes: mes });
  if (error) {
    if (faltaEnLaBase(error)) return [];
    throw error;
  }
  return avisosPresupuestoDe(data);
}

/** La respuesta de la base (jsonb) → avisos tipados; ignora lo que no tenga forma de aviso. */
export function avisosPresupuestoDe(data: unknown): AvisoPresupuesto[] {
  if (!Array.isArray(data)) return [];
  const avisos: AvisoPresupuesto[] = [];
  for (const fila of data as Record<string, unknown>[]) {
    const nivel = Number(fila?.nivel);
    if (nivel !== 75 && nivel !== 100 && nivel !== 101) continue;
    if (typeof fila.presupuesto_id !== "string") continue;
    avisos.push({
      presupuestoId: fila.presupuesto_id,
      categoria: typeof fila.categoria === "string" && fila.categoria.trim() ? fila.categoria : "Sin categoría",
      nivel,
      porcentaje: Number(fila.porcentaje) || 0,
      gastado: Number(fila.gastado) || 0,
      limite: Number(fila.limite) || 0,
    });
  }
  return avisos;
}
