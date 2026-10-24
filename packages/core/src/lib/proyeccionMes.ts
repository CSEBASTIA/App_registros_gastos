import type { Categoria, Gasto, Presupuesto } from "../types/domain";
import { redondearCentavos, sumarMontos } from "./montos";
import { moverMes, rangoDelMes } from "./semanas";
import type { Suscripcion } from "./suscripciones";

/**
 * Proyección de cuánto se habrá gastado al terminar el mes.
 *
 * - Gasto variable (todo menos las suscripciones): lo gastado hasta hoy más lo
 *   que en los 3 meses anteriores se solía gastar desde este día hasta fin de
 *   mes, ajustado al ritmo de este mes (si se va gastando el doble de lo
 *   normal, se espera el doble; el ajuste se limita a entre la mitad y el
 *   doble para que un día raro no dispare la cifra). Sin historial, se
 *   reparte lo gastado por día y se multiplica por los días del mes.
 * - Suscripciones: se suman las activas que aún no se cobraron este mes y
 *   vencen antes de que termine; las ya cobradas están en lo gastado, así que
 *   no se cuentan dos veces.
 * - Presupuestos: la misma cuenta por categoría, y avisa cuáles se pasarán.
 */
export type MetodoProyeccion = "historial" | "ritmo" | "cerrado";

export interface ProyeccionPresupuesto {
  presupuesto: Presupuesto;
  categoriaNombre: string;
  gastado: number;
  proyectado: number;
  /** Cuánto pasará del límite si sigue así (0 si no lo pasa). */
  exceso: number;
  excedera: boolean;
}

export interface ProyeccionMes {
  mes: string;
  /** Todo lo gastado en el mes hasta hoy (incluye suscripciones ya cobradas). */
  gastado: number;
  /** Lo que se espera haber gastado el último día del mes. */
  proyectado: number;
  /** Suscripciones que aún faltan por cobrarse este mes. */
  suscripcionesPendientes: number;
  diasTranscurridos: number;
  diasDelMes: number;
  metodo: MetodoProyeccion;
  /** Solo los presupuestos del mes, los que se pasarán primero. */
  presupuestos: ProyeccionPresupuesto[];
}

const MESES_HISTORIAL = 3;
const AJUSTE_MINIMO = 0.5;
const AJUSTE_MAXIMO = 2;

function diaDe(fecha: string): number {
  return Number(fecha.slice(8, 10));
}

function totalHasta(gastos: Gasto[], mes: string, dia: number): number {
  return sumarMontos(gastos.filter((g) => g.fecha.startsWith(mes) && diaDe(g.fecha) <= dia).map((g) => g.monto));
}

function totalDelMes(gastos: Gasto[], mes: string): number {
  return sumarMontos(gastos.filter((g) => g.fecha.startsWith(mes)).map((g) => g.monto));
}

/** Gasto variable esperado a fin de mes. `gastos` ya viene sin suscripciones. */
function proyectarVariable(
  gastos: Gasto[],
  mes: string,
  dia: number,
  diasDelMes: number,
): { proyectado: number; metodo: "historial" | "ritmo" } {
  const gastado = totalHasta(gastos, mes, dia);

  const historial = Array.from({ length: MESES_HISTORIAL }, (_, i) => moverMes(mes, -(i + 1)))
    .map((m) => {
      const diaEquivalente = Math.min(dia, diaDe(rangoDelMes(m).hasta));
      return { hastaDia: totalHasta(gastos, m, diaEquivalente), total: totalDelMes(gastos, m) };
    })
    .filter((h) => h.total > 0);

  if (historial.length > 0) {
    const promedioHastaDia = historial.reduce((a, h) => a + h.hastaDia, 0) / historial.length;
    const promedioRestante = historial.reduce((a, h) => a + (h.total - h.hastaDia), 0) / historial.length;
    const ajuste =
      promedioHastaDia > 0
        ? Math.min(AJUSTE_MAXIMO, Math.max(AJUSTE_MINIMO, gastado / promedioHastaDia))
        : 1;
    return { proyectado: redondearCentavos(gastado + promedioRestante * ajuste), metodo: "historial" };
  }

  return { proyectado: redondearCentavos((gastado / dia) * diasDelMes), metodo: "ritmo" };
}

