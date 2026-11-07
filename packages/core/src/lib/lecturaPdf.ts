/**
 * Qué hacer con un PDF que la persona sube o que llega por el correo o desde
 * otra app: si es un estado de cuenta, de qué cuenta o tarjeta es (banco y
 * últimos dígitos); si es un comprobante suelto (factura, recibo, comprobante
 * de transferencia), el monto, la fecha y el comercio para proponer un gasto.
 * Nada de esto guarda: la persona revisa y confirma.
 */
import type { Banco, Cuenta } from "../types/domain";
import { cuentaPorDigitos } from "./sincronizacionCorreo";
import { fechaDeTexto } from "./estadoCuenta";
import { normalizarNumero, sugerirCategoria } from "./textoFinanciero";
import { fechaLocal } from "./semanas";
import { ETIQUETA_BANCO } from "./marcas";

/** La cabecera de un estado de cuenta: aquí van el banco y el número de la cuenta (no en los movimientos). */
const LINEAS_CABECERA = 40;

const ES_TARJETA = /\b(cupo|pago\s+m[ií]nimo|fecha\s+m[aá]xima\s+de\s+pago|tarjeta\s+de\s+cr[eé]dito|total\s+a\s+pagar)\b/i;
const ES_ESTADO = /\b(estado\s+de\s+(?:cuenta|cta)|detalle\s+de\s+movimientos|movimientos\s+del\s+per[ií]odo|saldo\s+anterior)\b/i;

// Nombres que solo usa un banco: «BANCO PICHINCHA C.A.», «Banco de Guayaquil», «PRODUBANCO»…
const BANCOS_EN_TEXTO: [Banco, RegExp][] = [
  ["pichincha", /\bbanco\s+pichincha\b|\bpichincha\s+c\.?\s?a\b/i],
  ["banco_guayaquil", /\bbanco\s+(?:de\s+)?guayaquil\b/i],
  ["banco_pacifico", /\bbanco\s+(?:del\s+)?pac[ií]fico\b/i],
  ["produbanco", /\bprodubanco\b/i],
  ["diners_club", /\bdiners\s+club\b/i],
  ["banco_austro", /\bbanco\s+del\s+austro\b/i],
];

// «CUENTA 1234567890», «Cuenta No.: 1234», «TARJETA XXXX-XXXX-XXXX-1234», «tarjeta terminada en 1234».
const NUMERO_PRODUCTO = /\b(?:cuenta|cta|tarjeta)\b[^\dXx*•\n]{0,24}((?:[\dXx*•][ -]?){4,24})/giu;

export interface CuentaDelEstado {
  /** La cuenta de la app a la que corresponde, si se reconoce con seguridad. */
  cuentaId?: string;
  banco?: Banco;
  /** Últimos 4 dígitos que imprime el estado. */
  digitos?: string;
  /** Habla de cupo, pago mínimo…: es de una tarjeta de crédito. */
  esTarjeta: boolean;
}

function bancoDelTexto(texto: string): Banco | undefined {
  return BANCOS_EN_TEXTO.find(([, regex]) => regex.test(texto))?.[0];
}

function digitosDelTexto(texto: string): string | undefined {
  for (const m of texto.matchAll(NUMERO_PRODUCTO)) {
    const digitos = m[1].replace(/\D/g, "");
    // Debe terminar en dígitos (no «XXXX-XXXX») y traer al menos 4.
    if (digitos.length >= 4 && /\d[ -]?$/.test(m[1])) return digitos.slice(-4);
  }
  return undefined;
}

const terminaEn = (identificador: string, digitos: string) => {
  const [corto, largo] = identificador.length <= digitos.length ? [identificador, digitos] : [digitos, identificador];
  return corto.length >= 2 && largo.endsWith(corto);
};

/**
 * De qué cuenta o tarjeta es un estado de cuenta: el banco y los últimos
 * dígitos que imprime la cabecera. Solo se elige una cuenta cuando no hay
 * duda (la misma regla que el correo); si no, la persona la elige.
 */
