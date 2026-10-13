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
