import { z } from "zod";

export const pagoTarjetaSchema = z.object({
  cuentaId: z.string().uuid(),
  monto: z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
});

export type PagoTarjetaInput = z.infer<typeof pagoTarjetaSchema>;
