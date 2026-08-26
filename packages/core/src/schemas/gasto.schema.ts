import { z } from "zod";

export const gastoSchema = z.object({
  monto: z.number().positive(),
  descripcion: z.string().min(1),
  categoriaId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
});

export type GastoInput = z.infer<typeof gastoSchema>;
