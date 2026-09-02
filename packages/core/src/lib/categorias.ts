import type { Categoria, Gasto } from "../types/domain";

export interface GrupoCategoria {
  clave: string;
  etiqueta: string;
  color: string;
  monto: number;
}

/**
 * Agrupa gastos por categoría para desglose/gráfica — salvo "Otros" con
 * detalle (ej. "medicamentos"), que se desglosa por ese detalle en vez de
 * amontonarse todo bajo el nombre genérico "Otros". Compartido entre
 * desktop y mobile para que el criterio de agrupamiento no diverja.
 */
export function agruparPorCategoriaODetalle(gastos: Gasto[], categorias: Categoria[]): GrupoCategoria[] {
  const grupos = new Map<string, GrupoCategoria>();
  for (const g of gastos) {
    const categoria = categorias.find((c) => c.id === g.categoriaId);
    if (!categoria) continue;
    const esOtrosConDetalle = categoria.nombre === "Otros" && g.categoriaDetalle;
    const clave = esOtrosConDetalle ? `${categoria.id}:${g.categoriaDetalle}` : categoria.id;
    const etiqueta = esOtrosConDetalle ? g.categoriaDetalle! : categoria.nombre;
    const existente = grupos.get(clave);
    if (existente) {
      existente.monto += g.monto;
    } else {
      grupos.set(clave, { clave, etiqueta, color: categoria.color, monto: g.monto });
    }
  }
  return [...grupos.values()];
}
