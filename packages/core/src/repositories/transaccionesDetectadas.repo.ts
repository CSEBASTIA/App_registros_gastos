import { getSupabaseClient } from "../client";
import type { ClaseAviso, OrigenTransaccion, TransaccionDetectada } from "../types/domain";
import type { Database } from "../types/database";
import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo, textoRequerido } from "../schemas/limites";
import { ubicacionSegura } from "../schemas/ubicacion.schema";
import { filaDeUbicacion, ubicacionDeFila } from "../lib/ubicacion";
import { faltaEnLaBase } from "../lib/mensajeError";

type Row = Database["public"]["Tables"]["transacciones_detectadas"]["Row"];

const TARJETA_FINAL = /^[0-9]{3,4}$/;

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
    // Una base sin la migración de billeteras no trae `origen`: todo es correo.
    origen: (row.origen as OrigenTransaccion | undefined) ?? "correo",
    comercio: row.comercio ?? undefined,
    ubicacion: ubicacionDeFila(row),
    tarjetaFinal: row.tarjeta_final ?? undefined,
    pagadoEn: row.pagado_en ?? undefined,
    // Sin la migración de transferencias estas columnas no existen.
    esTransferencia: row.es_transferencia === true,
    transferenciaId: row.transferencia_id ?? undefined,
    gastoId: row.gasto_id ?? undefined,
    // Sin la migración del correo estas columnas no existen.
    clase: (row.clase as ClaseAviso | null | undefined) ?? undefined,
    contraparteCuentaId: row.contraparte_cuenta_id ?? undefined,
    comision: row.comision !== null && row.comision !== undefined ? Number(row.comision) : undefined,
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

/** Para el indicador de Más: pide solo el conteo, sin transferir avisos. */
export async function contarTransaccionesPendientes(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if (error) throw error;
  return count ?? 0;
}

/** `origen` es opcional: si falta, el aviso es del correo (como hasta ahora). */
export type TransaccionDetectadaInsert = Omit<
  TransaccionDetectada,
  "id" | "createdAt" | "estado" | "origen" | "transferenciaId" | "gastoId"
> & {
  origen?: OrigenTransaccion;
};

/**
 * ¿Se puede guardar este aviso? Monto y fecha reales y un id de mensaje. Un
 * aviso de billetera es siempre un gasto. (Ubicación, comercio y tarjeta no
 * deciden: si vienen mal, el aviso se guarda sin ellos.)
 */
export function avisoGuardable(t: TransaccionDetectadaInsert): boolean {
  return (
    !!t.mensajeId &&
    t.mensajeId.length <= 500 &&
    Number.isFinite(t.monto) &&
    t.monto >= 0.01 &&
    t.monto <= LIMITES.monto &&
    fechaIso().safeParse(t.fecha).success &&
    (t.origen === undefined || t.origen === "correo" || t.tipo === "gasto")
  );
}

/** ¿Trae algo que solo existe con la migración de billeteras? */
function usaCamposDeBilletera(t: TransaccionDetectadaInsert): boolean {
  return (t.origen !== undefined && t.origen !== "correo") || !!t.comercio || !!t.ubicacion || !!t.tarjetaFinal;
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
  // Las columnas nuevas solo se envían si algún aviso las usa: así la
  // sincronización del correo sigue funcionando en una base sin la migración.
  // Si se envían, van en TODAS las filas: en un lote, una columna que falta
  // en una fila llega como null (y `origen` no admite null).
  const conBilletera = validos.some(usaCamposDeBilletera);
  // Igual con la marca de transferencia (migración de transferencias): solo
  // se envía si algún aviso la lleva, y entonces en todas las filas. En una
  // base sin esa columna se reintenta sin ella: los avisos llegan igual, sin
  // juntarse solos.
  const conTransferencia = validos.some((t) => t.esTransferencia);
  // Y con lo que el lector reconoció del correo (migración de registro del
  // correo): clase, la otra cuenta, la comisión y la hora exacta.
  const conClase = validos.some((t) => t.clase || t.contraparteCuentaId || t.comision || t.pagadoEn);
  const enviar = (marcarTransferencias: boolean, marcarClase: boolean) =>
    getSupabaseClient()
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
          ...(conBilletera
            ? {
                origen: t.origen ?? "correo",
                comercio: t.comercio?.trim().slice(0, LIMITES.descripcion) || null,
                ...filaDeUbicacion(ubicacionSegura(t.ubicacion) ?? null),
                tarjeta_final: t.tarjetaFinal && TARJETA_FINAL.test(t.tarjetaFinal) ? t.tarjetaFinal : null,
              }
            : {}),
          ...(marcarTransferencias ? { es_transferencia: t.esTransferencia === true } : {}),
          ...(marcarClase
            ? {
                clase: t.clase ?? null,
                contraparte_cuenta_id: t.contraparteCuentaId ?? null,
                comision: t.comision !== undefined && t.comision > 0 && t.comision <= LIMITES.monto ? t.comision : null,
                pagado_en: t.pagadoEn ?? null,
              }
            : {}),
        })),
        { onConflict: "usuario_id,mensaje_id", ignoreDuplicates: true }
      );
  let { error } = await enviar(conTransferencia, conClase);
  // Una base sin alguna de las migraciones nuevas: se reintenta sin lo que le falta.
  if (error && conClase && faltaEnLaBase(error)) ({ error } = await enviar(conTransferencia, false));
  if (error && conTransferencia && faltaEnLaBase(error)) ({ error } = await enviar(false, false));
  if (error) throw error;
  return { enviados: validos.length, descartados };
}

