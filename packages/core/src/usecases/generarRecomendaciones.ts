import type { Categoria, Cuenta, Gasto, Ingreso } from "../types/domain";
import type { Endeudamiento } from "./calcularEndeudamiento";

export type SeveridadRecomendacion = "info" | "alerta";

export interface Recomendacion {
  severidad: SeveridadRecomendacion;
  mensaje: string;
}

function mesesAnteriores(mes: string, cantidad: number): string[] {
  let [anio, m] = mes.split("-").map(Number);
  const resultado: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      anio -= 1;
    }
    resultado.push(`${anio}-${String(m).padStart(2, "0")}`);
  }
  return resultado;
}

export interface ParametrosRecomendaciones {
  mes: string; // YYYY-MM
  /** Histórico completo, para poder comparar el mes actual contra meses anteriores. */
  gastos: Gasto[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  cuentas: Cuenta[];
  endeudamiento: Endeudamiento;
}

/**
 * Motor de recomendaciones por reglas (determinista, sin IA): compara el mes
 * actual contra ingresos, promedio histórico por categoría, uso de cupo de
 * tarjetas y nivel de endeudamiento.
 */
export function generarRecomendaciones(params: ParametrosRecomendaciones): Recomendacion[] {
  const { mes, gastos, ingresos, categorias, cuentas, endeudamiento } = params;
  const recomendaciones: Recomendacion[] = [];

  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const totalGastosMes = gastosDelMes.reduce((acc, g) => acc + g.monto, 0);
  const totalIngresosMes = ingresosDelMes.reduce((acc, i) => acc + i.monto, 0);

  if (totalIngresosMes > 0 && totalGastosMes > totalIngresosMes) {
    recomendaciones.push({
      severidad: "alerta",
      mensaje: `Este mes gastaste $${totalGastosMes.toFixed(2)}, más de lo que ingresaste ($${totalIngresosMes.toFixed(2)}).`,
    });
  }

  // Gasto por categoría vs. promedio de los últimos 3 meses.
  const mesesPrevios = mesesAnteriores(mes, 3);
  for (const categoria of categorias) {
    const gastoMesCategoria = gastosDelMes
      .filter((g) => g.categoriaId === categoria.id)
      .reduce((acc, g) => acc + g.monto, 0);
    if (gastoMesCategoria === 0) continue;

    const totalPrevio = mesesPrevios.reduce((acc, m) => {
      return (
        acc +
        gastos
          .filter((g) => g.categoriaId === categoria.id && g.fecha.startsWith(m))
          .reduce((sum, g) => sum + g.monto, 0)
      );
    }, 0);
    const promedioPrevio = totalPrevio / mesesPrevios.length;

    if (promedioPrevio > 0 && gastoMesCategoria > promedioPrevio * 1.3) {
      const incremento = ((gastoMesCategoria - promedioPrevio) / promedioPrevio) * 100;
      recomendaciones.push({
        severidad: "alerta",
        mensaje: `Gastaste ${incremento.toFixed(0)}% más en "${categoria.nombre}" que tu promedio de los últimos meses.`,
      });
    }
  }

  // Cupo de tarjetas casi agotado.
  for (const cuenta of cuentas) {
    if (cuenta.tipo !== "credito" || !cuenta.cupoTotal) continue;
    const usoPorcentaje = ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100;
    if (usoPorcentaje >= 80) {
      recomendaciones.push({
        severidad: "alerta",
        mensaje: `Tu tarjeta "${cuenta.nombre}" ya usó el ${usoPorcentaje.toFixed(0)}% del cupo. Te quedan $${cuenta.disponible.toFixed(2)} disponibles.`,
      });
    }
  }

  // Nivel de endeudamiento.
  if (endeudamiento.nivel === "alto") {
    recomendaciones.push({
      severidad: "alerta",
      mensaje: `Tu nivel de endeudamiento es alto (${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso mensual se va en cuotas). Evita tomar más deuda por ahora.`,
    });
  } else if (endeudamiento.nivel === "moderado") {
    recomendaciones.push({
      severidad: "info",
      mensaje: `Tu nivel de endeudamiento es moderado (${endeudamiento.porcentaje.toFixed(0)}%). Vale la pena vigilarlo.`,
    });
  }

  if (recomendaciones.length === 0 && totalIngresosMes > 0) {
    const ahorro = totalIngresosMes - totalGastosMes;
    if (ahorro > 0) {
      recomendaciones.push({
        severidad: "info",
        mensaje: `Vas bien este mes: te sobraron $${ahorro.toFixed(2)}. Considera moverlos a una cuenta de ahorro.`,
      });
    }
  }

  return recomendaciones;
}
