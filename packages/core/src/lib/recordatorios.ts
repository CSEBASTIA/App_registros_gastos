import type { Recordatorio } from "../types/domain";
import { diasEntre } from "./corteTarjeta";
import { sumarMeses } from "./semanas";

/**
 * Cómo se muestra la lista de recordatorios. Un diferido a 12 meses crea 12
 * recordatorios (uno por cuota); en vez de mostrarlos todos, se muestra la
 * cuota que toca ahora y cuántas quedan.
 *
 * - Manuales: pendientes en «próximos» (también los vencidos), hechos en «anteriores».
 * - Cuotas automáticas: cada una «toca» desde su fecha hasta la de la cuota
 *   siguiente (un mes). Pasado ese mes sin registrar el pago, pasa a
 *   «anteriores»: así, al terminar el plazo del diferido, sus recordatorios
 *   se cierran solos aunque no se haya registrado el abono.
 */
export interface RecordatoriosOrganizados {
  /** Ordenados por fecha: los más cercanos primero. */
  proximos: Recordatorio[];
  /** Por id de recordatorio mostrado: cuántas cuotas más quedan después de esa. */
  cuotasDespues: Record<string, number>;
  /** Hechos y cuotas que ya pasaron, los más recientes primero. */
  anteriores: Recordatorio[];
}

export function organizarRecordatorios(lista: Recordatorio[], hoy: string): RecordatoriosOrganizados {
  const proximos: Recordatorio[] = [];
  const anteriores: Recordatorio[] = [];
  const cuotasDespues: Record<string, number> = {};
  const cuotasPorDeuda = new Map<string, Recordatorio[]>();

  for (const r of lista) {
    if (r.completado) anteriores.push(r);
    else if (r.automatico && r.deudaId) {
      if (sumarMeses(r.fecha, 1) <= hoy) anteriores.push(r);
      else cuotasPorDeuda.set(r.deudaId, [...(cuotasPorDeuda.get(r.deudaId) ?? []), r]);
    } else proximos.push(r);
  }

  for (const cuotas of cuotasPorDeuda.values()) {
    cuotas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    // La que toca: la última que ya empezó; si ninguna empezó, la primera.
    let actual = 0;
    cuotas.forEach((c, i) => {
      if (c.fecha <= hoy) actual = i;
    });
    // Las anteriores a la que toca ya pasaron sin registrar el pago.
    anteriores.push(...cuotas.slice(0, actual));
    proximos.push(cuotas[actual]);
    cuotasDespues[cuotas[actual].id] = cuotas.length - actual - 1;
  }

  proximos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  anteriores.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { proximos, cuotasDespues, anteriores };
}

/** «Hoy», «mañana», «en 4 días», «venció ayer», «venció hace 3 días». */
export function textoVencimiento(fecha: string, hoy: string): string {
  const dias = diasEntre(hoy, fecha);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias > 1) return `en ${dias} días`;
  if (dias === -1) return "venció ayer";
  return `venció hace ${-dias} días`;
}
