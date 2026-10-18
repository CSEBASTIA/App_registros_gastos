import { getSupabaseClient } from "../client";
import type { Cuenta } from "../types/domain";
import type { Database } from "../types/database";
import { repararTexto } from "../lib/repararTexto";
import { fechasTarjetaSchema, identificadorCuentaSchema } from "../schemas/cuenta.schema";

type CuentaRow = Database["public"]["Tables"]["cuentas"]["Row"];

function filaACuenta(row: CuentaRow): Cuenta {
  return {
    id: row.id,
    nombre: repararTexto(row.nombre),
    tipo: row.tipo as Cuenta["tipo"],
    banco: row.banco as Cuenta["banco"],
    marca: (row.marca as Cuenta["marca"]) ?? undefined,
    estilo: row.estilo ?? undefined,
    cupoTotal: row.cupo_total !== null ? Number(row.cupo_total) : undefined,
    identificador: row.identificador ?? undefined,
    diaCorte: row.dia_corte ?? undefined,
    diaPago: row.dia_pago ?? undefined,
    disponible: Number(row.disponible),
    createdAt: row.created_at,
  };
}

export async function listarCuentas(): Promise<Cuenta[]> {
  const { data, error } = await getSupabaseClient()
    .from("cuentas")
    .select("*")
    .order("created_at");

  if (error) throw error;
  return (data ?? []).map(filaACuenta);
}

export async function crearCuenta(cuenta: Omit<Cuenta, "id" | "createdAt">): Promise<Cuenta> {
  const { data, error } = await getSupabaseClient()
    .from("cuentas")
    .insert({
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      banco: cuenta.banco,
      marca: cuenta.marca ?? null,
      estilo: cuenta.estilo ?? null,
      cupo_total: cuenta.cupoTotal ?? null,
      identificador: cuenta.identificador ?? null,
      disponible: cuenta.disponible,
      // Solo si se indicó: así crear cuentas funciona también en una base sin
      // la migración de casas comerciales y corte (que agrega las columnas).
      ...(cuenta.diaCorte !== undefined ? { dia_corte: cuenta.diaCorte } : {}),
      ...(cuenta.diaPago !== undefined ? { dia_pago: cuenta.diaPago } : {}),
    })
    .select()
    .single();

  if (error) throw error;
  return filaACuenta(data);
}

export async function eliminarCuenta(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("cuentas").delete().eq("id", id);
  if (error) throw error;
}

/** Cambia el día de corte y el de pago de una tarjeta (`null` los quita). La base exige que sea de crédito. */
export async function actualizarFechasTarjeta(
  id: string,
  fechas: { diaCorte?: number | null; diaPago?: number | null }
): Promise<Cuenta> {
  const f = fechasTarjetaSchema.parse(fechas);
  const { data, error } = await getSupabaseClient()
    .from("cuentas")
    .update({
      ...(f.diaCorte !== undefined ? { dia_corte: f.diaCorte } : {}),
      ...(f.diaPago !== undefined ? { dia_pago: f.diaPago } : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return filaACuenta(data);
}

/**
 * Cambia los últimos dígitos de una cuenta o tarjeta ("" los quita). Con
 * ellos la base reconoce la tarjeta de un pago con Google Wallet o Apple Pay
 * y lo registra sola (si el registro automático está encendido).
 */
export async function actualizarIdentificadorCuenta(id: string, identificador: string): Promise<Cuenta> {
  const valor = identificadorCuentaSchema.parse(identificador).trim();
  const { data, error } = await getSupabaseClient()
    .from("cuentas")
    .update({ identificador: valor || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return filaACuenta(data);
}
