import type { Categoria, Gasto, Presupuesto } from "../types/domain";

export type NivelPresupuesto = "ok" | "cerca" | "excedido";

export interface EstadoPresupuesto {
  presupuesto: Presupuesto;
  categoriaNombre: string;
  gastado: number;
  restante: number;
  /** Gastado / límite, en %. Puede pasar de 100. */
  porcentaje: number;
  nivel: NivelPresupuesto;
}

function nivelDe(porcentaje: number): NivelPresupuesto {
  if (porcentaje >= 100) return "excedido";
  if (porcentaje >= 80) return "cerca";
  return "ok";
}

/** Gasto vs. límite de cada presupuesto del mes. Alerta al 80 % ("cerca") y al 100 % ("excedido"). */
export function estadoPresupuestos(
  mes: string,
  presupuestos: Presupuesto[],
  gastos: Gasto[],
  categorias: Categoria[]
): EstadoPresupuesto[] {
  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));

  return presupuestos
    .filter((p) => p.mes === mes)
    .map((presupuesto) => {
      const gastado = gastosDelMes
        .filter((g) => g.categoriaId === presupuesto.categoriaId)
        .reduce((acc, g) => acc + g.monto, 0);
      const porcentaje = (gastado / presupuesto.montoLimite) * 100;

      return {
        presupuesto,
        categoriaNombre:
          categorias.find((c) => c.id === presupuesto.categoriaId)?.nombre ?? "Sin categoría",
        gastado,
        restante: presupuesto.montoLimite - gastado,
        porcentaje,
        nivel: nivelDe(porcentaje),
      };
    })
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

/**
 * Límite sugerido para una categoría: promedio de los meses previos que
 * tuvieron gasto (hasta `cantidad`), redondeado hacia arriba a múltiplos de 5.
 * Devuelve null si no hay historial.
 */
export function sugerirLimite(
  categoriaId: string,
  mes: string,
  gastos: Gasto[],
  cantidad = 3
): number | null {
  let [anio, m] = mes.split("-").map(Number);
  const totales: number[] = [];

  for (let i = 0; i < cantidad; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      anio -= 1;
    }
    const prefijo = `${anio}-${String(m).padStart(2, "0")}`;
    const total = gastos
      .filter((g) => g.categoriaId === categoriaId && g.fecha.startsWith(prefijo))
      .reduce((acc, g) => acc + g.monto, 0);
    if (total > 0) totales.push(total);
  }

  if (totales.length === 0) return null;
  const promedio = totales.reduce((a, b) => a + b, 0) / totales.length;
  return Math.ceil(promedio / 5) * 5;
}
