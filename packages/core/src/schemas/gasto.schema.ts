import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo, textoRequerido } from "./limites";

export const gastoSchema = z.object({
  monto: montoPositivo(),
  descripcion: textoRequerido(LIMITES.descripcion),
  categoriaId: z.string().uuid(),
  categoriaDetalle: textoRequerido(LIMITES.detalle).optional(),
  cuentaId: z.string().uuid().optional(),
  metodoPago: z.enum(["efectivo", "debito", "credito", "transferencia", "diferido", "otro"]).optional(),
  mesesDiferido: z.number().int().min(1).max(24).optional(),
  facturaPath: z.string().min(1).max(LIMITES.facturaPath).optional(),
  fecha: fechaIso(),
});

export type GastoInput = z.infer<typeof gastoSchema>;
