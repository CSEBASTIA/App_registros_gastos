import { getSupabaseClient } from "../client";
import type { AvisoPresupuesto, Presupuesto } from "../types/domain";
import type { Database } from "../types/database";
import { MES_ISO } from "../schemas/limites";
import { faltaEnLaBase } from "../lib/mensajeError";
import { mesLocal } from "../lib/semanas";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

function filaAPresupuesto(row: PresupuestoRow): Presupuesto {
  return {
    id: row.id,
    categoriaId: row.categoria_id ?? "",
    montoLimite: Number(row.monto_limite),
    mes: row.mes,
  };
}

/**
 * Prepara el mes: la primera vez que se abre, copia los presupuestos del
 * último mes que los tuvo (solo las categorías que faltan). La base lo hace
 * una sola vez por mes, así un presupuesto borrado no reaparece. Devuelve
 * cuántos copió; en una base sin la migración, 0.
 */
export async function continuarPresupuestos(mes: string): Promise<number> {
  if (!MES_ISO.test(mes)) throw new Error("Mes inválido: se espera AAAA-MM.");
  const { data, error } = await getSupabaseClient().rpc("continuar_presupuestos", { p_mes: mes });
  if (error) {
    if (faltaEnLaBase(error)) return 0;
    throw error;
  }
  return Number(data) || 0;
}

/** Los presupuestos de un mes (o todos). Al pedir el mes en curso, primero lo prepara con `continuarPresupuestos`. */
export async function listarPresupuestos(mes?: string): Promise<Presupuesto[]> {
  // Si no se pudo preparar el mes (sin conexión un instante), igual se muestran los que haya.
  if (mes && mes === mesLocal()) await continuarPresupuestos(mes).catch(() => 0);
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
