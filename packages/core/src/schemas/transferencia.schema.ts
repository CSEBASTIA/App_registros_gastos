import { z } from "zod";
import { LIMITES, fechaIso, montoPositivo } from "./limites";

/** Mismas reglas que la base (validar_transferencia): dos cuentas propias y distintas. */
export const transferenciaSchema = z
  .object({
    cuentaOrigenId: z.string({ required_error: "Elige la cuenta de origen." }).uuid("Elige la cuenta de origen."),
    cuentaDestinoId: z.string({ required_error: "Elige la cuenta de destino." }).uuid("Elige la cuenta de destino."),
    monto: montoPositivo(),
    fecha: fechaIso(),
    descripcion: z.string().trim().max(LIMITES.descripcion, `Máximo ${LIMITES.descripcion} caracteres`).optional(),
  })
  .refine((t) => t.cuentaOrigenId !== t.cuentaDestinoId, {
    message: "La cuenta de origen y la de destino deben ser distintas.",
    path: ["cuentaDestinoId"],
  });

export type TransferenciaInput = z.infer<typeof transferenciaSchema>;

/** Confirmar un aviso de la bandeja como transferencia: la cuenta del aviso y la otra. */
export const avisoComoTransferenciaSchema = z
  .object({
    cuentaId: z.string({ required_error: "Elige la cuenta del aviso." }).uuid("Elige la cuenta del aviso."),
    otraCuentaId: z.string({ required_error: "Elige la otra cuenta." }).uuid("Elige la otra cuenta."),
    monto: montoPositivo().optional(),
    descripcion: z.string().trim().max(LIMITES.descripcion, `Máximo ${LIMITES.descripcion} caracteres`).optional(),
  })
  .refine((t) => t.cuentaId !== t.otraCuentaId, {
    message: "Las dos cuentas deben ser distintas.",
    path: ["otraCuentaId"],
  });

export type AvisoComoTransferenciaInput = z.infer<typeof avisoComoTransferenciaSchema>;
