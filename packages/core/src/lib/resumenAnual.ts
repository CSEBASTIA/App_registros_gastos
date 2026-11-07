import { sumarMontos } from "./montos";

/**
 * Resumen de un año: lo que devuelve `resumen_anual` en la base (totales por
 * mes, por categoría y los comercios donde más se gastó, historial incluido)
 * y las cifras que la pantalla muestra a partir de eso.
 */
export interface MesDelAnio {
  /** "AAAA-MM" */
  mes: string;
  gastos: number;
  ingresos: number;
}

export interface CategoriaDelAnio {
  categoriaId?: string;
  nombre: string;
  color?: string;
  total: number;
  cantidad: number;
}

export interface ComercioDelAnio {
  descripcion: string;
  total: number;
  cantidad: number;
}

export interface ResumenAnual {
  anio: number;
  meses: MesDelAnio[];
  /** De la que más gastó a la que menos. */
  categorias: CategoriaDelAnio[];
  /** Los 8 comercios donde más se gastó. */
  comercios: ComercioDelAnio[];
}

export interface CifrasAnuales {
  totalGastos: number;
  totalIngresos: number;
  /** Ingresos menos gastos (negativo: se gastó más de lo que entró). */
  ahorro: number;
  /** Promedio de gasto de los meses que ya pasaron o están en curso y tienen gastos. */
  promedioMensual: number;
  /** El mes con más gasto, si hubo alguno. */
  mesMayorGasto?: MesDelAnio;
  /** Meses que ya pasaron (o el actual) sin ningún gasto: les falta su estado de cuenta. */
  mesesSinDatos: string[];
  /** % de cada categoría sobre el gasto del año, en el mismo orden que `categorias`. */
  porcentajes: number[];
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const texto = (v: unknown) => (typeof v === "string" ? v : undefined);

/** La respuesta de la base (jsonb) → resumen tipado; lo que no tenga forma se ignora. */
export function resumenAnualDe(data: unknown, anio: number): ResumenAnual {
  const r = (data ?? {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    anio,
    meses: lista(r.meses)
      .filter((m) => typeof m?.mes === "string")
      .map((m) => ({ mes: m.mes as string, gastos: num(m.gastos), ingresos: num(m.ingresos) })),
    categorias: lista(r.categorias).map((c) => ({
      ...(texto(c.categoria_id) ? { categoriaId: texto(c.categoria_id) } : {}),
      nombre: texto(c.nombre)?.trim() || "Sin categoría",
      ...(texto(c.color) ? { color: texto(c.color) } : {}),
      total: num(c.total),
      cantidad: num(c.cantidad),
    })),
    comercios: lista(r.comercios)
      .filter((c) => texto(c.descripcion)?.trim())
      .map((c) => ({ descripcion: (c.descripcion as string).trim(), total: num(c.total), cantidad: num(c.cantidad) })),
  };
}

/** Las cifras del año. `mesActual` ("AAAA-MM") marca hasta dónde un mes vacío cuenta como «sin datos». */
export function cifrasAnuales(resumen: ResumenAnual, mesActual: string): CifrasAnuales {
  const totalGastos = sumarMontos(resumen.meses.map((m) => m.gastos));
  const totalIngresos = sumarMontos(resumen.meses.map((m) => m.ingresos));
  const transcurridos = resumen.meses.filter((m) => m.mes <= mesActual);
  const conGasto = transcurridos.filter((m) => m.gastos > 0);
  const mesMayorGasto = resumen.meses.reduce<MesDelAnio | undefined>(
    (mayor, m) => (m.gastos > 0 && (!mayor || m.gastos > mayor.gastos) ? m : mayor),
    undefined,
  );
  const totalCategorias = sumarMontos(resumen.categorias.map((c) => c.total));
  return {
    totalGastos,
    totalIngresos,
    ahorro: sumarMontos([totalIngresos, -totalGastos]),
    promedioMensual: conGasto.length ? Math.round((sumarMontos(conGasto.map((m) => m.gastos)) / conGasto.length) * 100) / 100 : 0,
    ...(mesMayorGasto ? { mesMayorGasto } : {}),
    mesesSinDatos: transcurridos.filter((m) => m.gastos === 0 && m.ingresos === 0).map((m) => m.mes),
    porcentajes: resumen.categorias.map((c) => (totalCategorias > 0 ? Math.round((c.total / totalCategorias) * 1000) / 10 : 0)),
  };
}
