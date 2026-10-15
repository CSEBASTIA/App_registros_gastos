/**
 * Heurísticas de texto compartidas por los tres lectores automáticos de la
 * app (OCR de recibo, estado de cuenta en PDF/imagen, y correo bancario):
 * normalizar números en formato latino y adivinar una categoría a partir
 * de palabras clave. Nada de esto reemplaza la revisión del usuario — cada
 * lector deja lo detectado en una cola para confirmar/corregir.
 */

import { interpretarNumero } from "./montos";

/**
 * "1.234,56", "1,234.56" o "1234.56" -> 1234.56. Misma regla que
 * `parsearMonto`: el último separador es el decimal si lo siguen 1 o 2 dígitos.
 */
export function normalizarNumero(valor: string): number {
  return interpretarNumero(valor);
}

/** Palabras clave del comercio/descripción → nombre de categoría sugerido (debe coincidir con el catálogo de `categorias`). */
export const PALABRAS_POR_CATEGORIA: Record<string, string[]> = {
  Comida: ["supermaxi", "megamaxi", "mi comisariato", "coral", "restaurante", "market", "food"],
  Transporte: ["uber", "cabify", "indriver", "taxi", "gasolina", "combustible", "peaje"],
  Ocio: ["netflix", "spotify", "cine", "cinemark", "supercines", "steam", "teatro", "discoteca", "casino", "concierto"],
  Salud: ["farmacia", "farmacias", "fybeca", "sana sana", "cruz azul", "medico", "medica", "clinica", "hospital", "laboratorio clinico", "consultorio", "odontologo", "dentista", "medicamento"],
  Servicios: ["cnel", "cnt", "movistar", "claro", "agua potable", "electricidad"],
};

function textoSinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function sugerirCategoria(texto: string): string | undefined {
  const textoNormalizado = textoSinAcentos(texto);
  for (const [categoria, palabras] of Object.entries(PALABRAS_POR_CATEGORIA)) {
    if (palabras.some((palabra) => textoNormalizado.includes(textoSinAcentos(palabra)))) {
      return categoria;
    }
  }
  return undefined;
}

/** Clasificación solicitada para consumos importados: ocio, salud y un valor seguro para lo desconocido. */
export function clasificarConsumoEstadoCuenta(comercio: string): "Ocio" | "Salud" | "Otros" {
  const normalizado = ` ${textoSinAcentos(comercio).replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const categoria of ["Salud", "Ocio"] as const) {
    if (PALABRAS_POR_CATEGORIA[categoria].some((palabra) =>
      normalizado.includes(` ${textoSinAcentos(palabra).replace(/[^a-z0-9]+/g, " ")} `)
    )) return categoria;
  }
  return "Otros";
}