/** Un aviso del correo que la base resolvió sola. */
export interface AvisoRegistrado {
  avisoId: string;
  /** `ya_registrado`: ese movimiento ya estaba (Google Wallet, o el otro correo del mismo pago): no se duplicó. */
  resultado: "registrado" | "ya_registrado";
  clase: ClaseAviso;
  gastoId?: string;
  monto?: number;
  comercio?: string;
  fecha?: string;
  /** Nombre de la cuenta o tarjeta afectada. */
  cuenta?: string;
  /** Últimos dígitos de la tarjeta. */
  tarjeta?: string;
  categoria?: string;
  /** Pago de tarjeta: la cuenta desde la que se pagó. Transferencia: la cuenta destino. */
  otraCuenta?: string;
  comision?: number;
  /** Un consumo que no encontró un lugar con el nombre del comercio. */
  sinLugar?: boolean;
}

const texto = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const numero = (v: unknown): number | undefined => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Pide a la base que registre sola lo que el correo trajo con un formato
 * conocido y con las cuentas ya identificadas (consumos con tarjeta, pagos de
 * tarjeta y transferencias entre tus cuentas), si el registro automático está
 * encendido. Lo demás se queda en la Bandeja. Devuelve lo que se registró. En
 * una base sin la migración devuelve una lista vacía.
 */
export async function registrarAvisosDelCorreo(): Promise<AvisoRegistrado[]> {
  const { data, error } = await getSupabaseClient().rpc("registrar_avisos_correo");
  if (error) {
    if (faltaEnLaBase(error)) return [];
    throw error;
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((r): AvisoRegistrado[] => {
    const x = r as Record<string, unknown>;
    const resultado = x.resultado === "registrado" || x.resultado === "ya_registrado" ? x.resultado : undefined;
    const clase = x.clase === "consumo" || x.clase === "pago_tarjeta" || x.clase === "transferencia" ? x.clase : undefined;
    const avisoId = texto(x.aviso);
    if (!resultado || !clase || !avisoId) return [];
    return [
      {
        avisoId,
        resultado,
        clase,
        gastoId: texto(x.gasto_id),
        monto: numero(x.monto),
        comercio: texto(x.comercio),
        fecha: texto(x.fecha),
        cuenta: texto(x.cuenta),
        tarjeta: texto(x.tarjeta),
        categoria: texto(x.categoria),
        otraCuenta: texto(x.origen) ?? texto(x.destino),
        comision: numero(x.comision),
        sinLugar: x.sin_lugar === true,
      },
    ];
  });
}

const pagoTarjetaSchema = z.object({
  tarjetaId: z.string().uuid(),
  origenId: z.string().uuid(),
  monto: montoPositivo().optional(),
});

/**
 * Confirma un aviso del correo como pago de una tarjeta de crédito, desde una
 * cuenta propia: registra el pago (sube el cupo y baja la cuenta de origen) y
 * resuelve el aviso; si el mismo pago llegó en otro correo, también ese.
 */
export async function confirmarAvisoComoPagoTarjeta(
  id: string,
  datos: z.infer<typeof pagoTarjetaSchema>
): Promise<{ pagoId: string | null; yaConfirmado: boolean }> {
  const d = pagoTarjetaSchema.parse(datos);
  const { data, error } = await getSupabaseClient().rpc("confirmar_aviso_como_pago_tarjeta", {
    p_id: id,
    p_tarjeta: d.tarjetaId,
    p_origen: d.origenId,
    p_monto: d.monto ?? null,
  });
  if (error) throw error;
  return { pagoId: data ?? null, yaConfirmado: data === null };
}

/**
 * Borra los avisos que siguen pendientes y vinieron del correo, para volver a
 * leerlos con el lector nuevo. Los confirmados y descartados no se tocan.
 */
export async function borrarAvisosPendientesDelCorreo(): Promise<number> {
  const { error, count } = await getSupabaseClient()
    .from("transacciones_detectadas")
    .delete({ count: "exact" })
    .eq("estado", "pendiente")
    .eq("origen", "correo");
  if (error) throw error;
  return count ?? 0;
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
