/**
 * Fechas de corte y de pago de una tarjeta. Trabaja con fechas "YYYY-MM-DD"
 * (sin horas ni zonas horarias). Un día 31 en un mes de 30 días, o un 29 en
 * febrero, es el último día de ese mes, como hacen los bancos.
 */

function partes(fechaIso: string): [number, number, number] {
  const [a, m, d] = fechaIso.split("-").map(Number);
  return [a, m, d];
}

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** La fecha del día `dia` en ese mes (1-12), recortada al último día. */
export function fechaDelDia(anio: number, mes: number, dia: number): string {
  // Normaliza meses fuera de rango (13 → enero del año siguiente).
  const base = new Date(Date.UTC(anio, mes - 1, 1));
  const a = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = Math.min(dia, ultimoDiaDelMes(a, m));
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Días de `desde` a `hasta` (negativo si `hasta` es antes). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/**
 * La fecha de corte del estado de cuenta en el que aparece un gasto: si se
 * hizo hasta el día de corte (inclusive), entra en el corte de ese mes; si se
 * hizo después, en el del mes siguiente.
 */
export function corteDeGasto(fechaGasto: string, diaCorte: number): string {
  const [a, m, d] = partes(fechaGasto);
  const corteDelMes = fechaDelDia(a, m, diaCorte);
  return d <= Number(corteDelMes.slice(8)) ? corteDelMes : fechaDelDia(a, m + 1, diaCorte);
}

/** El día de corte anterior a `corte` (inicio del ciclo, sin incluirlo). */
export function cortePrevio(corte: string, diaCorte: number): string {
  const [a, m] = partes(corte);
  return fechaDelDia(a, m - 1, diaCorte);
}

/** La fecha máxima de pago de un corte: el primer `diaPago` después del corte. */
export function pagoDeCorte(corte: string, diaPago: number): string {
  const [a, m] = partes(corte);
  const mismoMes = fechaDelDia(a, m, diaPago);
  return mismoMes > corte ? mismoMes : fechaDelDia(a, m + 1, diaPago);
}

export interface CicloTarjeta {
  /** Fecha de corte del ciclo actual (el próximo corte, o hoy si corta hoy). */
  corte: string;
  diasHastaCorte: number;
  /** Primer día del ciclo actual (el día siguiente al corte anterior). */
  inicio: string;
  /** Fecha máxima de pago de ESTE corte, si se conoce el día de pago. */
  pago?: string;
  diasHastaPago?: number;
}

/** El ciclo en curso de una tarjeta, visto desde `hoy`. */
export function cicloTarjeta(diaCorte: number, hoy: string, diaPago?: number): CicloTarjeta {
  const corte = corteDeGasto(hoy, diaCorte);
  const anterior = cortePrevio(corte, diaCorte);
  const [a, m, d] = partes(anterior);
  const inicio = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  const ciclo: CicloTarjeta = { corte, diasHastaCorte: diasEntre(hoy, corte), inicio };
  if (diaPago) {
    ciclo.pago = pagoDeCorte(corte, diaPago);
    ciclo.diasHastaPago = diasEntre(hoy, ciclo.pago);
  }
  return ciclo;
}

export interface PagoQueToca {
  /** El corte cuyo pago toca (el último si todavía no venció, o el del ciclo en curso). */
  corte: string;
  pago: string;
  diasHastaPago: number;
}

/**
 * El pago que toca hacer, visto desde `hoy`: el del último corte si todavía no
 * venció (corte el 15, pago el 1: el 20 de octubre toca pagar el 1 de
 * noviembre lo del corte del 15 de octubre, no el 1 de diciembre); si ya
 * venció, el del corte en curso.
 */
export function pagoQueToca(diaCorte: number, diaPago: number, hoy: string): PagoQueToca {
  const corteEnCurso = corteDeGasto(hoy, diaCorte);
  const ultimoCorte = cortePrevio(corteEnCurso, diaCorte);
  const pagoUltimo = pagoDeCorte(ultimoCorte, diaPago);
  const [corte, pago] = pagoUltimo >= hoy ? [ultimoCorte, pagoUltimo] : [corteEnCurso, pagoDeCorte(corteEnCurso, diaPago)];
  return { corte, pago, diasHastaPago: diasEntre(hoy, pago) };
}

/** "hoy", "mañana" o "en N días". */
export function textoDias(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}
