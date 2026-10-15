import { getSupabaseClient } from "../client";
import type { Recordatorio } from "../types/domain";
import type { Database } from "../types/database";
import { siguienteFechaRecurrente } from "../lib/semanas";

type RecordatorioRow = Database["public"]["Tables"]["recordatorios"]["Row"];

function filaARecordatorio(row: RecordatorioRow): Recordatorio {
  return {
    id: row.id,
    titulo: row.titulo,
    tipo: row.tipo as Recordatorio["tipo"],
    monto: row.monto !== null ? Number(row.monto) : undefined,
    fecha: row.fecha,
    recurrente: row.recurrente,
    frecuencia: (row.frecuencia as Recordatorio["frecuencia"]) ?? undefined,
    completado: row.completado,
    deudaId: row.deuda_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listarRecordatorios(): Promise<Recordatorio[]> {
  const { data, error } = await getSupabaseClient()
    .from("recordatorios")
    .select("*")
    .order("fecha", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(filaARecordatorio);
}

export async function crearRecordatorio(
  recordatorio: Omit<Recordatorio, "id" | "createdAt" | "completado">
): Promise<Recordatorio> {
  const { data, error } = await getSupabaseClient()
    .from("recordatorios")
    .insert({
      titulo: recordatorio.titulo,
      tipo: recordatorio.tipo,
      monto: recordatorio.monto ?? null,
      fecha: recordatorio.fecha,
      recurrente: recordatorio.recurrente,
      frecuencia: recordatorio.frecuencia ?? null,
      deuda_id: recordatorio.deudaId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return filaARecordatorio(data);
}

export async function marcarCompletado(id: string, completado: boolean): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("recordatorios")
    .update({ completado })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Marca un recordatorio como hecho. Si es recurrente, en vez de quedar
 * tachado para siempre, se renueva: pasa a la siguiente fecha (semana, mes o
 * año después) y queda pendiente otra vez. Devuelve el recordatorio actualizado.
 */
export async function completarRecordatorio(recordatorio: Recordatorio): Promise<Recordatorio> {
  const cambios =
    recordatorio.recurrente && recordatorio.frecuencia
      ? { fecha: siguienteFechaRecurrente(recordatorio.fecha, recordatorio.frecuencia), completado: false }
      : { completado: true };

  const { data, error } = await getSupabaseClient()
    .from("recordatorios")
    .update(cambios)
    .eq("id", recordatorio.id)
    .select()
    .single();
  if (error) throw error;
  return filaARecordatorio(data);
}

export async function eliminarRecordatorio(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("recordatorios").delete().eq("id", id);
  if (error) throw error;
}