export function cuentaDelEstado(texto: string, cuentas: Cuenta[]): CuentaDelEstado {
  const cabecera = texto.split(/\r?\n/).slice(0, LINEAS_CABECERA).join("\n");
  const banco = bancoDelTexto(cabecera);
  const digitos = digitosDelTexto(cabecera);
  const esTarjeta = ES_TARJETA.test(texto);
  const tipos: Cuenta["tipo"][] = esTarjeta ? ["credito"] : ["ahorro", "debito"];
  let cuentaId = banco ? cuentaPorDigitos(cuentas, banco, digitos, tipos) : undefined;
  if (!cuentaId && digitos) {
    // Sin banco reconocido: basta que una sola cuenta lleve esos dígitos.
    const coinciden = cuentas.filter((c) => tipos.includes(c.tipo) && c.identificador && terminaEn(c.identificador, digitos));
    if (coinciden.length === 1) cuentaId = coinciden[0].id;
  }
  return { cuentaId, banco, digitos, esTarjeta };
}

/** El texto se presenta como un estado de cuenta (no como una factura o un recibo). */
export function pareceEstadoDeCuenta(texto: string): boolean {
  return ES_ESTADO.test(texto);
}

export interface ComprobanteLeido {
  monto?: number;
  fecha?: string;
  comercio?: string;
  /** Nombre de categoría del catálogo («Comida», «Salud»…), si las palabras lo sugieren. */
  categoriaSugerida?: string;
}

