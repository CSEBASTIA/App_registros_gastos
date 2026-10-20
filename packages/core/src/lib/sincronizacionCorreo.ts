/**
 * Piezas de la sincronización con el correo que no dependen del proveedor
 * (Gmail / Outlook) ni de la plataforma, para poder probarlas.
 */
import type { ClaseAviso, Cuenta } from "../types/domain";
import type { AvisoRegistrado, TransaccionDetectadaInsert } from "../repositories/transaccionesDetectadas.repo";
import { parsearCorreoBancario, type CorreoParseado } from "./correoBancario";
import { formatMonto } from "./formatMonto";

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

/** Cuentas con saldo (sin cupo): de ahí sale el dinero de un pago de tarjeta o de una transferencia. */
const CUENTAS_CON_SALDO: Cuenta["tipo"][] = ["ahorro", "debito"];

/** El banco muestra 2, 3 o 4 dígitos («234», «1234»): coinciden si uno termina en el otro. */
function digitosCoinciden(identificador: string, digitos: string): boolean {
  const [corto, largo] = identificador.length <= digitos.length ? [identificador, digitos] : [digitos, identificador];
  return corto.length >= 2 && largo.endsWith(corto);
}

/**
 * La cuenta o tarjeta de un banco a la que corresponden unos últimos dígitos,
 * con seguridad suficiente para registrar solo (más estricta que
 * `cuentaParaAviso`, que solo propone una cuenta para revisar):
 * - Con dígitos: la única cuenta que los lleva anotados. Si ninguna los lleva,
 *   la única que todavía no tiene dígitos anotados (puede ser esa). Si hay dos
 *   posibles, no adivina.
 * - Sin dígitos: la única cuenta de ese banco y tipo.
 */
export function cuentaPorDigitos(
  cuentas: Cuenta[],
  banco: Cuenta["banco"] | undefined,
  digitos: string | undefined,
  tipos: Cuenta["tipo"][]
): string | undefined {
  if (!banco) return undefined;
  const candidatas = cuentas.filter((c) => c.banco === banco && tipos.includes(c.tipo));
  if (!digitos) return candidatas.length === 1 ? candidatas[0].id : undefined;
  const coinciden = candidatas.filter((c) => c.identificador && digitosCoinciden(c.identificador, digitos));
  if (coinciden.length === 1) return coinciden[0].id;
  if (coinciden.length > 1) {
    const exactas = coinciden.filter((c) => c.identificador === digitos);
    return exactas.length === 1 ? exactas[0].id : undefined;
  }
  const sinDigitos = candidatas.filter((c) => !c.identificador);
  return sinDigitos.length === 1 ? sinDigitos[0].id : undefined;
}

/** Las cuentas de un aviso reconocido por plantilla (consumo, pago de tarjeta o transferencia). */
function cuentasDeAvisoReconocido(
  p: CorreoParseado,
  cuentas: Cuenta[]
): { cuentaId?: string; contraparteCuentaId?: string } {
  switch (p.clase) {
    case "consumo":
      return { cuentaId: cuentaPorDigitos(cuentas, p.banco, p.tarjetaFinal, ["credito", "debito", "ahorro"]) };
    case "pago_tarjeta":
      return {
        cuentaId: cuentaPorDigitos(cuentas, p.banco, p.tarjetaFinal, ["credito"]),
        contraparteCuentaId: cuentaPorDigitos(cuentas, p.banco, p.contraparteFinal, CUENTAS_CON_SALDO),
      };
    case "transferencia":
      return {
        cuentaId: cuentaPorDigitos(cuentas, p.banco, p.tarjetaFinal, CUENTAS_CON_SALDO),
        contraparteCuentaId: cuentaPorDigitos(cuentas, p.contraparteBanco, p.contraparteFinal, CUENTAS_CON_SALDO),
      };
    default:
      return {};
  }
}