/** Suscripciones activas que vencen entre mañana y fin de mes y aún no se cobraron este mes. */
function suscripcionesPorCobrar(suscripciones: Suscripcion[], mes: string, hoy: string): Suscripcion[] {
  const { hasta } = rangoDelMes(mes);
  return suscripciones.filter(
    (s) =>
      s.estado === "activa" &&
      !s.ultimoCobro.startsWith(mes) &&
      // Si ya tocaba y no llegó (atrasada pero no cancelada), igual se espera este mes.
      s.proximoCobro <= hasta &&
      (s.proximoCobro > hoy || s.diasAtraso > 0),
  );
}

export function proyectarMes(
  mes: string,
  hoy: string,
  gastos: Gasto[],
  suscripciones: Suscripcion[],
  presupuestos: Presupuesto[] = [],
  categorias: Categoria[] = [],
): ProyeccionMes {
  const { desde, hasta } = rangoDelMes(mes);
  const diasDelMes = diaDe(hasta);
  const delMes = gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta && g.fecha <= hoy);
  const gastado = sumarMontos(delMes.map((g) => g.monto));

  const cerrado = hoy > hasta;
  const futuro = hoy < desde;
  const dia = cerrado ? diasDelMes : futuro ? 0 : diaDe(hoy);

  const idsSuscripcion = new Set(suscripciones.flatMap((s) => s.gastoIds));
  const variables = gastos.filter((g) => !idsSuscripcion.has(g.id) && g.fecha <= hoy);
  const pendientes = cerrado ? [] : suscripcionesPorCobrar(suscripciones, mes, futuro ? desde : hoy);

  const proyectarCategoria = (categoriaId?: string) => {
    const propios = (lista: Gasto[]) => (categoriaId ? lista.filter((g) => g.categoriaId === categoriaId) : lista);
    const gastadoAqui = sumarMontos(propios(delMes).map((g) => g.monto));
    const porCobrar = sumarMontos(
      pendientes.filter((s) => !categoriaId || s.categoriaId === categoriaId).map((s) => s.monto),
    );
    if (cerrado || dia === 0) {
      return { gastado: gastadoAqui, proyectado: sumarMontos([gastadoAqui, porCobrar]), metodo: cerrado ? ("cerrado" as const) : ("ritmo" as const) };
    }
    const variable = proyectarVariable(propios(variables), mes, dia, diasDelMes);
    const suscripcionesCobradas = sumarMontos(
      propios(delMes).filter((g) => idsSuscripcion.has(g.id)).map((g) => g.monto),
    );
    const proyectado = Math.max(gastadoAqui, sumarMontos([variable.proyectado, suscripcionesCobradas, porCobrar]));
    return { gastado: gastadoAqui, proyectado, metodo: variable.metodo };
  };

  const total = proyectarCategoria();

  const proyeccionPresupuestos = presupuestos
    .filter((p) => p.mes === mes)
    .map((presupuesto): ProyeccionPresupuesto => {
      const { gastado: gastadoCat, proyectado } = proyectarCategoria(presupuesto.categoriaId);
      const exceso = Math.max(0, sumarMontos([proyectado, -presupuesto.montoLimite]));
      return {
        presupuesto,
        categoriaNombre: categorias.find((c) => c.id === presupuesto.categoriaId)?.nombre ?? "Sin categoría",
        gastado: gastadoCat,
        proyectado,
        exceso,
        excedera: exceso > 0,
      };
    })
    .sort((a, b) => b.exceso - a.exceso || b.proyectado / b.presupuesto.montoLimite - a.proyectado / a.presupuesto.montoLimite);

  return {
    mes,
    gastado,
    proyectado: total.proyectado,
    suscripcionesPendientes: sumarMontos(pendientes.map((s) => s.monto)),
    diasTranscurridos: dia,
    diasDelMes,
    metodo: cerrado ? "cerrado" : total.metodo,
    presupuestos: proyeccionPresupuestos,
  };
}
