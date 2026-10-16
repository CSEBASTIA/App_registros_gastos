import { z } from "zod";
import type { Billetera, MetodoPago, Ubicacion } from "../types/domain";

export const BILLETERAS = ["apple_pay", "google_wallet", "otra"] as const satisfies readonly Billetera[];

/** La base guarda 4 decimales (~11 m): redondear acá evita sorpresas al comparar. */
const a4Decimales = (v: number) => Math.round(v * 10_000) / 10_000;

/** Precisión máxima que se acepta del GPS, en metros (igual que el CHECK de la base). */
export const PRECISION_MAXIMA_M = 50_000;

export const ubicacionSchema = z.object({
  latitud: z
    .number({ invalid_type_error: "Latitud no válida." })
    .finite("Latitud no válida.")
    .min(-90, "Latitud no válida.")
    .max(90, "Latitud no válida.")
    .transform(a4Decimales),
  longitud: z
    .number({ invalid_type_error: "Longitud no válida." })
    .finite("Longitud no válida.")
    .min(-180, "Longitud no válida.")
    .max(180, "Longitud no válida.")
    .transform(a4Decimales),
  precisionM: z
    .number()
    .finite()
    .nonnegative()
    .max(PRECISION_MAXIMA_M)
    .transform(Math.round)
    .optional(),
});

export const billeteraSchema = z.enum(BILLETERAS);

/** Una billetera paga con tarjeta: no va con efectivo, transferencia ni "otro". */
export function billeteraCompatible(metodo: MetodoPago | "" | undefined): boolean {
  return metodo === undefined || metodo === "" || metodo === "debito" || metodo === "credito" || metodo === "diferido";
}

/**
 * Ubicación de un aviso que llega de fuera (atajo del iPhone, aviso de
 * Android): si viene mal, el aviso se guarda igual pero sin ubicación.
 */
export function ubicacionSegura(valor: unknown): Ubicacion | undefined {
  const r = ubicacionSchema.safeParse(valor);
  return r.success ? r.data : undefined;
}
