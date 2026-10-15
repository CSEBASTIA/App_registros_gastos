/**
 * Montos de dinero: leer lo que escribe la persona y sumar sin errores de
 * coma flotante (0.1 + 0.2 = 0.30000000000000004 → "−$0.00" y alertas falsas).
 */

/** Redondea a centavos. */
export function redondearCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Suma montos trabajando en centavos enteros: 100.30 − 50.10 − 50.20 da 0 exacto. */
export function sumarMontos(valores: number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;
}

/**
 * Interpreta un número escrito con cualquier convención: "12,50", "12.50",
 * "1.234,56", "1,234.56", "1234.56", "$ 1 234,5". El ÚLTIMO separador ("," o
 * ".") es de miles solo si lo siguen 3 dígitos y lo anterior es una
 * agrupación válida ("1.234" = 1234, "12.345.678"); si no, es el decimal
 * ("0,005" = 0.005, no 5). Devuelve NaN si el texto no es un número.
 */
export function interpretarNumero(texto: string): number {
  const limpio = texto.trim().replace(/usd/gi, "").replace(/[\s$]/g, "");
  if (!/^-?\d[\d.,]*$/.test(limpio) || /[.,]{2}/.test(limpio) || /[.,]$/.test(limpio)) return NaN;

  const negativo = limpio.startsWith("-");
  const cuerpo = negativo ? limpio.slice(1) : limpio;
  const ultimo = Math.max(cuerpo.lastIndexOf(","), cuerpo.lastIndexOf("."));

  let numero: number;
  if (ultimo === -1) {
    numero = Number(cuerpo);
  } else {
    const antes = cuerpo.slice(0, ultimo);
    const despues = cuerpo.slice(ultimo + 1);
    const esMiles = despues.length === 3 && /^[1-9]\d{0,2}(?:[.,]\d{3})*$/.test(antes);
    const entero = antes.replace(/[.,]/g, "");
    numero = esMiles ? Number(`${entero}${despues}`) : Number(`${entero}.${despues}`);
  }
  return negativo ? -numero : numero;
}

/**
 * Lo que escribió la persona en un campo de monto → número con 2 decimales,
 * o NaN si no es un monto válido. Usar en todas las pantallas en lugar de
 * `Number(texto)`, que convierte "12,50" (formato de Ecuador) en NaN.
 */
export function parsearMonto(texto: string): number {
  const numero = interpretarNumero(texto);
  return Number.isFinite(numero) ? redondearCentavos(numero) : NaN;
}
