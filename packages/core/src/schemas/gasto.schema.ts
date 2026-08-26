import { z } from "zod";

export const gastoSchema = z.object({
  monto: z.number().positive(),
  descripcion: z.string().min(1),
  categoriaId: z.string().uuid(),
  fecha: z.string(),
});

export type GastoInput = z.infer<typeof gastoSchema>;
