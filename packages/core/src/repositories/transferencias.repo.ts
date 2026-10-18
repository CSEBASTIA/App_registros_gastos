import { getSupabaseClient } from "../client";
import type { Transferencia } from "../types/domain";
import type { Database } from "../types/database";
import { traerTodasLasFilas, validarRango, type RangoFechas } from "../lib/paginacion";
import { faltaEnLaBase } from "../lib/mensajeError";
import {
  avisoComoTransferenciaSchema,
  transferenciaSchema,
  type AvisoComoTransferenciaInput,
} from "../schemas/transferencia.schema";

type TransferenciaRow = Database["public"]["Tables"]["transferencias"]["Row"];

function filaATransferencia(row: TransferenciaRow): Transferencia {
  return {
    id: row.id,
    cuentaOrigenId: row.cuenta_origen_id ?? undefined,
    cuentaDestinoId: row.cuenta_destino_id ?? undefined,
    monto: Number(row.monto),
    fecha: row.fecha,
    descripcion: row.descripcion ?? undefined,
    origen: row.origen === "correo" ? "correo" : "manual",
    createdAt: row.created_at,
  };
}

/**
 * Transferencias entre cuentas propias, más recientes primero (todas las
 * páginas). En una base sin la migración de transferencias devuelve una
 * lista vacía: el resto de la app sigue funcionando.
 */
export async function listarTransferencias(rango: RangoFechas = {}): Promise<Transferencia[]> {
  const { desde, hasta } = validarRango(rango);
  try {
    const filas = await traerTodasLasFilas<TransferenciaRow>((inicio, fin) => {
      let query = getSupabaseClient().from("transferencias").select("*");
      if (desde) query = query.gte("fecha", desde);
      if (hasta) query = query.lte("fecha", hasta);
      return query.order("fecha", { ascending: false }).order("created_at", { ascending: false }).order("id").range(inicio, fin);
    });
    return filas.map(filaATransferencia);
  } catch (err) {
    if (faltaEnLaBase(err)) return [];
    throw err;
  }
}

/**
 * Pasa dinero de una cuenta propia a otra. La base resta del origen y suma
 * al destino en el mismo paso, y rechaza una cuenta ajena, una tarjeta de
 * crédito como destino («Pagar tarjeta») o un avance que supere el cupo.
 */
export async function registrarTransferencia(input: unknown): Promise<Transferencia> {
  const t = transferenciaSchema.parse(input);
  const { data, error } = await getSupabaseClient()
    .from("transferencias")
    .insert({
      cuenta_origen_id: t.cuentaOrigenId,
      cuenta_destino_id: t.cuentaDestinoId,
      monto: t.monto,
      fecha: t.fecha,
      descripcion: t.descripcion?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return filaATransferencia(data);
}

/** Borra una transferencia: la base devuelve el dinero al origen y lo saca del destino. */
export async function eliminarTransferencia(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("transferencias").delete().eq("id", id);
  if (error) throw error;
}

/**
 * «No era una transferencia entre mis cuentas» (solo las que llegaron por
 * correo): borra la transferencia y devuelve sus avisos a la bandeja para
 * confirmarlos como gasto e ingreso. Devuelve cuántos avisos volvieron.
 */
export async function separarTransferencia(id: string): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc("separar_transferencia", { p_id: id });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Confirma un aviso de la bandeja como transferencia entre la cuenta del
 * aviso y `otraCuentaId`. Si la otra mitad (el aviso de la otra cuenta) está
 * en la bandeja, se resuelve junto. Reintentar no duplica: devuelve la misma.
 */
export async function confirmarAvisoComoTransferencia(id: string, datos: AvisoComoTransferenciaInput): Promise<string> {
  const d = avisoComoTransferenciaSchema.parse(datos);
  const { data, error } = await getSupabaseClient().rpc("confirmar_aviso_como_transferencia", {
    p_id: id,
    p_cuenta: d.cuentaId,
    p_otra_cuenta: d.otraCuentaId,
    p_monto: d.monto ?? null,
    p_descripcion: d.descripcion?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}
