import { z } from "zod";

export const gastoSchema = z.object({
  monto: z.number().positive(),
  descripcion: z.string().min(1),
  categoriaId: z.string().uuid(),
  categoriaDetalle: z.string().min(1).optional(),
  cuentaId: z.string().uuid().optional(),
  metodoPago: z.enum(["efectivo", "debito", "credito", "transferencia", "diferido", "otro"]).optional(),
  mesesDiferido: z.number().int().min(1).max(24).optional(),
  facturaPath: z.string().min(1).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
});

export type GastoInput = z.infer<typeof gastoSchema>;
