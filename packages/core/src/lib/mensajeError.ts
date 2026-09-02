/**
 * Los errores de Supabase (PostgrestError, AuthError, StorageError) NO son
 * instancias de `Error` de JS — son objetos planos con un campo `message`.
 * `err instanceof Error ? err.message : String(err)` los deja pasar por el
 * `String(err)`, que para un objeto plano da literalmente "[object Object]"
 * en vez del mensaje real. Esta función cubre los dos casos.
 */
export function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err);
}
