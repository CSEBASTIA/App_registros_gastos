import type { Gasto, Ingreso } from "../types/domain";

export interface BalanceGeneral {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
}

/** Suma ingresos y gastos ya filtrados (por ejemplo, del mes actual) y calcula el balance neto. */
export function balanceGeneral(gastos: Gasto[], ingresos: Ingreso[]): BalanceGeneral {
  const totalIngresos = ingresos.reduce((acc, i) => acc + i.monto, 0);
  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0);
  return { totalIngresos, totalGastos, balance: totalIngresos - totalGastos };
}
