import { z } from "zod";

export const deudaSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(["prestamo", "tarjeta", "otro"]),
  montoTotal: z.number().positive(),
  saldoPendiente: z.number().nonnegative(),
  cuotaMensual: z.number().nonnegative(),
  tasaInteres: z.number().nonnegative().optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
  proximoPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD")
    .optional(),
  cuentaId: z.string().uuid().optional(),
});

export type DeudaInput = z.infer<typeof deudaSchema>;
