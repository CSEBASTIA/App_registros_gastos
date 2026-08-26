import { z } from "zod";

export const presupuestoSchema = z.object({
  categoriaId: z.string().uuid(),
  montoLimite: z.number().positive(),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado: YYYY-MM"),
});

export type PresupuestoInput = z.infer<typeof presupuestoSchema>;
