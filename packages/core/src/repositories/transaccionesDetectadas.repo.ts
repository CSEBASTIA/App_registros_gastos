import { getSupabaseClient } from "../client";
import type { TransaccionDetectada } from "../types/domain";
import type { Database } from "../types/database";
import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo, textoRequerido } from "../schemas/limites";

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

/** ¿Se puede guardar este aviso? Monto y fecha reales y un id de mensaje. */
export function avisoGuardable(t: TransaccionDetectadaInsert): boolean {
  return (
    !!t.mensajeId &&
    t.mensajeId.length <= 500 &&
    Number.isFinite(t.monto) &&
    t.monto >= 0.01 &&
    t.monto <= LIMITES.monto &&
    fechaIso().safeParse(t.fecha).success
  );
}

/**
 * Inserta las transacciones detectadas en un correo nuevo. `mensajeId` es
 * único por usuario — sincronizar el mismo correo dos veces no duplica
 * nada (se ignoran los que ya existen). Los avisos con datos imposibles se
 * descartan uno por uno: antes uno solo hacía fallar todo el lote y la
 * sincronización quedaba bloqueada. Devuelve cuántos se enviaron y descartaron.
 */
export async function insertarTransaccionesDetectadas(
  items: TransaccionDetectadaInsert[]
): Promise<{ enviados: number; descartados: number }> {
  const validos = items.filter(avisoGuardable);
  const descartados = items.length - validos.length;
  if (validos.length === 0) return { enviados: 0, descartados };
  const { error } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .upsert(
      // El texto viene de correos de terceros: se recorta a los límites que
      // impone la base, para que un asunto larguísimo no tumbe el lote entero.
      validos.map((t) => ({
        mensaje_id: t.mensajeId,
        tipo: t.tipo,
        monto: t.monto,
        descripcion: t.descripcion.trim().slice(0, LIMITES.descripcion) || "Movimiento bancario",
        banco: t.banco ?? null,
        cuenta_id: t.cuentaId ?? null,
        categoria_id: t.categoriaId ?? null,
        fecha: t.fecha,
        correo_asunto: t.correoAsunto?.slice(0, LIMITES.asunto) ?? null,
      })),
      { onConflict: "usuario_id,mensaje_id", ignoreDuplicates: true }
    );
  if (error) throw error;
  return { enviados: validos.length, descartados };
}

/**
 * Descarta un aviso de la bandeja. Solo existe esta transición desde la app:
 * confirmar va por `confirmarTransaccionDetectada` (atómica) y la base impide
 * que un aviso resuelto vuelva a "pendiente" (confirmarlo dos veces duplicaba el gasto).
 */
export async function marcarTransaccionDetectada(id: string, estado: "descartado"): Promise<void> {
  if (estado !== "descartado") throw new Error("Solo se puede descartar un aviso desde aquí.");
  // Minimización: resuelto el aviso, su asunto original ya no hace falta.
  const { error } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .update({ estado, correo_asunto: null })
    .eq("id", id);
  if (error) throw error;
}

const confirmacionSchema = z.object({
  monto: montoPositivo(),
  descripcion: textoRequerido(LIMITES.descripcion),
  categoriaId: z.string().uuid().optional(),
  cuentaId: z.string().uuid().optional(),
});

export type DatosConfirmacion = z.infer<typeof confirmacionSchema>;

/**
 * Convierte un aviso detectado en gasto o ingreso real en UN solo paso de la
 * base (función `confirmar_transaccion_detectada`): crea el movimiento y
 * marca el aviso juntos, así un reintento nunca duplica el gasto. Si el aviso
 * ya estaba confirmado devuelve `{ yaConfirmado: true }` sin crear nada.
 */
export async function confirmarTransaccionDetectada(
  id: string,
  datos: DatosConfirmacion
): Promise<{ movimientoId: string | null; yaConfirmado: boolean }> {
  const d = confirmacionSchema.parse(datos);
  const { data, error } = await getSupabaseClient().rpc("confirmar_transaccion_detectada", {
    p_id: id,
    p_monto: d.monto,
    p_descripcion: d.descripcion,
    p_categoria_id: d.categoriaId ?? null,
    p_cuenta_id: d.cuentaId ?? null,
  });
  if (error) throw error;
  const movimientoId = (data as string | null) ?? null;
  return { movimientoId, yaConfirmado: movimientoId === null };
}

/**
 * Privacidad: borra todo lo que la app guardó a partir de correos de este
 * usuario (avisos pendientes, confirmados y descartados). Los gastos e
 * ingresos que ya se confirmaron NO se tocan: son datos propios del usuario.
 * RLS limita el borrado a las filas propias. Devuelve cuántas se borraron.
 */
export async function eliminarTransaccionesDetectadas(): Promise<number> {
  const { error, count } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) throw error;
  return count ?? 0;
}
