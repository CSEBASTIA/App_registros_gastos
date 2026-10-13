import { getSupabaseClient } from "../client";
import type { AbonoDeuda, Deuda } from "../types/domain";
import type { Database } from "../types/database";
import { abonoDeudaSchema } from "../schemas/deuda.schema";
import { fechaLocal } from "../lib/semanas";

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

export interface OpcionesAbono {
  /** Cuenta de ahorro/débito/efectivo de la que sale el dinero. Sin ella, solo baja el saldo de la deuda. */
  cuentaId?: string;
  /** "YYYY-MM-DD"; por defecto, hoy en la zona horaria del dispositivo. */
  fecha?: string;
}

/**
 * Registra un abono en una sola transacción de la base (función
 * `registrar_abono_deuda`, con la deuda bloqueada): baja el saldo, descuenta
 * de la cuenta de origen, libera cupo si es un diferido en tarjeta y mueve
 * `proximoPago` un mes si se cubrió la cuota. Un abono mayor que el saldo se
 * recorta al saldo. Devuelve la deuda actualizada.
 */
export async function registrarAbonoDeuda(
  id: string,
  monto: number,
  opciones: OpcionesAbono = {}
): Promise<Deuda> {
  const abono = abonoDeudaSchema.parse({
    deudaId: id,
    monto,
    cuentaId: opciones.cuentaId,
    fecha: opciones.fecha ?? fechaLocal(),
  });

  const { data, error } = await getSupabaseClient().rpc("registrar_abono_deuda", {
    p_deuda_id: abono.deudaId,
    p_monto: abono.monto,
    p_cuenta_id: abono.cuentaId ?? null,
    p_fecha: abono.fecha,
  });

  if (error) throw error;
  return filaADeuda(data as DeudaRow);
}

export async function listarAbonosDeuda(deudaId?: string): Promise<AbonoDeuda[]> {
  let query = getSupabaseClient().from("abonos_deuda").select("*");
  if (deudaId) query = query.eq("deuda_id", deudaId);

  const { data, error } = await query.order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    deudaId: row.deuda_id,
    cuentaId: row.cuenta_id ?? undefined,
    monto: Number(row.monto),
    fecha: row.fecha,
    createdAt: row.created_at,
  }));
}

export async function eliminarDeuda(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("deudas").delete().eq("id", id);
  if (error) throw error;
}
