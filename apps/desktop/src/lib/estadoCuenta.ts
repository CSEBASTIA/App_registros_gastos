import { recognize } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
// Vite resuelve esto a una URL del archivo del worker (necesario para que pdf.js corra fuera del hilo principal).
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { normalizarNumero, sugerirCategoria } from "./ocr";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface TransaccionExtraida {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  monto: number;
  categoriaSugerida?: string;
  /** true si el texto sugiere que es un pago/abono/reembolso y no un consumo (se pre-desmarca en la revisión). */
  posiblePago: boolean;
}

/**
 * Lee el texto crudo de un estado de cuenta: si es PDF se extrae la capa de
 * texto (pdf.js); si es imagen se corre OCR local (tesseract.js), igual que
 * con un recibo individual.
 */
export async function leerEstadoCuenta(archivo: File): Promise<string> {
  const esPdf = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
  if (esPdf) return leerTextoPdf(archivo);

  const {
    data: { text },
  } = await recognize(archivo, "spa");
  return text;
}

async function leerTextoPdf(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lineas: string[] = [];

  for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
    const pagina = await pdf.getPage(numPagina);
    const contenido = await pagina.getTextContent();

    // pdf.js entrega fragmentos de texto sueltos con su posición (x, y), no
    // líneas ya armadas: hay que agruparlos por coordenada Y (misma línea
    // visual) y ordenarlos por X para reconstruir el texto en orden de lectura.
    const items = contenido.items
      .filter((it): it is TextItem => "str" in it && "transform" in it && it.str.trim().length > 0)
      .map((it) => ({ texto: it.str, x: it.transform[4], y: it.transform[5] }));

    const porLinea = new Map<number, typeof items>();
    for (const item of items) {
      const claveY = Math.round(item.y / 2) * 2; // tolerancia de 2pt para variaciones menores de baseline
      const grupo = porLinea.get(claveY);
      if (grupo) grupo.push(item);
      else porLinea.set(claveY, [item]);
    }

    const lineasPagina = [...porLinea.entries()]
      .sort((a, b) => b[0] - a[0]) // de arriba hacia abajo (Y decreciente en coordenadas PDF)
      .map(([, grupo]) =>
        grupo
          .sort((a, b) => a.x - b.x)
          .map((it) => it.texto)
          .join(" ")
      );

    lineas.push(...lineasPagina);
  }

  return lineas.join("\n");
}

const PALABRAS_IGNORAR =
  /^(saldo|total|subtotal|p[aá]gina|resumen|cupo|l[ií]mite|disponible|fecha de corte|fecha corte|pr[oó]ximo|intereses?\s+(a|del|de)|tasa)/i;
const PALABRAS_PAGO = /pago\s+(recibido|realizado)|abono|reembolso|reverso|cr[eé]dito\s+por|devoluci[oó]n/i;

const REGEX_FECHA_DMY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
const REGEX_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})\b/;
const REGEX_FECHA_DM = /^(\d{1,2})[/-](\d{1,2})\b/;
// Un monto de estado de cuenta: dígitos con miles opcionales y SIEMPRE 2 decimales
// (evita confundir números de local/página, que no traen decimales, con montos).
const REGEX_MONTO = /([-+]?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/;

function extraerFechaInicio(linea: string): { iso: string; longitud: number } | undefined {
  let m = linea.match(REGEX_FECHA_ISO);
  if (m) return { iso: m[0], longitud: m[0].length };

  m = linea.match(REGEX_FECHA_DMY);
  if (m) {
    const [, dia, mes, anioRaw] = m;
    const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;
    const mesNum = Number(mes);
    const diaNum = Number(dia);
    if (mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
      return { iso: `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`, longitud: m[0].length };
    }
  }

  // Sin año (frecuente en detalle de consumos de tarjeta): se asume el año actual;
  // el usuario puede corregirlo en la revisión antes de importar.
  m = linea.match(REGEX_FECHA_DM);
  if (m) {
    const [, dia, mes] = m;
    const mesNum = Number(mes);
    const diaNum = Number(dia);
    if (mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
      const anio = new Date().getFullYear();
      return { iso: `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`, longitud: m[0].length };
    }
  }

  return undefined;
}

/**
 * Parsea el texto crudo (de PDF o de OCR) buscando líneas con forma de
 * transacción: "fecha  descripción  monto[  saldo]". Es una heurística por
 * reglas — nada se guarda solo, el usuario revisa/desmarca/corrige cada fila
 * antes de confirmar la importación.
 */
export function parseEstadoCuenta(texto: string): TransaccionExtraida[] {
  const resultado: TransaccionExtraida[] = [];

  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const linea of lineas) {
    const fecha = extraerFechaInicio(linea);
    if (!fecha) continue;

    const resto = linea.slice(fecha.longitud).trim();
    if (!resto || PALABRAS_IGNORAR.test(resto)) continue;

    const matchMonto = resto.match(REGEX_MONTO);
    if (!matchMonto || matchMonto.index === undefined) continue;

    // El primer número con decimales tras la descripción es el monto de la
    // transacción; si la línea trae también el saldo corriente después, se ignora.
    const descripcion = resto
      .slice(0, matchMonto.index)
      .trim()
      .replace(/[-–|]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (descripcion.length < 2) continue;

    const monto = Math.abs(normalizarNumero(matchMonto[0].replace(/[$\s]/g, "")));
    if (!monto || monto <= 0 || monto > 999_999) continue;

    resultado.push({
      fecha: fecha.iso,
      descripcion,
      monto,
      categoriaSugerida: sugerirCategoria(descripcion),
      posiblePago: PALABRAS_PAGO.test(descripcion),
    });
  }

  return resultado;
}
