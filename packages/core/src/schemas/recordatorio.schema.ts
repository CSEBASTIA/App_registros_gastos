import { z } from "zod";

export const recordatorioSchema = z.object({
  titulo: z.string().min(1),
  tipo: z.enum(["pago", "prestamo", "tarjeta", "otro"]),
  monto: z.number().positive().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
  recurrente: z.boolean().default(false),
  frecuencia: z.enum(["semanal", "mensual", "anual"]).optional(),
  deudaId: z.string().uuid().optional(),
});

export type RecordatorioInput = z.infer<typeof recordatorioSchema>;