/** Convierte correos en avisos para la Bandeja. Sin tipo o sin monto no sirven: se omiten. */
export function avisosDeCorreos(correos: CorreoRecibido[], cuentas: Cuenta[]): TransaccionDetectadaInsert[] {
  const avisos: TransaccionDetectadaInsert[] = [];
  for (const correo of correos) {
    const p = parsearCorreoBancario(correo.remitente, correo.asunto, correo.cuerpoTexto);
    if (!p.tipo || !p.monto) continue;
    const reconocido = p.clase ? cuentasDeAvisoReconocido(p, cuentas) : undefined;
    avisos.push({
      mensajeId: correo.mensajeId,
      tipo: p.tipo,
      monto: p.monto,
      descripcion: p.descripcion,
      banco: p.banco,
      cuentaId: reconocido ? reconocido.cuentaId : cuentaParaAviso(cuentas, p.banco, p.identificadorCuenta),
      // La fecha de recepción solo sirve si el aviso no trae la suya.
      fecha: p.fecha ?? correo.fecha,
      correoAsunto: correo.asunto,
      ...(p.esTransferencia ? { esTransferencia: true } : {}),
      ...(p.clase
        ? {
            clase: p.clase,
            ...(p.comercio ? { comercio: p.comercio } : {}),
            ...(p.tarjetaFinal ? { tarjetaFinal: p.tarjetaFinal } : {}),
            ...(p.pagadoEn ? { pagadoEn: p.pagadoEn } : {}),
            ...(reconocido?.contraparteCuentaId ? { contraparteCuentaId: reconocido.contraparteCuentaId } : {}),
            ...(p.comision ? { comision: p.comision } : {}),
          }
        : {}),
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
  /** Lo que la base registró sola con estos correos (consumos, pagos de tarjeta, transferencias entre tus cuentas). */
  registrados?: AvisoRegistrado[];
  /** Avisos que quedan en la Bandeja para revisar. */
  porRevisar?: number;
}

const NOMBRE_CLASE: Record<ClaseAviso, [string, string]> = {
  consumo: ["consumo con tarjeta", "consumos con tarjeta"],
  pago_tarjeta: ["pago de tarjeta", "pagos de tarjeta"],
  transferencia: ["transferencia entre tus cuentas", "transferencias entre tus cuentas"],
};

/** «2 consumos con tarjeta y 1 pago de tarjeta» */
function describirRegistrados(registrados: AvisoRegistrado[]): string {
  const cuentas = (Object.keys(NOMBRE_CLASE) as ClaseAviso[])
    .map((clase) => [clase, registrados.filter((r) => r.clase === clase).length] as const)
    .filter(([, n]) => n > 0)
    .map(([clase, n]) => `${n} ${NOMBRE_CLASE[clase][n === 1 ? 0 : 1]}`);
  return cuentas.length > 1 ? `${cuentas.slice(0, -1).join(", ")} y ${cuentas[cuentas.length - 1]}` : (cuentas[0] ?? "");
}

/**
 * La notificación de un movimiento que se registró solo desde el correo:
 * «Registré $12,34 en TIENDA PRUEBA S A · Con tu tarjeta •••• 1234 · Comida». `ruta` es
 * la pantalla que abre al tocarla.
 */
export function textoNotificacionRegistrado(r: AvisoRegistrado): { titulo: string; cuerpo: string; ruta: string } {
  const monto = r.monto !== undefined ? formatMonto(r.monto) : "un movimiento";
  if (r.clase === "pago_tarjeta") {
    return {
      titulo: `Registré el pago de ${monto} a ${r.cuenta ?? "tu tarjeta"}`,
      cuerpo: r.otraCuenta ? `Pagado desde ${r.otraCuenta}. Ya subió el cupo de la tarjeta.` : "Ya subió el cupo de la tarjeta.",
      ruta: "/tarjetas",
    };
  }
  if (r.clase === "transferencia") {
    return {
      titulo: `Registré una transferencia de ${monto}`,
      cuerpo: `${r.cuenta ?? "Tu cuenta"} → ${r.otraCuenta ?? "otra cuenta tuya"}${r.comision ? ` · comisión ${formatMonto(r.comision)}` : ""}`,
      ruta: "/transferencias",
    };
  }
  const partes = [r.tarjeta ? `Con tu tarjeta •••• ${r.tarjeta}` : r.cuenta ? `Con ${r.cuenta}` : undefined, r.categoria].filter(Boolean);
  return {
    titulo: `Registré ${monto}${r.comercio ? ` en ${r.comercio}` : ""}`,
    cuerpo: partes.length ? partes.join(" · ") : "Desde el aviso de tu banco.",
    ruta: "/gastos",
  };
}

/** Texto para la persona con lo que pasó en la búsqueda. */
export function resumenSincronizacion(r: ResultadoSincronizacion): string {
  const nuevos = (r.registrados ?? []).filter((x) => x.resultado === "registrado");
  const partes: string[] = [];
  if (r.registrados === undefined) {
    partes.push(
      r.enviados === 0
        ? "No encontré movimientos nuevos que reconocer."
        : `Encontré ${r.enviados} movimiento(s) — revísalos en la Bandeja (si ya estaban, no se duplican).`
    );
  } else {
    if (nuevos.length > 0) partes.push(`Registré ${describirRegistrados(nuevos)}.`);
    if ((r.porRevisar ?? 0) > 0) partes.push(`${r.porRevisar} movimiento(s) esperan tu revisión en la Bandeja.`);
    if (nuevos.length === 0 && !(r.porRevisar ?? 0)) partes.push("No encontré movimientos nuevos que reconocer.");
  }
  if (r.descartados > 0) partes.push(`${r.descartados} aviso(s) tenían datos imposibles y se omitieron.`);
  if (r.truncado) partes.push(`Había más de ${TOPE_CORREOS} correos: se revisaron los más recientes.`);
  if (r.fallidos > 0) partes.push(`No se pudieron leer ${r.fallidos} correo(s); se volverán a intentar en la próxima búsqueda.`);
  return partes.join(" ");
}
