import type { Categoria, Cuenta, Gasto, Ingreso, Lugar, Presupuesto } from "../types/domain";
import type { Endeudamiento } from "./calcularEndeudamiento";
import { estadoPresupuestos } from "./estadoPresupuestos";
import { sumarMontos } from "../lib/montos";

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
  /** Opcional: límites por categoría; avisa al 80 % y alerta al pasarse. */
  presupuestos?: Presupuesto[];
  /** Opcional: los lugares del usuario, para avisar si en uno el gasto sube mucho respecto al mes pasado. */
  lugares?: Lugar[];
}

/** Lugar donde más se gastó este mes, si ya supera en 30 % o más a todo el mes pasado (y son al menos $20). */
function recomendacionLugar(mes: string, gastos: Gasto[], lugares: Lugar[]): Recomendacion | undefined {
  if (lugares.length === 0) return undefined;
  const [mesPasado] = mesesAnteriores(mes, 1);
  const totalDe = (lugarId: string, m: string) =>
    sumarMontos(gastos.filter((g) => g.lugarId === lugarId && g.fecha.startsWith(m)).map((g) => g.monto));

  let mayor: { lugar: Lugar; total: number } | undefined;
  for (const lugar of lugares) {
    const total = totalDe(lugar.id, mes);
    if (total > 0 && (!mayor || total > mayor.total)) mayor = { lugar, total };
  }
  if (!mayor || mayor.total < 20) return undefined;

  const anterior = totalDe(mayor.lugar.id, mesPasado);
  // Sin datos del mes pasado no hay contra qué comparar: no se inventa un aumento.
  if (anterior <= 0 || mayor.total < anterior * 1.3) return undefined;
  const incremento = ((mayor.total - anterior) / anterior) * 100;
  return {
    severidad: "info",
    mensaje: `Este mes llevas $${mayor.total.toFixed(2)} en "${mayor.lugar.nombre}", un ${incremento.toFixed(0)}% más que en todo el mes pasado.`,
  };
}

/**
 * Motor de recomendaciones por reglas (determinista, sin IA): compara el mes
 * actual contra ingresos, promedio histórico por categoría, uso de cupo de
 * tarjetas y nivel de endeudamiento.
 */
export function generarRecomendaciones(params: ParametrosRecomendaciones): Recomendacion[] {
  const { mes, gastos, ingresos, categorias, cuentas, endeudamiento, presupuestos = [], lugares = [] } = params;
  const recomendaciones: Recomendacion[] = [];

  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const totalGastosMes = sumarMontos(gastosDelMes.map((g) => g.monto));
  const totalIngresosMes = sumarMontos(ingresosDelMes.map((i) => i.monto));

  if (totalIngresosMes > 0 && totalGastosMes > totalIngresosMes) {
    recomendaciones.push({
      severidad: "alerta",
      mensaje: `Este mes gastaste $${totalGastosMes.toFixed(2)}, más de lo que ingresaste ($${totalIngresosMes.toFixed(2)}).`,
    });
  }

  // Gasto por categoría vs. promedio de los últimos 3 meses.
  const mesesPrevios = mesesAnteriores(mes, 3);
  for (const categoria of categorias) {
    const gastoMesCategoria = sumarMontos(
      gastosDelMes.filter((g) => g.categoriaId === categoria.id).map((g) => g.monto)
    );
    if (gastoMesCategoria === 0) continue;

    // Promedio solo de los meses que tienen datos (como sugerirLimite): con
    // poco historial, dividir siempre entre 3 inventaba aumentos que no existían.
    const totalesPrevios = mesesPrevios
      .map((m) =>
        sumarMontos(
          gastos.filter((g) => g.categoriaId === categoria.id && g.fecha.startsWith(m)).map((g) => g.monto)
        )
      )
      .filter((total) => total > 0);
    if (totalesPrevios.length === 0) continue;
    const promedioPrevio = sumarMontos(totalesPrevios) / totalesPrevios.length;

    if (promedioPrevio > 0 && gastoMesCategoria > promedioPrevio * 1.3) {
      const incremento = ((gastoMesCategoria - promedioPrevio) / promedioPrevio) * 100;
      recomendaciones.push({
        severidad: "alerta",
        mensaje: `Gastaste ${incremento.toFixed(0)}% más en "${categoria.nombre}" que tu promedio de los últimos meses.`,
      });
    }
  }

  // Presupuestos por categoría.
  for (const estado of estadoPresupuestos(mes, presupuestos, gastos, categorias)) {
    if (estado.nivel === "excedido") {
      recomendaciones.push({
        severidad: "alerta",
        mensaje: `Te pasaste del presupuesto de "${estado.categoriaNombre}": llevas $${estado.gastado.toFixed(2)} de $${estado.presupuesto.montoLimite.toFixed(2)}.`,
      });
    } else if (estado.nivel === "cerca") {
      recomendaciones.push({
        severidad: "info",
        mensaje: `Ya usaste el ${estado.porcentaje.toFixed(0)}% del presupuesto de "${estado.categoriaNombre}". Te quedan $${estado.restante.toFixed(2)}.`,
      });
    }
  }

  // Lugar donde el gasto se disparó respecto al mes pasado.
  const porLugar = recomendacionLugar(mes, gastos, lugares);
  if (porLugar) recomendaciones.push(porLugar);

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
    // Cuenta también lo comprado con tarjeta (se pagará): por eso no coincide
    // con el efectivo neto del Resumen, y el texto lo dice.
    const ahorro = sumarMontos([totalIngresosMes, -totalGastosMes]);
    if (ahorro > 0) {
      recomendaciones.push({
        severidad: "info",
        mensaje: `Vas bien este mes: tus ingresos superan en $${ahorro.toFixed(2)} todo lo que gastaste, también con tarjeta. Considera moverlo a una cuenta de ahorro.`,
      });
    }
  }

  return recomendaciones;
}
