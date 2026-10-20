/**
 * Cálculos de las secciones del Resumen (pantalla de inicio): tarjetas
 * favoritas, ingresos y gastos contra el mes anterior, ahorro y diferidos.
 * Funciones puras: la pantalla trae los datos y aquí solo se resumen.
 */
import type { Cuenta, Deuda, Gasto, Ingreso } from "../types/domain";
import { sumarMontos } from "./montos";
import { cicloTarjeta } from "./corteTarjeta";

/** "2026-10" → "2026-09" (enero → diciembre del año anterior). */
export function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

/** Cambio porcentual entero; sin base (mes anterior en 0) no hay porcentaje. */
function cambioPorcentual(actual: number, anterior: number): number | undefined {
  if (anterior === 0) return undefined;
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
}

export interface FilaComparacion {
  concepto: "Ingresos" | "Gastos" | "Balance";
  actual: number;
  anterior: number;
  /** Cambio en % frente al mes anterior (undefined si el mes anterior fue 0). */
  cambio?: number;
  /** Si el cambio es bueno para la persona (más ingreso o balance, menos gasto). */
  mejora?: boolean;
}

/** Tabla «Ingresos y gastos»: este mes contra el anterior. */
export function comparacionMensual(gastos: Gasto[], ingresos: Ingreso[], mes: string): { mesAnterior: string; filas: FilaComparacion[] } {
  const previo = mesAnterior(mes);
  const total = (lista: { fecha: string; monto: number }[], m: string) =>
    sumarMontos(lista.filter((x) => x.fecha.startsWith(m)).map((x) => x.monto));
  const ingresosActual = total(ingresos, mes);
  const ingresosPrevio = total(ingresos, previo);
  const gastosActual = total(gastos, mes);
  const gastosPrevio = total(gastos, previo);
  const fila = (concepto: FilaComparacion["concepto"], actual: number, anterior: number, menosEsMejor = false): FilaComparacion => {
    const cambio = cambioPorcentual(actual, anterior);
    return {
      concepto,
      actual,
      anterior,
      ...(cambio !== undefined ? { cambio, mejora: cambio === 0 ? undefined : menosEsMejor ? cambio < 0 : cambio > 0 } : {}),
    };
  };
  return {
    mesAnterior: previo,
    filas: [
      fila("Ingresos", ingresosActual, ingresosPrevio),
      fila("Gastos", gastosActual, gastosPrevio, true),
      fila("Balance", sumarMontos([ingresosActual, -gastosActual]), sumarMontos([ingresosPrevio, -gastosPrevio])),
    ],
  };
}

export interface ResumenTarjeta {
  cuenta: Cuenta;
  /** Lo gastado con la tarjeta en el mes. */
  gastadoMes: number;
  /** Cupo usado en %, si se conoce el cupo total. */
  usado?: number;
  /** Pasó el cupo (disponible negativo): se muestra en rojo. */
  sobreendeudada: boolean;
  /** Próximo corte y pago, si la tarjeta los tiene anotados. */
  corte?: string;
  pago?: string;
}

/** Cuántas tarjetas caben en la sección. */
export const MAXIMO_TARJETAS_FAVORITAS = 4;

/**
 * Las tarjetas de crédito a mostrar: las favoritas (en el orden elegido) o, si
 * no hay favoritas, las dos con más gasto en el mes.
 */
