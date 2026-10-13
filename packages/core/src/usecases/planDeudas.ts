import type { Deuda } from "../types/domain";

export type EstrategiaDeudas = "bola_de_nieve" | "avalancha";

export interface PasoPlanDeuda {
  deudaId: string;
  nombre: string;
  /** Mes (1 = el próximo) en el que queda saldada. 0 si el plan no es viable. */
  mesLiquidacion: number;
  interesPagado: number;
}

export interface PlanDeudas {
  estrategia: EstrategiaDeudas;
  orden: PasoPlanDeuda[];
  mesesTotales: number;
  interesTotal: number;
  /** false si el pago mensual no cubre las cuotas mínimas o nunca liquida. */
  viable: boolean;
}

const LIMITE_MESES = 600;

interface DeudaSim {
  id: string;
  nombre: string;
  saldo: number;
  cuota: number;
  tasaMensual: number;
  interes: number;
  mes: number;
}

/**
 * Simula el pago de todas las deudas con un presupuesto mensual fijo
 * (`pagoMensual`): se pagan las cuotas mínimas y el sobrante va a la deuda
 * prioritaria — bola de nieve = menor saldo primero, avalancha = mayor tasa
 * primero. Al saldarse una deuda su cuota pasa a la siguiente.
 */
export function planDeudas(
  deudas: Deuda[],
  pagoMensual: number,
  estrategia: EstrategiaDeudas
): PlanDeudas {
  const activas: DeudaSim[] = deudas
    .filter((d) => d.saldoPendiente > 0)
    .map((d) => ({
      id: d.id,
      nombre: d.nombre,
      saldo: d.saldoPendiente,
      cuota: d.cuotaMensual,
      tasaMensual: (d.tasaInteres ?? 0) / 100 / 12,
      interes: 0,
      mes: 0,
    }));

  // Sin deudas activas no hay nada que pagar: el plan ya está cumplido.
  if (activas.length === 0) {
    return { estrategia, orden: [], mesesTotales: 0, interesTotal: 0, viable: true };
  }

  const prioridad = (a: DeudaSim, b: DeudaSim) =>
    estrategia === "bola_de_nieve" ? a.saldo - b.saldo : b.tasaMensual - a.tasaMensual;

  const minimas = activas.reduce((acc, d) => acc + d.cuota, 0);
  const puedePagar = pagoMensual > 0 && pagoMensual >= minimas;
  const saldadas: DeudaSim[] = [];
  let mes = 0;

  while (puedePagar && activas.length > 0 && mes < LIMITE_MESES) {
    mes += 1;
    let disponible = pagoMensual;

    for (const d of activas) {
      const interes = d.saldo * d.tasaMensual;
      d.interes += interes;
      d.saldo += interes;
    }
    // Cuotas mínimas primero.
    for (const d of activas) {
      const pago = Math.min(d.cuota, d.saldo, disponible);
      d.saldo -= pago;
      disponible -= pago;
    }
    // Sobrante a la deuda prioritaria.
    for (const d of [...activas].sort(prioridad)) {
      if (disponible <= 0) break;
      const pago = Math.min(d.saldo, disponible);
      d.saldo -= pago;
      disponible -= pago;
    }
    for (let i = activas.length - 1; i >= 0; i--) {
      if (activas[i].saldo <= 0.005) {
        activas[i].mes = mes;
        saldadas.push(...activas.splice(i, 1));
      }
    }
  }

  const viable = puedePagar && activas.length === 0;
  const todas = [...saldadas.sort((a, b) => a.mes - b.mes), ...activas];
  const redondear = (n: number) => Math.round(n * 100) / 100;

  return {
    estrategia,
    orden: todas.map((d) => ({
      deudaId: d.id,
      nombre: d.nombre,
      mesLiquidacion: d.mes,
      interesPagado: redondear(d.interes),
    })),
    mesesTotales: viable ? mes : 0,
    interesTotal: redondear(todas.reduce((acc, d) => acc + d.interes, 0)),
    viable,
  };
}
