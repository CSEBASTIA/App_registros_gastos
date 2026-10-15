import { z } from "zod";
import { LIMITES, montoPositivo, textoRequerido } from "./limites";

export const cuentaSchema = z
  .object({
    nombre: textoRequerido(LIMITES.nombre),
    tipo: z.enum(["debito", "credito", "efectivo", "ahorro"]),
    banco: z.enum(["banco_guayaquil", "pichincha", "produbanco", "diners_club", "banco_pacifico", "banco_austro", "otro"]).default("otro"),
    marca: z.enum(["amex", "visa", "mastercard", "diners", "otro"]).optional(),
    estilo: z
      .string()
      .max(LIMITES.estilo)
      .regex(/^[a-z0-9-]+$/, "Estilo inválido")
      .optional(),
    cupoTotal: montoPositivo().optional(),
    identificador: z
      .string()
      .trim()
      .min(3, "Los últimos dígitos deben ser 3 o 4 números")
      .max(4, "Los últimos dígitos deben ser 3 o 4 números")
      .regex(/^\d+$/, "Los últimos dígitos deben ser solo números")
      .optional(),
    disponible: z.number().min(-LIMITES.monto).max(LIMITES.monto),
  })
  .refine((c) => c.tipo !== "credito" || c.cupoTotal !== undefined, {
    message: "Una tarjeta de crédito necesita un cupo total",
    path: ["cupoTotal"],
  });

export type CuentaInput = z.infer<typeof cuentaSchema>;
