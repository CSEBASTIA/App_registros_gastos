import { z } from "zod";

export const ingresoSchema = z.object({
  monto: z.number().positive(),
  descripcion: z.string().min(1),
  cuentaId: z.string().uuid().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
});

export type IngresoInput = z.infer<typeof ingresoSchema>;
