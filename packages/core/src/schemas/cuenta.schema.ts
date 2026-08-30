import { z } from "zod";

export const cuentaSchema = z
  .object({
    nombre: z.string().min(1),
    tipo: z.enum(["debito", "credito", "efectivo", "ahorro"]),
    banco: z.enum(["banco_guayaquil", "pichincha", "produbanco", "otro"]).default("otro"),
    marca: z.enum(["amex", "visa", "mastercard", "diners", "otro"]).optional(),
    estilo: z.string().min(1).optional(),
    cupoTotal: z.number().positive().optional(),
    disponible: z.number(),
  })
  .refine((c) => c.tipo !== "credito" || c.cupoTotal !== undefined, {
    message: "Una tarjeta de crédito necesita un cupo total",
    path: ["cupoTotal"],
  });

export type CuentaInput = z.infer<typeof cuentaSchema>;
