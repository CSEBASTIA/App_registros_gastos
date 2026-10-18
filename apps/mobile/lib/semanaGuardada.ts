// Gastos se abre en la semana de hoy. Si se acaba de guardar un gasto de otra
// semana (o de otro mes), al volver muestra esa semana: antes el gasto quedaba
// en una semana que no se estaba viendo y parecía que no se había guardado.
let fechaPendiente: string | null = null;

/** Después de crear o editar un gasto, con su fecha "YYYY-MM-DD". */
export function recordarFechaGuardada(fecha: string): void {
  fechaPendiente = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null;
}

/** La fecha del último gasto guardado, una sola vez (después vuelve a ser null). */
export function tomarFechaGuardada(): string | null {
  const fecha = fechaPendiente;
  fechaPendiente = null;
  return fecha;
}
