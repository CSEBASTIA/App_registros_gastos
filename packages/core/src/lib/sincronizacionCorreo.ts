/**
 * Piezas de la sincronización con el correo que no dependen del proveedor
 * (Gmail / Outlook) ni de la plataforma, para poder probarlas.
 */
import type { Cuenta } from "../types/domain";
import type { TransaccionDetectadaInsert } from "../repositories/transaccionesDetectadas.repo";
import { parsearCorreoBancario } from "./correoBancario";

export interface CorreoRecibido {
  mensajeId: string;
  remitente: string;
  asunto: string;
  cuerpoTexto: string;
  fecha: string; // YYYY-MM-DD, día local de recepción
}

export interface CorreosTraidos {
  correos: CorreoRecibido[];
  /** Había más correos que el tope: se revisaron solo los más recientes. */
  truncado: boolean;
  /** Correos que se listaron pero no se pudieron descargar. */
  fallidos: number;
}

/** Máximo de correos por búsqueda (antes 40 sin paginar: el resto se perdía en silencio). */
export const TOPE_CORREOS = 500;
/** La primera búsqueda mira solo los últimos 14 días, no toda la casilla. */
const DIAS_PRIMERA_BUSQUEDA = 14;
/** Solapamiento con la búsqueda anterior (relojes desfasados, correos en tránsito). No duplica: el mensajeId es único. */
const SOLAPE_MS = 10 * 60 * 1000;

export const MENSAJE_PERMISO_CORREO_VENCIDO =
  "El permiso para leer tu correo venció o fue retirado. Vuelve a conectar tu correo.";

/** Desde cuándo buscar, a partir de la marca guardada de la última búsqueda completa. */
export function desdeParaSincronizar(marcaGuardada: string | null, ahora: Date = new Date()): Date {
  const marca = marcaGuardada ? new Date(marcaGuardada).getTime() : NaN;
  if (Number.isFinite(marca) && marca <= ahora.getTime()) return new Date(marca - SOLAPE_MS);
  return new Date(ahora.getTime() - DIAS_PRIMERA_BUSQUEDA * 24 * 60 * 60 * 1000);
}

/**
 * Búsqueda de Gmail para una sincronización: lo recibido desde `desde`, sin las
 * pestañas Promociones, Social y Foros (ahí no llegan los avisos del banco).
 * Se leen menos correos ajenos y casi nunca se llega al tope de `TOPE_CORREOS`.
 */
export function consultaGmail(desde: Date): string {
  const segundos = Math.floor(desde.getTime() / 1000);
  return `after:${segundos} -category:promotions -category:social -category:forums`;
}

/** El refresh token ya no sirve (permiso retirado, contraseña cambiada, token caducado). */
export function esPermisoRetirado(err: unknown): boolean {
  const e = err as { code?: unknown; error?: unknown; message?: unknown } | undefined;
  return e?.code === "invalid_grant" || e?.error === "invalid_grant" || /invalid_grant/.test(String(e?.message ?? ""));
}

/** Recorre páginas hasta que no haya más o se junten `tope` elementos. */
export async function juntarPaginas<T>(
  pedirPagina: (token: string | undefined) => Promise<{ items: T[]; siguiente?: string }>,
  tope: number
): Promise<{ items: T[]; truncado: boolean }> {
  const items: T[] = [];
  let token: string | undefined;
  do {
    const pagina = await pedirPagina(token);
    items.push(...pagina.items);
    token = pagina.siguiente;
  } while (token && items.length < tope);
  return { items: items.slice(0, tope), truncado: items.length > tope || !!token };
}

/**
 * Ejecuta `tarea` sobre cada elemento, `simultaneas` a la vez. Un fallo no
 * tumba a los demás (antes un solo correo ilegible hacía fallar la búsqueda).
 */
export async function enLotes<T, R>(
  elementos: T[],
  simultaneas: number,
  tarea: (elemento: T) => Promise<R>
): Promise<{ resultados: R[]; fallidos: number; primerError?: unknown }> {
  const resultados: R[] = [];
  let fallidos = 0;
  let primerError: unknown;
  for (let i = 0; i < elementos.length; i += simultaneas) {
    const lote = await Promise.allSettled(elementos.slice(i, i + simultaneas).map(tarea));
    for (const r of lote) {
      if (r.status === "fulfilled") resultados.push(r.value);
      else {
        fallidos += 1;
        primerError ??= r.reason;
      }
    }
  }
  return { resultados, fallidos, primerError };
}

/**
 * Cuenta a la que asignar un aviso: la única cuenta de ese banco, o la que
 * coincide con los últimos dígitos. Si es ambiguo, se elige a mano en la Bandeja.
 */
export function cuentaParaAviso(
  cuentas: Cuenta[],
  banco: Cuenta["banco"] | undefined,
  identificador: string | undefined
): string | undefined {
  if (!banco) return undefined;
  const delBanco = cuentas.filter((c) => c.banco === banco);
  if (delBanco.length === 1) return delBanco[0].id;
  if (identificador) return delBanco.find((c) => c.identificador === identificador)?.id;
  return undefined;
}

/** Convierte correos en avisos para la Bandeja. Sin tipo o sin monto no sirven: se omiten. */
export function avisosDeCorreos(correos: CorreoRecibido[], cuentas: Cuenta[]): TransaccionDetectadaInsert[] {
  const avisos: TransaccionDetectadaInsert[] = [];
  for (const correo of correos) {
    const p = parsearCorreoBancario(correo.remitente, correo.asunto, correo.cuerpoTexto);
    if (!p.tipo || !p.monto) continue;
    avisos.push({
      mensajeId: correo.mensajeId,
      tipo: p.tipo,
      monto: p.monto,
      descripcion: p.descripcion,
      banco: p.banco,
      cuentaId: cuentaParaAviso(cuentas, p.banco, p.identificadorCuenta),
      fecha: p.fecha ?? correo.fecha,
      correoAsunto: correo.asunto,
      ...(p.esTransferencia ? { esTransferencia: true } : {}),
    });
  }
  return avisos;
}

export interface ResultadoSincronizacion {
  revisados: number;
  enviados: number;
  descartados: number;
  truncado: boolean;
  fallidos: number;
}

/** Texto para la persona con lo que pasó en la búsqueda. */
export function resumenSincronizacion(r: ResultadoSincronizacion): string {
  const partes = [
    r.enviados === 0
      ? "No encontré movimientos nuevos que reconocer."
      : `Encontré ${r.enviados} movimiento(s) — revísalos en la Bandeja (si ya estaban, no se duplican).`,
  ];
  if (r.descartados > 0) partes.push(`${r.descartados} aviso(s) tenían datos imposibles y se omitieron.`);
  if (r.truncado) partes.push(`Había más de ${TOPE_CORREOS} correos: se revisaron los más recientes.`);
  if (r.fallidos > 0) partes.push(`No se pudieron leer ${r.fallidos} correo(s); se volverán a intentar en la próxima búsqueda.`);
  return partes.join(" ");
}
