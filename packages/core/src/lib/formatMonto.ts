/**
 * `${valor.toFixed(2)}` antepone el signo "$" antes que el "-" para valores
 * negativos, dando "$-921.70" en vez de "-$921.70". Se nota sobre todo en el
 * saldo disponible de cuentas (que sí puede quedar negativo, ej. Efectivo
 * sobregirado). Esta función pone el signo antes del símbolo de moneda.
 */
export function formatMonto(valor: number): string {
  const signo = valor < 0 ? "-" : "";
  return `${signo}$${Math.abs(valor).toFixed(2)}`;
}
