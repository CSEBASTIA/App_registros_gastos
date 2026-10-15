import type { Gasto, Ingreso } from "../types/domain";
import { sumarMontos } from "../lib/montos";

export interface BalanceGeneral {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
}

/**
 * Suma ingresos y gastos ya filtrados (por ejemplo, del mes actual) y calcula
 * el balance neto. Suma en centavos: 100.30 − 50.10 − 50.20 da 0 exacto, no
 * −0.0000000000000142 (que la pantalla mostraba como "−$0.00").
 */
export function balanceGeneral(gastos: Gasto[], ingresos: Ingreso[]): BalanceGeneral {
  const totalIngresos = sumarMontos(ingresos.map((i) => i.monto));
  const totalGastos = sumarMontos(gastos.map((g) => g.monto));
  return { totalIngresos, totalGastos, balance: sumarMontos([totalIngresos, -totalGastos]) };
}
