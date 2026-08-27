import type { Deuda } from "../types/domain";

export type NivelEndeudamiento = "bajo" | "moderado" | "alto";

export interface Endeudamiento {
  totalPendiente: number;
  cuotasMensuales: number;
  /** Cuotas mensuales / ingreso mensual, en %. 0 si no hay ingreso registrado. */
  porcentaje: number;
  nivel: NivelEndeudamiento;
}

function nivelDe(porcentaje: number): NivelEndeudamiento {
  if (porcentaje >= 50) return "alto";
  if (porcentaje >= 30) return "moderado";
  return "bajo";
}

/**
 * Nivel de endeudamiento = cuotas mensuales de deudas activas / ingreso
 * mensual. Umbrales estándar: <30% bajo, 30-50% moderado, >50% alto.
 */
export function calcularEndeudamiento(deudas: Deuda[], ingresoMensual: number): Endeudamiento {
  const activas = deudas.filter((d) => d.saldoPendiente > 0);
  const totalPendiente = activas.reduce((acc, d) => acc + d.saldoPendiente, 0);
  const cuotasMensuales = activas.reduce((acc, d) => acc + d.cuotaMensual, 0);
  const porcentaje = ingresoMensual > 0 ? (cuotasMensuales / ingresoMensual) * 100 : 0;

  return { totalPendiente, cuotasMensuales, porcentaje, nivel: nivelDe(porcentaje) };
}
