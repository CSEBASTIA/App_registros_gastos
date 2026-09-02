import { getSupabaseClient } from "../client";
import type { TransaccionDetectada } from "../types/domain";
import type { Database } from "../types/database";

type Row = Database["public"]["Tables"]["transacciones_detectadas"]["Row"];

function filaATransaccion(row: Row): TransaccionDetectada {
  return {
    id: row.id,
    mensajeId: row.mensaje_id,
    tipo: row.tipo as TransaccionDetectada["tipo"],
    monto: Number(row.monto),
    descripcion: row.descripcion,
    banco: (row.banco as TransaccionDetectada["banco"]) ?? undefined,
    cuentaId: row.cuenta_id ?? undefined,
    categoriaId: row.categoria_id ?? undefined,
    fecha: row.fecha,
    correoAsunto: row.correo_asunto ?? undefined,
    estado: row.estado as TransaccionDetectada["estado"],
    createdAt: row.created_at,
  };
}

export async function listarTransaccionesPendientes(): Promise<TransaccionDetectada[]> {
  const { data, error } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .select("*")
    .eq("estado", "pendiente")
    .order("fecha", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(filaATransaccion);
}

export type TransaccionDetectadaInsert = Omit<TransaccionDetectada, "id" | "createdAt" | "estado">;

/**
 * Inserta las transacciones detectadas en un correo nuevo. `mensajeId` es
 * único por usuario — sincronizar el mismo correo dos veces no duplica
 * nada (se ignoran los que ya existen).
 */
export async function insertarTransaccionesDetectadas(items: TransaccionDetectadaInsert[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .upsert(
      items.map((t) => ({
        mensaje_id: t.mensajeId,
        tipo: t.tipo,
        monto: t.monto,
        descripcion: t.descripcion,
        banco: t.banco ?? null,
        cuenta_id: t.cuentaId ?? null,
        categoria_id: t.categoriaId ?? null,
        fecha: t.fecha,
        correo_asunto: t.correoAsunto ?? null,
      })),
      { onConflict: "usuario_id,mensaje_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function marcarTransaccionDetectada(
  id: string,
  estado: TransaccionDetectada["estado"]
): Promise<void> {
  const { error } = await getSupabaseClient().from("transacciones_detectadas").update({ estado }).eq("id", id);
  if (error) throw error;
}
