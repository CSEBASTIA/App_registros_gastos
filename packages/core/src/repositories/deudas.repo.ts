import { getSupabaseClient } from "../client";
import type { Deuda } from "../types/domain";
import type { Database } from "../types/database";

type DeudaRow = Database["public"]["Tables"]["deudas"]["Row"];

function filaADeuda(row: DeudaRow): Deuda {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo as Deuda["tipo"],
    montoTotal: Number(row.monto_total),
    saldoPendiente: Number(row.saldo_pendiente),
    cuotaMensual: Number(row.cuota_mensual),
    tasaInteres: row.tasa_interes !== null ? Number(row.tasa_interes) : undefined,
    fechaInicio: row.fecha_inicio,
    proximoPago: row.proximo_pago ?? undefined,
    cuentaId: row.cuenta_id ?? undefined,
    gastoId: row.gasto_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listarDeudas(): Promise<Deuda[]> {
  const { data, error } = await getSupabaseClient()
    .from("deudas")
    .select("*")
    .order("proximo_pago", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map(filaADeuda);
}

export async function crearDeuda(deuda: Omit<Deuda, "id" | "createdAt">): Promise<Deuda> {
  const { data, error } = await getSupabaseClient()
    .from("deudas")
    .insert({
      nombre: deuda.nombre,
      tipo: deuda.tipo,
      monto_total: deuda.montoTotal,
      saldo_pendiente: deuda.saldoPendiente,
      cuota_mensual: deuda.cuotaMensual,
      tasa_interes: deuda.tasaInteres ?? null,
      fecha_inicio: deuda.fechaInicio,
      proximo_pago: deuda.proximoPago ?? null,
      cuenta_id: deuda.cuentaId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return filaADeuda(data);
}

/** Registra un abono: descuenta el saldo pendiente y devuelve la deuda actualizada. */
export async function registrarAbonoDeuda(id: string, monto: number): Promise<Deuda> {
  const client = getSupabaseClient();
  const { data: actual, error: errorLectura } = await client
    .from("deudas")
    .select("saldo_pendiente")
    .eq("id", id)
    .single();
  if (errorLectura) throw errorLectura;

  const nuevoSaldo = Math.max(0, Number(actual.saldo_pendiente) - monto);

  const { data, error } = await client
    .from("deudas")
    .update({ saldo_pendiente: nuevoSaldo })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return filaADeuda(data);
}

export async function eliminarDeuda(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("deudas").delete().eq("id", id);
  if (error) throw error;
}
