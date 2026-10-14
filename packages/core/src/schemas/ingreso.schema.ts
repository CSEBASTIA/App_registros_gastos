import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo, textoRequerido } from "./limites";

export const ingresoSchema = z.object({
  monto: montoPositivo(),
  descripcion: textoRequerido(LIMITES.descripcion),
  categoriaId: z.string().uuid().optional(),
  categoriaDetalle: textoRequerido(LIMITES.detalle).optional(),
  cuentaId: z.string().uuid().optional(),
  fecha: fechaIso(),
});

export type IngresoInput = z.infer<typeof ingresoSchema>;

/**
 * Cambios al editar un ingreso: solo los campos enviados se actualizan.
 * `null` en categoría, detalle o cuenta significa "quitarlo". El reajuste
 * del saldo lo hace la base (trigger ajustar_ingreso_actualizado).
 */
export const cambiosIngresoSchema = z
  .object({
    monto: montoPositivo().optional(),
    descripcion: textoRequerido(LIMITES.descripcion).optional(),
    categoriaId: z.string().uuid().nullable().optional(),
    categoriaDetalle: textoRequerido(LIMITES.detalle).nullable().optional(),
    cuentaId: z.string().uuid().nullable().optional(),
    fecha: fechaIso().optional(),
  })
  .refine((c) => Object.values(c).some((v) => v !== undefined), {
    message: "No hay cambios para guardar",
  });

export type CambiosIngreso = z.infer<typeof cambiosIngresoSchema>;
