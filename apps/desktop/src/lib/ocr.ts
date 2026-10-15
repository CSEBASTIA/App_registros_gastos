import { normalizarNumero, sugerirCategoria } from "core";

export interface ReciboExtraido {
  monto?: number;
  fecha?: string; // YYYY-MM-DD
  comercio?: string;
  categoriaSugerida?: string;
  textoCrudo: string;
}

/** Corre OCR local (tesseract.js, español) sobre una imagen de recibo/factura. */
export async function leerImagen(archivo: File): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const {
    data: { text },
  } = await recognize(archivo, "spa");
  return text;
}

function extraerMonto(texto: string): number | undefined {
  const lineas = texto.split("\n");
  const numeroRegex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))|(\d+[.,]\d{2})/g;

  // Prioridad: la línea que menciona "total".
  const lineaTotal = lineas.find((l) => /total/i.test(l));
  if (lineaTotal) {
    const encontrados = [...lineaTotal.matchAll(numeroRegex)].map((m) => normalizarNumero(m[0]));
    if (encontrados.length > 0) return Math.max(...encontrados);
  }

  // Si no, el número más grande de todo el texto (suele ser el total).
  const todos = [...texto.matchAll(numeroRegex)].map((m) => normalizarNumero(m[0]));
  if (todos.length === 0) return undefined;
  return Math.max(...todos);
}

function extraerFecha(texto: string): string | undefined {
  const isoDirecto = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoDirecto) {
    const [, anio, mes, dia] = isoDirecto;
    if (!fechaValida(Number(anio), Number(mes), Number(dia))) return undefined;
    return isoDirecto[0];
  }

  const conGuionOBarra = texto.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (conGuionOBarra) {
    const [, dia, mes, anioRaw] = conGuionOBarra;
    let anio = anioRaw;
    if (anio.length === 2) anio = `20${anio}`;
    if (!fechaValida(Number(anio), Number(mes), Number(dia))) return undefined;
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  return undefined;
}

function fechaValida(anio: number, mes: number, dia: number): boolean {
  if (anio < 1 || anio > 9999 || mes < 1 || mes > 12 || dia < 1) return false;

  const finDeMes = new Date(0);
  finDeMes.setUTCHours(0, 0, 0, 0);
  finDeMes.setUTCFullYear(anio, mes, 0);
  return dia <= finDeMes.getUTCDate();
}

function extraerComercio(texto: string): string | undefined {
  const primeraLinea = texto
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && /[a-zA-Z]/.test(l));
  return primeraLinea;
}

/** Parsea el texto crudo del OCR por reglas (regex/keywords). Nada de esto se guarda solo: el usuario siempre revisa/corrige antes de confirmar. */
export function parseRecibo(textoCrudo: string): ReciboExtraido {
  return {
    monto: extraerMonto(textoCrudo),
    fecha: extraerFecha(textoCrudo),
    comercio: extraerComercio(textoCrudo),
    categoriaSugerida: sugerirCategoria(textoCrudo),
    textoCrudo,
  };
}
