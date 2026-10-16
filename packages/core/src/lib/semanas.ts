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

const NOMBRES_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Nombre completo del mes a partir de "YYYY-MM". */
export function etiquetaMes(mesIso: string): string {
  const mesStr = mesIso.split("-")[1];
  return NOMBRES_MES[Number(mesStr) - 1] ?? mesIso;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * "YYYY-MM-DD" en la zona horaria del dispositivo. No usar
 * `toISOString().slice(0, 10)` para "hoy": eso es UTC, y en Ecuador (UTC-5)
 * después de las 19:00 ya devuelve el día siguiente.
 */
export function fechaLocal(fecha: Date = new Date()): string {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

/** "YYYY-MM" del mes actual en la zona horaria del dispositivo. */
export function mesLocal(fecha: Date = new Date()): string {
  return fechaLocal(fecha).slice(0, 7);
}

/**
 * Suma `meses` a una fecha "YYYY-MM-DD". Si el día no existe en el mes de
 * destino, se usa el último día de ese mes (31-ene + 1 = 28-feb), igual que
 * la base de datos: antes JavaScript lo desbordaba al 3 de marzo y la pantalla
 * anunciaba una fecha de primera cuota distinta de la guardada.
 */
export function sumarMeses(fechaIso: string, meses: number): string {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const ultimoDia = new Date(anio, mes - 1 + meses + 1, 0).getDate();
  return fechaLocal(new Date(anio, mes - 1 + meses, Math.min(dia, ultimoDia)));
}

/** Siguiente fecha de un recordatorio recurrente. */
export function siguienteFechaRecurrente(fechaIso: string, frecuencia: "semanal" | "mensual" | "anual"): string {
  if (frecuencia === "mensual") return sumarMeses(fechaIso, 1);
  if (frecuencia === "anual") return sumarMeses(fechaIso, 12);
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return fechaLocal(new Date(anio, mes - 1, dia + 7));
}

/** Mueve un mes "YYYY-MM" `delta` meses (positivo o negativo). */
export function moverMes(mesIso: string, delta: number): string {
  const [anioStr, mesStr] = mesIso.split("-");
  const fecha = new Date(Number(anioStr), Number(mesStr) - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

/** Los últimos `cantidad` meses (formato "YYYY-MM"), terminando en `mesIso` incluido, de más viejo a más nuevo. */
export function ultimosMeses(mesIso: string, cantidad = 6): string[] {
  const [anioStr, mesStr] = mesIso.split("-");
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const resultado: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(anio, mes - 1 - i, 1);
    resultado.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
  }
  return resultado;
}

/** Primer y último día de un mes "YYYY-MM" (para pedir el resumen de ese mes). */
export function rangoDelMes(mesIso: string): { desde: string; hasta: string } {
  const [anioStr, mesStr] = mesIso.split("-");
  const ultimoDia = new Date(Date.UTC(Number(anioStr), Number(mesStr), 0)).getUTCDate();
  return { desde: `${mesIso}-01`, hasta: `${mesIso}-${String(ultimoDia).padStart(2, "0")}` };
}
