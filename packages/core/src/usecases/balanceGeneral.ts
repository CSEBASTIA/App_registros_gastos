import type { Cuenta, Gasto, Ingreso, PagoTarjeta } from "../types/domain";
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

/**
 * ¿El gasto se pagó con tarjeta de crédito (o casa comercial)? Manda la
 * cuenta, porque es la que la base descuenta; sin cuenta, el método de pago.
 */
export function esConsumoConTarjeta(
  gasto: Pick<Gasto, "cuentaId" | "metodoPago">,
  cuentas: Pick<Cuenta, "id" | "tipo">[]
): boolean {
  const cuenta = gasto.cuentaId ? cuentas.find((c) => c.id === gasto.cuentaId) : undefined;
  if (cuenta) return cuenta.tipo === "credito";
  return gasto.metodoPago === "credito" || gasto.metodoPago === "diferido";
}

export interface EfectivoNeto {
  totalIngresos: number;
  /** Gastos con efectivo, débito o transferencia: salen de tu dinero en el momento. */
  gastadoConTuDinero: number;
  /** Consumos con tarjeta de crédito: no bajan tu efectivo hasta que pagas la tarjeta. */
  conTarjeta: number;
  /** Lo que pagaste a tus tarjetas: ahí sale el dinero de lo que compraste con ellas. */
  pagosTarjeta: number;
  /** Ingresos − gastos con tu dinero − pagos de tarjeta. */
  efectivoNeto: number;
}

/**
 * El dinero que de verdad te queda en el período (datos ya filtrados, por
 * ejemplo del mes). Una compra con tarjeta no lo baja: lo baja el pago de la
 * tarjeta, cuando sale de tu cuenta. Así la misma compra no se cuenta dos veces.
 */
export function efectivoNeto(
  gastos: Gasto[],
  ingresos: Ingreso[],
  cuentas: Pick<Cuenta, "id" | "tipo">[],
  pagosTarjeta: Pick<PagoTarjeta, "monto">[]
): EfectivoNeto {
  const totalIngresos = sumarMontos(ingresos.map((i) => i.monto));
  const conTarjeta = sumarMontos(gastos.filter((g) => esConsumoConTarjeta(g, cuentas)).map((g) => g.monto));
  const gastadoConTuDinero = sumarMontos(gastos.filter((g) => !esConsumoConTarjeta(g, cuentas)).map((g) => g.monto));
  const pagos = sumarMontos(pagosTarjeta.map((p) => p.monto));
  return {
    totalIngresos,
    gastadoConTuDinero,
    conTarjeta,
    pagosTarjeta: pagos,
    efectivoNeto: sumarMontos([totalIngresos, -gastadoConTuDinero, -pagos]),
  };
}
