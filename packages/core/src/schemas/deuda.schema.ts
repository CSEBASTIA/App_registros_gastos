import { z } from "zod";
import { LIMITES, fechaIso, montoNoNegativo, montoPositivo, textoRequerido } from "./limites";

export const deudaSchema = z.object({
  nombre: textoRequerido(LIMITES.nombre),
  tipo: z.enum(["prestamo", "tarjeta", "otro"]),
  montoTotal: montoPositivo(),
  saldoPendiente: montoNoNegativo(),
  cuotaMensual: montoNoNegativo(),
  tasaInteres: z.number().nonnegative().max(LIMITES.tasaInteres).optional(),
  fechaInicio: fechaIso(),
  proximoPago: fechaIso().optional(),
  cuentaId: z.string().uuid().optional(),
});

export type DeudaInput = z.infer<typeof deudaSchema>;
