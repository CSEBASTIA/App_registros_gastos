import { getSupabaseClient } from "../client";

/**
 * BOTÓN TEMPORAL DE DESARROLLO: borra TODOS los datos del usuario actual
 * (gastos, ingresos, cuentas, deudas, recordatorios, pagos de tarjeta y sus
 * categorías propias — las globales quedan). RLS ya limita cada delete al
 * usuario autenticado; el orden respeta las foreign keys que no tienen
 * ON DELETE CASCADE/SET NULL (recordatorios -> deudas, gastos/ingresos ->
 * categorías propias).
 *
 * Quitar el botón que llama a esto (y de paso este archivo) antes de un
 * lanzamiento real — no tiene "deshacer".
 */
export async function eliminarTodosLosDatos(): Promise<void> {
  const client = getSupabaseClient();
  const tablas = [
    "recordatorios",
    "pagos_tarjeta",
    "gastos",
    "ingresos",
    "deudas",
    "cuentas",
    "categorias",
  ] as const;

  for (const tabla of tablas) {
    const { error } = await client.from(tabla).delete().not("id", "is", null);
    if (error) throw error;
  }
}
