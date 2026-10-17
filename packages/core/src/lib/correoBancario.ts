import type { Banco } from "../types/domain";
import { normalizarNumero, sugerirCategoria } from "./textoFinanciero";
import { fechaIso } from "../schemas/limites";

/**
 * Direcciones desde las que cada banco envía avisos de movimientos, para saber
 * de qué banco vino un aviso. Salieron de una bandeja real (16-oct-2026; solo
 * se miraron remitente y asunto, nunca montos ni datos personales).
 *
 * Son direcciones EXACTAS y no dominios, a propósito: el mismo dominio manda
 * también publicidad (info@email.bancoguayaquil.com, comunicados@pichincha.com)
 * y avisos de ingreso a la banca (logininfo@pichincha.com) que no son
 * movimientos y no deben quedar atribuidos al banco.
 *
 * Sin muestras todavía: Produbanco, Diners Club y Banco del Austro. Un aviso
 * de un remitente que no está aquí igual llega a la Bandeja (con
 * `banco: undefined`); la persona elige banco y cuenta a mano.
 */
export const REMITENTES_BANCO: Partial<Record<Banco, string[]>> = {
  pichincha: ["banco@pichincha.com"],
  banco_guayaquil: ["bancoguayaquil@bancoguayaquil.com", "bancavirtual@bancoguayaquil.com"],
  banco_pacifico: ["intermail@bancopacifico.ec"],
};

const PALABRAS_GASTO =
  /\b(compra|consumo|d[eé]bito|retiro|pago\s+(?:realizado|enviado)|transferencia\s+(?:enviada|realizada)|env[ií]o\s+de\s+dinero)\b/i;
const PALABRAS_INGRESO =
  /\b(dep[oó]sito|abono\s+(?:recibido)?|acreditaci[oó]n|transferencia\s+recibida|pago\s+recibido|has\s+recibido\s+dinero|sueldo|rol\s+de\s+pagos)\b/i;

// Monto con 2 decimales, con o sin separador de miles ("1.234,56", "1,234.56",
// "1234.56"). Debe empezar al inicio o tras algo que no sea dígito ni separador:
// sin esa condición, "$1234.56" se leía como 234.56.
const REGEX_MONTO = /(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?!\d)/;
// Pago a la tarjeta propia: es una salida de dinero, no un ingreso (aunque diga "abono").
const PAGO_A_TARJETA = /\b(?:(?:abono|pago)\s+(?:a|de)\s+(?:tu|su)\s+tarjeta|pago\s+tarjeta\s+propia)\b/i;
const REGEX_FECHA_DMY = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
const REGEX_FECHA_ISO = /(\d{4})-(\d{2})-(\d{2})/;
// "cuenta ****1234" / "tarjeta terminada en 5678" / "cta. 1234"
const REGEX_IDENTIFICADOR = /(?:cuenta|tarjeta|cta\.?)[^\d]{0,18}(\d{3,4})\b/i;

export interface CorreoParseado {
  tipo: "gasto" | "ingreso" | undefined;
  monto: number | undefined;
  fecha: string | undefined;
  descripcion: string;
  banco: Banco | undefined;
  identificadorCuenta: string | undefined;
  categoriaSugerida: string | undefined;
}

/** "Banco X <avisos@banco.com>" → "avisos@banco.com". Se usa la dirección real, nunca el nombre visible. */
function direccionDe(remitente: string): string {
  const entreAngulos = remitente.match(/<([^>]+)>/);
  return (entreAngulos ? entreAngulos[1] : remitente).trim().toLowerCase();
}

/**
 * Coincidencia estricta para que un remitente falso no pase por banco:
 * con "@" se exige la dirección exacta; sin "@" se exige el dominio exacto
 * o un subdominio suyo. Antes se usaba `includes`, que aceptaba por ejemplo
 * "avisos@bancoguayaquil.com.estafa.net".
 * (No reemplaza una verificación DKIM/SPF: un From falsificado con el
 * dominio real seguiría pasando; por eso todo va a revisión humana.)
 */
function remitenteCoincide(direccion: string, patron: string): boolean {
  const p = patron.trim().toLowerCase();
  if (p.includes("@")) return direccion === p;
  const dominio = direccion.split("@")[1] ?? "";
  return dominio === p || dominio.endsWith(`.${p}`);
}

export function bancoDeRemitente(
  remitente: string,
  remitentes: Partial<Record<Banco, string[]>> = REMITENTES_BANCO
): Banco | undefined {
  const direccion = direccionDe(remitente);
  for (const [banco, patrones] of Object.entries(remitentes) as [Banco, string[]][]) {
    if (patrones.some((p) => remitenteCoincide(direccion, p))) return banco;
  }
  return undefined;
}

/**
 * Solo devuelve fechas que existen en el calendario. Una fecha imposible
 * ("2026-02-30", "31/02/2026") hacía fallar el lote entero al guardarse y
 * bloqueaba la sincronización para siempre; ahora se ignora y se usa la
 * fecha de recepción del correo.
 */
function extraerFecha(texto: string): string | undefined {
  const iso = texto.match(REGEX_FECHA_ISO);
  if (iso && fechaIso().safeParse(iso[0]).success) return iso[0];
  const dmy = texto.match(REGEX_FECHA_DMY);
  if (dmy) {
    const [, dia, mes, anioRaw] = dmy;
    const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;
    const fecha = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    if (fechaIso().safeParse(fecha).success) return fecha;
  }
  return undefined;
}

/**
 * Heurística de asunto + palabras clave: no distingue perfecto (un correo
 * de "pago recibido" de una tarjeta ajena podría no ser un ingreso propio),
 * así que esto siempre pasa por la cola de revisión — nunca se guarda solo.
 */
function tipoDeCorreo(texto: string): "gasto" | "ingreso" | undefined {
  if (PAGO_A_TARJETA.test(texto)) return "gasto";
  if (PALABRAS_INGRESO.test(texto)) return "ingreso";
  if (PALABRAS_GASTO.test(texto)) return "gasto";
  return undefined;
}

/**
 * Intenta extraer una transacción de un correo bancario. Nunca lanza si no
 * encuentra algo — devuelve lo que pudo, con el resto en `undefined` para
 * que el usuario lo complete en la pantalla de revisión ("Bandeja").
 */
export function parsearCorreoBancario(remitente: string, asunto: string, cuerpoTexto: string): CorreoParseado {
  const texto = `${asunto}\n${cuerpoTexto}`;

  const matchMonto = texto.match(REGEX_MONTO);
  const monto = matchMonto ? Math.abs(normalizarNumero(matchMonto[1])) : undefined;

  const matchId = texto.match(REGEX_IDENTIFICADOR);

  return {
    tipo: tipoDeCorreo(texto),
    monto: monto && monto > 0 && monto < 1_000_000 ? monto : undefined,
    fecha: extraerFecha(texto),
    descripcion: asunto.trim() || "Movimiento bancario",
    banco: bancoDeRemitente(remitente),
    identificadorCuenta: matchId ? matchId[1] : undefined,
    categoriaSugerida: sugerirCategoria(texto),
  };
}

/** Quita etiquetas HTML de un cuerpo de correo (Graph entrega el body como HTML) y colapsa espacios. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
