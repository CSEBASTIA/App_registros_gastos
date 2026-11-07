import { getSupabaseClient } from "../client";
import { validarRango } from "../lib/paginacion";
import { resumenAnualDe, type ResumenAnual } from "../lib/resumenAnual";

export interface TotalMes {
  mes: string; // "YYYY-MM"
  totalGastos: number;
  totalIngresos: number;
}

/**
 * Totales de gastos e ingresos por mes entre dos fechas (incluidas), sumados
 * en la base: para gráficos y resúmenes no hace falta descargar todos los
 * movimientos. Devuelve también los meses sin movimientos, en 0. Máximo 10 años.
 */
export async function totalesPorMes(desde: string, hasta: string): Promise<TotalMes[]> {
  const rango = validarRango({ desde, hasta });
  const { data, error } = await getSupabaseClient().rpc("totales_por_mes", {
    p_desde: rango.desde!,
    p_hasta: rango.hasta!,
  });
  if (error) throw error;
  return (data ?? []).map((fila) => ({
    mes: fila.mes,
    totalGastos: Number(fila.total_gastos),
    totalIngresos: Number(fila.total_ingresos),
  }));
}

/**
 * Resumen de un año (por mes, por categoría y los comercios donde más se
 * gastó), sumado en la base. Incluye lo importado al historial.
 */
export async function obtenerResumenAnual(anio: number): Promise<ResumenAnual> {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new Error("Año inválido.");
  const { data, error } = await getSupabaseClient().rpc("resumen_anual", { p_anio: anio });
  if (error) throw error;
  return resumenAnualDe(data, anio);
}
