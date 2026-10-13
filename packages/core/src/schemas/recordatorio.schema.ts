import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo, textoRequerido } from "./limites";

export const recordatorioSchema = z.object({
  titulo: textoRequerido(LIMITES.titulo),
  tipo: z.enum(["pago", "prestamo", "tarjeta", "otro"]),
  monto: montoPositivo().optional(),
  fecha: fechaIso(),
  recurrente: z.boolean().default(false),
  frecuencia: z.enum(["semanal", "mensual", "anual"]).optional(),
  deudaId: z.string().uuid().optional(),
});

export type RecordatorioInput = z.infer<typeof recordatorioSchema>;
