import { getSupabaseClient } from "../client";
import type { PagoTarjeta } from "../types/domain";
import type { Database } from "../types/database";
import { traerTodasLasFilas } from "../lib/paginacion";

type PagoRow = Database["public"]["Tables"]["pagos_tarjeta"]["Row"];

function filaAPago(row: PagoRow): PagoTarjeta {
  return {
    id: row.id,
    cuentaId: row.cuenta_id,
    cuentaOrigenId: row.cuenta_origen_id ?? undefined,
    monto: Number(row.monto),
    fecha: row.fecha,
    createdAt: row.created_at,
  };
}

export async function listarPagosTarjeta(cuentaId?: string): Promise<PagoTarjeta[]> {
  // Todas las páginas (sin el tope de 1.000 filas de Supabase).
  const filas = await traerTodasLasFilas<PagoRow>((inicio, fin) => {
    let query = getSupabaseClient().from("pagos_tarjeta").select("*");
    if (cuentaId) query = query.eq("cuenta_id", cuentaId);
    return query.order("fecha", { ascending: false }).order("id").range(inicio, fin);
  });
  return filas.map(filaAPago);
}

export async function crearPagoTarjeta(
  pago: Omit<PagoTarjeta, "id" | "createdAt">
): Promise<PagoTarjeta> {
  const { data, error } = await getSupabaseClient()
    .from("pagos_tarjeta")
    .insert({
      cuenta_id: pago.cuentaId,
      cuenta_origen_id: pago.cuentaOrigenId ?? null,
      monto: pago.monto,
      fecha: pago.fecha,
    })
    .select()
    .single();

  if (error) throw error;
  return filaAPago(data);
}
