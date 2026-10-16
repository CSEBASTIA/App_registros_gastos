import type { Gasto, Ingreso } from "../types/domain";
import type { CambiosGasto } from "../repositories/gastos.repo";
import type { CambiosIngreso } from "../schemas/ingreso.schema";

/**
 * Editar un gasto o un ingreso desde el teléfono: qué se puede cambiar y qué
 * cambios enviar (solo lo que cambió). Un diferido ya tiene su deuda, su cupo
 * reservado y un recordatorio por cuota: la base no deja cambiar su monto,
 * tarjeta, método, plazo ni fecha.
 */
export const MENSAJE_EDICION_DIFERIDO =
  "En un diferido solo se pueden cambiar la descripción y la categoría. Para cambiar el monto, la tarjeta o la fecha, elimínalo y regístralo de nuevo.";

export interface EdicionPermitida {
  monto: boolean;
  cuenta: boolean;
  fecha: boolean;
  aviso?: string;
}

export function edicionPermitida(g: Pick<Gasto, "metodoPago">): EdicionPermitida {
  if (g.metodoPago === "diferido") {
    return { monto: false, cuenta: false, fecha: false, aviso: MENSAJE_EDICION_DIFERIDO };
  }
  return { monto: true, cuenta: true, fecha: true };
}

/** Lo que muestra el formulario de edición. `cuentaId` vacío = sin cuenta. */
export interface FormularioMovimiento {
  monto: number;
  descripcion: string;
  categoriaId?: string;
  /** Solo con la categoría «Otros»; vacío o sin valor = sin detalle. */
  categoriaDetalle?: string;
  cuentaId?: string;
  fecha: string;
}

const centavos = (n: number) => Math.round(n * 100);
const texto = (s?: string) => (s ?? "").trim();

/**
 * Los cambios de un gasto: solo los campos que cambiaron. Lanza un error con
 * un mensaje claro si se intenta cambiar algo que un diferido no permite.
 * Devuelve `{}` si no cambió nada.
 */
export function cambiosDeGasto(original: Gasto, f: FormularioMovimiento): CambiosGasto {
  const permitido = edicionPermitida(original);
  const cambios: CambiosGasto = {};
  if (centavos(f.monto) !== centavos(original.monto)) {
    if (!permitido.monto) throw new Error(MENSAJE_EDICION_DIFERIDO);
    cambios.monto = f.monto;
  }
  if (texto(f.descripcion) !== texto(original.descripcion)) cambios.descripcion = texto(f.descripcion);
  if (f.categoriaId && f.categoriaId !== original.categoriaId) cambios.categoriaId = f.categoriaId;
  if (texto(f.categoriaDetalle) !== texto(original.categoriaDetalle)) cambios.categoriaDetalle = texto(f.categoriaDetalle);
  if (texto(f.cuentaId) !== texto(original.cuentaId)) {
    if (!permitido.cuenta) throw new Error(MENSAJE_EDICION_DIFERIDO);
    cambios.cuentaId = texto(f.cuentaId);
  }
  if (f.fecha !== original.fecha) {
    if (!permitido.fecha) throw new Error(MENSAJE_EDICION_DIFERIDO);
    cambios.fecha = f.fecha;
  }
  return cambios;
}

/** Los cambios de un ingreso: solo los campos que cambiaron (`null` quita cuenta o detalle). */
export function cambiosDeIngreso(original: Ingreso, f: FormularioMovimiento): CambiosIngreso {
  const cambios: CambiosIngreso = {};
  if (centavos(f.monto) !== centavos(original.monto)) cambios.monto = f.monto;
  if (texto(f.descripcion) !== texto(original.descripcion)) cambios.descripcion = texto(f.descripcion);
  if (texto(f.categoriaId) !== texto(original.categoriaId)) cambios.categoriaId = texto(f.categoriaId) || null;
  if (texto(f.categoriaDetalle) !== texto(original.categoriaDetalle)) cambios.categoriaDetalle = texto(f.categoriaDetalle) || null;
  if (texto(f.cuentaId) !== texto(original.cuentaId)) cambios.cuentaId = texto(f.cuentaId) || null;
  if (f.fecha !== original.fecha) cambios.fecha = f.fecha;
  return cambios;
}

export function sinCambios(cambios: object): boolean {
  return Object.keys(cambios).length === 0;
}
