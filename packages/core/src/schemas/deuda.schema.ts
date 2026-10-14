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

export const abonoDeudaSchema = z.object({
  deudaId: z.string().uuid(),
  monto: montoPositivo(),
  /** Cuenta de ahorro/débito/efectivo de la que sale el dinero (opcional). */
  cuentaId: z.string().uuid().optional(),
  fecha: fechaIso(),
});

export type AbonoDeudaInput = z.infer<typeof abonoDeudaSchema>;
