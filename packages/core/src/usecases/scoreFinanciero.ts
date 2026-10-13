import type { Cuenta, Recordatorio } from "../types/domain";
import type { Endeudamiento } from "./calcularEndeudamiento";

export interface ScoreFinanciero {
  /** 0-100. */
  total: number;
  etiqueta: "critico" | "regular" | "bueno" | "excelente";
  /** Puntos de cada componente (máximo entre paréntesis). */
  detalle: {
    endeudamiento: number; // 35
    ahorro: number; // 30
    cupo: number; // 20
    recordatorios: number; // 15
  };
}

export interface ParametrosScore {
  endeudamiento: Endeudamiento;
  ingresosMes: number;
  gastosMes: number;
  cuentas: Cuenta[];
  recordatorios: Recordatorio[];
  /** YYYY-MM-DD de hoy, para decidir qué recordatorios ya vencieron. */
  hoy: string;
}

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Score 0-100: endeudamiento (35), tasa de ahorro (30), uso de cupo de
 * tarjetas (20) y cumplimiento de recordatorios (15). Sin datos en un
 * componente, recibe la mitad de sus puntos (neutral).
 */
export function scoreFinanciero(p: ParametrosScore): ScoreFinanciero {
  // Endeudamiento: 0 % = 35 pts, 50 % o más = 0 pts.
  const endeudamiento =
    p.endeudamiento.cuotasMensuales === 0
      ? 35
      : 35 * (1 - limitar(p.endeudamiento.porcentaje / 50, 0, 1));

  // Ahorro: 20 % del ingreso o más = 30 pts, 0 % o menos = 0 pts.
  const ahorro =
    p.ingresosMes > 0
      ? 30 * limitar((p.ingresosMes - p.gastosMes) / p.ingresosMes / 0.2, 0, 1)
      : 15;

  // Cupo: uso promedio de las tarjetas; <=30 % = 20 pts, 100 % = 0 pts.
  const tarjetas = p.cuentas.filter((c) => c.tipo === "credito" && c.cupoTotal);
  const usoPromedio =
    tarjetas.reduce((a, c) => a + (c.cupoTotal! - c.disponible) / c.cupoTotal!, 0) /
    (tarjetas.length || 1);
  const cupo = tarjetas.length === 0 ? 10 : 20 * (1 - limitar((usoPromedio - 0.3) / 0.7, 0, 1));

  // Recordatorios: proporción de los ya vencidos que se completaron.
  const vencidos = p.recordatorios.filter((r) => r.fecha <= p.hoy);
  const recordatorios =
    vencidos.length === 0
      ? 7.5
      : 15 * (vencidos.filter((r) => r.completado).length / vencidos.length);

  const total = Math.round(endeudamiento + ahorro + cupo + recordatorios);
  return {
    total,
    etiqueta:
      total >= 80 ? "excelente" : total >= 60 ? "bueno" : total >= 40 ? "regular" : "critico",
    detalle: {
      endeudamiento: Math.round(endeudamiento),
      ahorro: Math.round(ahorro),
      cupo: Math.round(cupo),
      recordatorios: Math.round(recordatorios),
    },
  };
}
