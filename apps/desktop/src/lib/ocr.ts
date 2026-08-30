import { recognize } from "tesseract.js";

export interface ReciboExtraido {
  monto?: number;
  fecha?: string; // YYYY-MM-DD
  comercio?: string;
  categoriaSugerida?: string;
  textoCrudo: string;
}

/** Palabras clave del comercio → nombre de categoría sugerido (debe coincidir con el catálogo de `categorias`). */
const PALABRAS_POR_CATEGORIA: Record<string, string[]> = {
  Comida: ["supermaxi", "megamaxi", "mi comisariato", "coral", "restaurante", "market", "food"],
  Transporte: ["uber", "cabify", "indriver", "taxi", "gasolina", "combustible", "peaje"],
  Ocio: ["netflix", "spotify", "cine", "cinemark", "supercines", "steam"],
  Servicios: ["cnel", "cnt", "movistar", "claro", "agua potable", "electricidad"],
};

/** Corre OCR local (tesseract.js, español) sobre una imagen de recibo/factura. */
export async function leerImagen(archivo: File): Promise<string> {
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

export function normalizarNumero(valor: string): number {
  // "1.234,56" o "1234.56" -> 1234.56
  const limpio = valor.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  return Number(limpio);
}

function extraerFecha(texto: string): string | undefined {
  const conGuionOBarra = texto.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (conGuionOBarra) {
    let [, dia, mes, anio] = conGuionOBarra;
    if (anio.length === 2) anio = `20${anio}`;
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  const isoDirecto = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoDirecto) return isoDirecto[0];
  return undefined;
}

function extraerComercio(texto: string): string | undefined {
  const primeraLinea = texto
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && /[a-zA-Z]/.test(l));
  return primeraLinea;
}

export function sugerirCategoria(texto: string): string | undefined {
  const textoNormalizado = texto.toLowerCase();
  for (const [categoria, palabras] of Object.entries(PALABRAS_POR_CATEGORIA)) {
    if (palabras.some((palabra) => textoNormalizado.includes(palabra))) {
      return categoria;
    }
  }
  return undefined;
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
