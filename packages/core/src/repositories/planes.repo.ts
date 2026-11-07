import { getSupabaseClient } from "../client";
import { esIdPlan, type PlanUsuario } from "../lib/planes";
import { fechaLocal } from "../lib/semanas";

/**
 * El plan de la persona. La tabla es de solo lectura (RLS deja ver solo lo
 * propio y la escribe el servidor con los avisos de RevenueCat); sin fila, o
 * con datos que no se reconocen, se devuelve null = Gratis.
 */
export async function obtenerMiPlan(): Promise<PlanUsuario | null> {
  const { data, error } = await getSupabaseClient()
    .from("planes_usuario")
    .select("plan, estado, vence_en")
    .maybeSingle();
  if (error) throw error;
  if (!data || !esIdPlan(data.plan)) return null;
  const estado = data.estado === "activa" || data.estado === "cancelada" ? data.estado : "vencida";
  return { plan: data.plan, estado, ...(data.vence_en ? { venceEn: fechaLocal(new Date(data.vence_en)) } : {}) };
}
