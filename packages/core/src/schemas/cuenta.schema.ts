import { z } from "zod";
import { LIMITES, montoPositivo, textoRequerido } from "./limites";
import { OPCIONES_CASA_COMERCIAL } from "../lib/marcas";

const BANCOS = [
  "banco_guayaquil", "pichincha", "produbanco", "diners_club", "banco_pacifico", "banco_austro", "otro",
  "comandato", "artefacta", "marcimex", "la_ganga", "japon", "de_prati", "creditos_economicos", "otra_casa_comercial",
] as const;
const diaDelMes = (nombre: string) =>
  z.number({ invalid_type_error: `Escribe el día de ${nombre} (1 a 31).` }).int(`Escribe el día de ${nombre} (1 a 31).`).min(1, `El día de ${nombre} va de 1 a 31.`).max(31, `El día de ${nombre} va de 1 a 31.`);

export const cuentaSchema = z
  .object({
    nombre: textoRequerido(LIMITES.nombre),
    tipo: z.enum(["debito", "credito", "efectivo", "ahorro"]),
    banco: z.enum(BANCOS).default("otro"),
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
    diaCorte: diaDelMes("corte").optional(),
    diaPago: diaDelMes("pago").optional(),
  })
  .refine((c) => c.tipo === "credito" || (c.diaCorte === undefined && c.diaPago === undefined), {
    message: "La fecha de corte y de pago solo aplican a tarjetas de crédito.",
    path: ["diaCorte"],
  })
  .refine((c) => c.tipo === "credito" || !OPCIONES_CASA_COMERCIAL.includes(c.banco), {
    message: "Una casa comercial o crédito directo se registra como tarjeta de crédito.",
    path: ["tipo"],
  })
  .refine((c) => c.tipo !== "credito" || c.cupoTotal !== undefined, {
    message: "Una tarjeta de crédito necesita un cupo total",
    path: ["cupoTotal"],
  });

export type CuentaInput = z.infer<typeof cuentaSchema>;

/** Cambiar el día de corte y de pago de una tarjeta. `null` lo quita. */
export const fechasTarjetaSchema = z.object({
  diaCorte: diaDelMes("corte").nullable().optional(),
  diaPago: diaDelMes("pago").nullable().optional(),
});

/**
 * Los últimos dígitos de una cuenta o tarjeta, para reconocer sus avisos (del
 * correo, de Apple Pay o de Google Wallet). Vacío los quita.
 */
export const identificadorCuentaSchema = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, "Los últimos dígitos deben ser 3 o 4 números"),
]);
