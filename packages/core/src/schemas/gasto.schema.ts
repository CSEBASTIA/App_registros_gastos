import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo, textoRequerido } from "./limites";

export const gastoSchema = z
  .object({
    monto: montoPositivo(),
    descripcion: textoRequerido(LIMITES.descripcion),
    categoriaId: z.string({ required_error: "Elige una categoría." }).uuid("Elige una categoría."),
    categoriaDetalle: textoRequerido(LIMITES.detalle).optional(),
    cuentaId: z.string().uuid().optional(),
    metodoPago: z.enum(["efectivo", "debito", "credito", "transferencia", "diferido", "otro"]).optional(),
    mesesDiferido: z.number().int().min(1, "De 1 a 24 meses").max(24, "De 1 a 24 meses").optional(),
    tasaInteres: z.number().nonnegative("La tasa no puede ser negativa.").max(LIMITES.tasaInteres, "La tasa anual es demasiado alta.").optional(),
    facturaPath: z.string().min(1).max(LIMITES.facturaPath).optional(),
    fecha: fechaIso(),
  })
  // Un diferido sin plazo no generaba su deuda. (Que vaya a una tarjeta de
  // crédito lo comprueba la base, que conoce el tipo de cuenta.)
  .refine((g) => g.metodoPago !== "diferido" || g.mesesDiferido !== undefined, {
    message: "Indica a cuántos meses es el diferido.",
    path: ["mesesDiferido"],
  })
  .refine((g) => g.metodoPago !== "diferido" || g.cuentaId !== undefined, {
    message: "Elegí una tarjeta de crédito para el diferido.",
    path: ["cuentaId"],
  });

export type GastoInput = z.infer<typeof gastoSchema>;

/**
 * Cambios al editar un gasto: solo se validan los campos enviados. `""` en
 * detalle, cuenta o método significa "quitarlo" (así lo envía la web).
 */
export const cambiosGastoSchema = z.object({
  monto: montoPositivo().optional(),
  descripcion: textoRequerido(LIMITES.descripcion).optional(),
  categoriaId: z.string().uuid("Elige una categoría.").optional(),
  categoriaDetalle: z.union([z.literal(""), textoRequerido(LIMITES.detalle)]).optional(),
  cuentaId: z.union([z.literal(""), z.string().uuid()]).optional(),
  metodoPago: z.union([z.literal(""), z.enum(["efectivo", "debito", "credito", "transferencia", "diferido", "otro"])]).optional(),
  fecha: fechaIso().optional(),
});