const MONTO = /(?:^|[\s:($])(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?!\d)/g;
// Del más seguro al menos seguro. «Subtotal», «total descuento», «total IVA» no son lo pagado.
const LINEAS_TOTAL = [
  /\b(?:valor|importe)\s+total\b|\btotal\s+a\s+pagar\b|\btotal\s+pagado\b/i,
  /\bmonto\s*(?:total|debitado|transferido|pagado|de\s+la\s+transacci[oó]n)?\b|\bvalor\s+(?:debitado|transferido|pagado)\b/i,
  /(?<!sub)\btotal\b(?!\s+(?:sin|descuento|iva|ice|items?|art[ií]culos|unidades|cantidad))/i,
];
const LINEA_FECHA_PAGO = /\bfecha\s*(?:de\s+|del\s+)?(?:emisi[oó]n|transacci[oó]n|pago|operaci[oó]n|consumo|compra)\b/i;
const LINEA_FECHA = /\bfecha\b/i;
// Fechas que no son la del pago: la autorización del SRI, el vencimiento, la impresión.
const FECHA_AJENA = /autorizaci[oó]n|vencimiento|caducidad|corte|nacimiento|impresi[oó]n|generado/i;
const LINEA_COMERCIO = /\b(?:beneficiario|comercio|establecimiento|pagado\s+a|nombre\s+comercial)\b\s*:?\s*(.{3,80})/i;
// Líneas de la cabecera de una factura que no son el nombre del comercio.
const NO_ES_COMERCIO = /\b(factura|r\.?\s?u\.?\s?c|n[uú]mero|no\.|autorizaci[oó]n|ambiente|emisi[oó]n|clave|p[aá]gina|comprobante|fecha|documento|obligado|contribuyente|direcci[oó]n|matriz|sucursal|tel[eé]fono|correo)\b/i;

function montosDe(linea: string): number[] {
  return [...linea.matchAll(MONTO)].map((m) => normalizarNumero(m[1])).filter((n) => Number.isFinite(n) && n >= 0.01 && n <= 999_999);
}

/**
 * Monto, fecha y comercio de un comprobante suelto (factura electrónica del
 * SRI, recibo, comprobante de transferencia). Si algo no se lee, queda vacío
 * y la persona lo completa.
 */
export function parsearComprobante(texto: string, hoy: string = fechaLocal()): ComprobanteLeido {
  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  let monto: number | undefined;
  for (const regla of LINEAS_TOTAL) {
    // La última línea que lo dice: en una factura el total va al final.
    const linea = [...lineas].reverse().find((l) => regla.test(l) && montosDe(l).length > 0);
    if (linea) {
      const montos = montosDe(linea);
      monto = montos[montos.length - 1];
      break;
    }
  }

  const candidatas = lineas.filter((l) => !FECHA_AJENA.test(l));
  const conFecha =
    candidatas.find((l) => LINEA_FECHA_PAGO.test(l) && fechaDeTexto(l, hoy)) ??
    candidatas.find((l) => LINEA_FECHA.test(l) && fechaDeTexto(l, hoy));
  let fecha = fechaDeTexto(conFecha ?? candidatas.join("\n"), hoy);
  if (fecha && fecha > hoy) fecha = undefined; // un comprobante no es del futuro

  const nombrado = lineas.map((l) => l.match(LINEA_COMERCIO)?.[1]?.trim()).find((c) => c && /\p{L}{2}/u.test(c));
  const primera = lineas
    .slice(0, 12)
    .find((l) => /\p{L}{3}/u.test(l) && !NO_ES_COMERCIO.test(l) && montosDe(l).length === 0 && !fechaDeTexto(l, hoy));
  const comercio = (nombrado ?? primera)?.slice(0, 80);

  return {
    ...(monto !== undefined ? { monto } : {}),
    ...(fecha ? { fecha } : {}),
    ...(comercio ? { comercio } : {}),
    ...(comercio && sugerirCategoria(comercio) ? { categoriaSugerida: sugerirCategoria(comercio) } : {}),
  };
}

/** Lo que el estado de cuenta permite llenar de una cuenta nueva; la persona lo revisa antes de crearla. */
export interface PropuestaCuentaNueva {
  nombre: string;
  tipo: "credito" | "ahorro";
  banco: Banco;
  identificador?: string;
  /** Solo tarjetas: el cupo total que imprime el estado, si lo trae. */
  cupoTotal?: number;
  /**
   * Con qué saldo empieza la cuenta para que, al importar los movimientos,
   * termine como dice el estado: el saldo anterior (cuenta) o el cupo menos la
   * deuda anterior (tarjeta). Undefined si el estado no lo dice.
   */
  disponible?: number;
}

// «CUPO TOTAL 2.500,00», «Cupo autorizado: $1500», «Límite de crédito 3,000.00».
const CUPO_TOTAL = /\b(?:cupo\s+(?:total|autorizado|asignado|aprobado)|l[ií]mite\s+de\s+cr[eé]dito)\b\s*:?\s*(?:usd|us\$|\$)?\s*(\d[\d.,]*\d)/i;

function cupoDelTexto(texto: string): number | undefined {
  const m = texto.match(CUPO_TOTAL);
  const n = m ? normalizarNumero(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Los datos de la cuenta o tarjeta nueva que se crea desde su estado de
 * cuenta, cuando todavía no está en la app (al empezar a usarla).
 */
export function propuestaCuentaDelEstado(
  texto: string,
  detectada: CuentaDelEstado,
  saldoAnterior?: number,
): PropuestaCuentaNueva {
  const banco = detectada.banco ?? "otro";
  const tipo = detectada.esTarjeta ? "credito" : "ahorro";
  const base = banco === "otro" ? (detectada.esTarjeta ? "Tarjeta" : "Cuenta") : ETIQUETA_BANCO[banco];
  const nombre = (detectada.digitos ? `${base} ${detectada.digitos}` : base).slice(0, 60);
  const identificador = detectada.digitos ? { identificador: detectada.digitos } : {};

  if (tipo === "credito") {
    const cupoTotal = cupoDelTexto(texto);
    const disponible =
      cupoTotal !== undefined ? Math.round((cupoTotal - Math.max(0, saldoAnterior ?? 0)) * 100) / 100 : undefined;
    return {
      nombre, tipo, banco, ...identificador,
      ...(cupoTotal !== undefined ? { cupoTotal } : {}),
      ...(disponible !== undefined ? { disponible } : {}),
    };
  }
  // Una cuenta no empieza en negativo: si el estado dice lo contrario, que la persona lo escriba.
  const disponible = saldoAnterior !== undefined && saldoAnterior >= 0 ? saldoAnterior : undefined;
  return { nombre, tipo, banco, ...identificador, ...(disponible !== undefined ? { disponible } : {}) };
}
