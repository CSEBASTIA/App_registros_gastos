import type { Banco } from "../types/domain";
import { normalizarNumero, sugerirCategoria } from "./textoFinanciero";

/**
 * Dominios/direcciones de remitente conocidas de cada banco, para
 * identificar de qué banco vino un aviso transaccional.
 *
 * TODO: placeholder — completar con los remitentes reales en cuanto el
 * usuario comparta un correo real (redactado) de cada banco que use. Sin
 * esto, un correo no matcheado igual queda en la cola de revisión (con
 * `banco: undefined`), solo que el usuario tiene que elegir el banco/
 * cuenta a mano en vez de que la app lo adivine.
 */
export const REMITENTES_BANCO: Partial<Record<Banco, string[]>> = {
  // banco_guayaquil: ["notificaciones@bancoguayaquil.com"],
  // pichincha: ["bancapichincha@pichincha.com"],
  // produbanco: ["notificaciones@produbanco.com"],
  // diners_club: ["dinersclub@dinersclub.com.ec"],
};

const PALABRAS_GASTO =
  /\b(compra|consumo|d[eé]bito|retiro|pago\s+(?:realizado|enviado)|transferencia\s+(?:enviada|realizada)|env[ií]o\s+de\s+dinero)\b/i;
const PALABRAS_INGRESO =
  /\b(dep[oó]sito|abono\s+(?:recibido)?|acreditaci[oó]n|transferencia\s+recibida|pago\s+recibido|sueldo|rol\s+de\s+pagos)\b/i;

// Monto: dígitos con miles opcionales y 2 decimales — mismo criterio que estadoCuenta.ts.
const REGEX_MONTO = /\$?\s?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/;
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

function bancoDeRemitente(remitente: string): Banco | undefined {
  const direccion = remitente.toLowerCase();
  for (const [banco, direcciones] of Object.entries(REMITENTES_BANCO) as [Banco, string[]][]) {
    if (direcciones.some((d) => direccion.includes(d.toLowerCase()))) return banco;
  }
  return undefined;
}

function extraerFecha(texto: string): string | undefined {
  const iso = texto.match(REGEX_FECHA_ISO);
  if (iso) return iso[0];
  const dmy = texto.match(REGEX_FECHA_DMY);
  if (dmy) {
    const [, dia, mes, anioRaw] = dmy;
    const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;
    const mesNum = Number(mes);
    const diaNum = Number(dia);
    if (mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
      return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    }
  }
  return undefined;
}

/**
 * Heurística de asunto + palabras clave: no distingue perfecto (un correo
 * de "pago recibido" de una tarjeta ajena podría no ser un ingreso propio),
 * así que esto siempre pasa por la cola de revisión — nunca se guarda solo.
 */
function tipoDeCorreo(texto: string): "gasto" | "ingreso" | undefined {
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
