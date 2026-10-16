import { fechaIso } from "../schemas/limites";

/**
 * Supabase devuelve como máximo 1.000 filas por consulta (su "max rows"). Sin
 * paginar, quien pasaba de 1.000 gastos veía el resumen, los presupuestos y
 * las recomendaciones calculados con datos incompletos, sin ningún aviso.
 * No bajar el "max rows" del proyecto por debajo de este número.
 */
export const FILAS_POR_PAGINA = 1000;
/** Freno ante un bucle sin fin (200.000 filas). */
const MAX_PAGINAS = 200;

/** Rango de fechas "YYYY-MM-DD", ambos extremos incluidos. Sin rango: todo el historial. */
export interface RangoFechas {
  desde?: string;
  hasta?: string;
}

export function validarRango(rango: RangoFechas): RangoFechas {
  const desde = rango.desde === undefined ? undefined : fechaIso().parse(rango.desde);
  const hasta = rango.hasta === undefined ? undefined : fechaIso().parse(rango.hasta);
  if (desde && hasta && desde > hasta) throw new Error("La fecha inicial es posterior a la final.");
  return { desde, hasta };
}

/**
 * Pide página por página hasta que una venga incompleta. `pedirPagina` recibe
 * los índices de `.range(desde, hasta)` y debe ordenar de forma estable (con
 * un desempate único, como el id) para que las páginas no se pisen.
 */
export async function traerTodasLasFilas<T>(
  pedirPagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const inicio = pagina * FILAS_POR_PAGINA;
    const { data, error } = await pedirPagina(inicio, inicio + FILAS_POR_PAGINA - 1);
    if (error) throw error;
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < FILAS_POR_PAGINA) return filas;
  }
  throw new Error("Hay demasiados registros para cargarlos de una vez. Elige un periodo más corto.");
}
