import { crearPagoTarjeta } from "../repositories/pagosTarjeta.repo";
import { pagoTarjetaSchema } from "../schemas/pagoTarjeta.schema";
import type { PagoTarjeta } from "../types/domain";

/**
 * Registra un pago a una tarjeta de crédito. El aumento del cupo disponible
 * lo aplica un trigger en la base de datos (ver
 * supabase/migrations/20260826140000_finanzas_completas.sql), no este caso de uso.
 */
export async function registrarPagoTarjeta(input: unknown): Promise<PagoTarjeta> {
  const data = pagoTarjetaSchema.parse(input);
  return crearPagoTarjeta(data);
}
