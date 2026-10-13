/**
 * Heurísticas de texto compartidas por los tres lectores automáticos de la
 * app (OCR de recibo, estado de cuenta en PDF/imagen, y correo bancario):
 * normalizar números en formato latino y adivinar una categoría a partir
 * de palabras clave. Nada de esto reemplaza la revisión del usuario — cada
 * lector deja lo detectado en una cola para confirmar/corregir.
 */

/** "1.234,56" o "1234.56" -> 1234.56 */
export function normalizarNumero(valor: string): number {
  const limpio = valor.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  return Number(limpio);
}

/** Palabras clave del comercio/descripción → nombre de categoría sugerido (debe coincidir con el catálogo de `categorias`). */
export const PALABRAS_POR_CATEGORIA: Record<string, string[]> = {
  Comida: ["supermaxi", "megamaxi", "mi comisariato", "coral", "restaurante", "market", "food"],
  Transporte: ["uber", "cabify", "indriver", "taxi", "gasolina", "combustible", "peaje"],
  Ocio: ["netflix", "spotify", "cine", "cinemark", "supercines", "steam"],
  Servicios: ["cnel", "cnt", "movistar", "claro", "agua potable", "electricidad"],
};

export function sugerirCategoria(texto: string): string | undefined {
  const textoNormalizado = texto.toLowerCase();
  for (const [categoria, palabras] of Object.entries(PALABRAS_POR_CATEGORIA)) {
    if (palabras.some((palabra) => textoNormalizado.includes(palabra))) {
      return categoria;
    }
  }
  return undefined;
}
