import { z } from "zod";
import { fechaIso, montoPositivo } from "./limites";

export const pagoTarjetaSchema = z
  .object({
    cuentaId: z.string().uuid(),
    cuentaOrigenId: z.string().uuid().optional(),
    monto: montoPositivo(),
    fecha: fechaIso(),
  })
  .refine((p) => p.cuentaOrigenId !== p.cuentaId, {
    message: "La cuenta de origen no puede ser la misma tarjeta",
    path: ["cuentaOrigenId"],
  });

export type PagoTarjetaInput = z.infer<typeof pagoTarjetaSchema>;
