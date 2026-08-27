import { getSupabaseClient } from "../client";
import type { PagoTarjeta } from "../types/domain";
import type { Database } from "../types/database";

type PagoRow = Database["public"]["Tables"]["pagos_tarjeta"]["Row"];

function filaAPago(row: PagoRow): PagoTarjeta {
  return {
    id: row.id,
    cuentaId: row.cuenta_id,
    monto: Number(row.monto),
    fecha: row.fecha,
    createdAt: row.created_at,
  };
}

export async function listarPagosTarjeta(cuentaId?: string): Promise<PagoTarjeta[]> {
  let query = getSupabaseClient().from("pagos_tarjeta").select("*");
  if (cuentaId) query = query.eq("cuenta_id", cuentaId);

  const { data, error } = await query.order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(filaAPago);
}

export async function crearPagoTarjeta(
  pago: Omit<PagoTarjeta, "id" | "createdAt">
): Promise<PagoTarjeta> {
  const { data, error } = await getSupabaseClient()
    .from("pagos_tarjeta")
    .insert({
      cuenta_id: pago.cuentaId,
      monto: pago.monto,
      fecha: pago.fecha,
    })
    .select()
    .single();

  if (error) throw error;
  return filaAPago(data);
}
