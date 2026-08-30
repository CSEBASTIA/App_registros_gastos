export interface RangoSemana {
  numero: number;
  desde: number;
  hasta: number;
}

/**
 * Corte fijo por mes: Semana 1 = días 1-7, Semana 2 = 8-14, Semana 3 =
 * 15-21, Semana 4 = 22 hasta el último día del mes (se estira: 28/29/30/31
 * según el mes, sin una 5ta pestaña).
 */
export function semanasDelMes(mes: string): RangoSemana[] {
  const [anioStr, mesStr] = mes.split("-");
  const anio = Number(anioStr);
  const mesNum = Number(mesStr);
  const ultimoDia = new Date(anio, mesNum, 0).getDate();

  return [
    { numero: 1, desde: 1, hasta: 7 },
    { numero: 2, desde: 8, hasta: 14 },
    { numero: 3, desde: 15, hasta: 21 },
    { numero: 4, desde: 22, hasta: ultimoDia },
  ];
}

/** Extrae el día (1-31) de una fecha "YYYY-MM-DD". */
export function diaDelMes(fechaIso: string): number {
  return Number(fechaIso.slice(8, 10));
}

export function enRangoSemana(fechaIso: string, rango: RangoSemana): boolean {
  const dia = diaDelMes(fechaIso);
  return dia >= rango.desde && dia <= rango.hasta;
}