export function resumenTarjetas(cuentas: Cuenta[], gastos: Gasto[], mes: string, favoritas: string[], hoy: string): ResumenTarjeta[] {
  const tarjetas = cuentas.filter((c) => c.tipo === "credito");
  const resumen = (cuenta: Cuenta): ResumenTarjeta => {
    const gastadoMes = sumarMontos(gastos.filter((g) => g.cuentaId === cuenta.id && g.fecha.startsWith(mes)).map((g) => g.monto));
    const ciclo = cuenta.diaCorte ? cicloTarjeta(cuenta.diaCorte, hoy, cuenta.diaPago) : undefined;
    return {
      cuenta,
      gastadoMes,
      ...(cuenta.cupoTotal && cuenta.cupoTotal > 0
        ? { usado: Math.round(((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100) }
        : {}),
      sobreendeudada: cuenta.disponible < 0,
      ...(ciclo ? { corte: ciclo.corte } : {}),
      ...(ciclo?.pago ? { pago: ciclo.pago } : {}),
    };
  };
  const elegidas = favoritas
    .map((id) => tarjetas.find((t) => t.id === id))
    .filter((t): t is Cuenta => !!t)
    .slice(0, MAXIMO_TARJETAS_FAVORITAS);
  if (elegidas.length > 0) return elegidas.map(resumen);
  return tarjetas
    .map(resumen)
    .sort((a, b) => b.gastadoMes - a.gastadoMes)
    .slice(0, 2);
}

export interface ResumenAhorro {
  cuentas: { cuenta: Cuenta; saldo: number }[];
  totalAhorrado: number;
  /** Ingresos − gastos del mes (lo que te quedó). */
  teQuedo: number;
  /** % de los ingresos del mes que te quedó; sin ingresos no hay tasa. */
  tasa?: number;
}

/** Tabla «Ahorro»: las cuentas de ahorro con su saldo, y cuánto te quedó del mes. */
export function resumenAhorro(cuentas: Cuenta[], gastos: Gasto[], ingresos: Ingreso[], mes: string): ResumenAhorro {
  const ahorro = cuentas.filter((c) => c.tipo === "ahorro").map((cuenta) => ({ cuenta, saldo: cuenta.disponible }));
  const ingresosMes = sumarMontos(ingresos.filter((i) => i.fecha.startsWith(mes)).map((i) => i.monto));
  const gastosMes = sumarMontos(gastos.filter((g) => g.fecha.startsWith(mes)).map((g) => g.monto));
  const teQuedo = sumarMontos([ingresosMes, -gastosMes]);
  return {
    cuentas: ahorro,
    totalAhorrado: sumarMontos(ahorro.map((a) => a.saldo)),
    teQuedo,
    ...(ingresosMes > 0 ? { tasa: Math.round((teQuedo / ingresosMes) * 100) } : {}),
  };
}

export interface FilaDiferido {
  deuda: Deuda;
  /** Tarjeta con la que se difirió, si se sabe. */
  tarjeta?: string;
  cuota: number;
  cuotasTotales: number;
  /** Cuotas que faltan por pagar (incluida la de este mes). */
  cuotasRestantes: number;
}

/**
 * Tabla «Diferidos»: las compras diferidas que todavía se están pagando. El
 * número de cuotas sale del gasto que creó el diferido; si ese gasto no está
 * en la lista, se estima con el monto y la cuota.
 */
export function resumenDiferidos(deudas: Deuda[], cuentas: Cuenta[], gastos: Gasto[] = []): { filas: FilaDiferido[]; cuotasDelMes: number } {
  const filas = deudas
    .filter((d) => (d.tipo === "diferido" || !!d.gastoId) && d.saldoPendiente > 0.004 && d.cuotaMensual > 0)
    .map((deuda): FilaDiferido => {
      const meses = gastos.find((g) => g.id === deuda.gastoId)?.mesesDiferido;
      const cuotasTotales = meses ?? Math.max(1, Math.round(deuda.montoTotal / deuda.cuotaMensual));
      const capitalPorCuota = deuda.montoTotal / cuotasTotales;
      const cuotasRestantes = Math.min(cuotasTotales, Math.max(1, Math.ceil(deuda.saldoPendiente / capitalPorCuota - 0.001)));
      return {
        deuda,
        ...(deuda.cuentaId ? { tarjeta: cuentas.find((c) => c.id === deuda.cuentaId)?.nombre } : {}),
        cuota: deuda.cuotaMensual,
        cuotasTotales,
        cuotasRestantes,
      };
    })
    .sort((a, b) => b.cuota - a.cuota);
  return { filas, cuotasDelMes: sumarMontos(filas.map((f) => f.cuota)) };
}
