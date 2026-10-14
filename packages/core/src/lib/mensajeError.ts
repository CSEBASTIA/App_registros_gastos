// Cómo reporta cada motor un fallo de red (sin internet, servidor caído,
// dominio inexistente): Chrome/Edge, React Native y Safari, respectivamente.
// Supabase además lo envuelve en un objeto plano con "TypeError: ..." delante.
const FALLO_DE_RED = /^(TypeError: )?(Failed to fetch|Network request failed|Load failed)$/i;

export const MENSAJE_SIN_CONEXION =
  "No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.";

/**
 * Los errores de Supabase (PostgrestError, AuthError, StorageError) NO son
 * instancias de `Error` de JS — son objetos planos con un campo `message`.
 * `err instanceof Error ? err.message : String(err)` los deja pasar por el
 * `String(err)`, que para un objeto plano da literalmente "[object Object]"
 * en vez del mensaje real. Esta función cubre los dos casos, y traduce los
 * fallos de red a un mensaje que el usuario entienda.
 */
export function mensajeError(err: unknown): string {
  let mensaje: string;
  if (err instanceof Error) {
    mensaje = err.message;
  } else if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    mensaje = (err as { message: string }).message;
  } else {
    return String(err);
  }
  return FALLO_DE_RED.test(mensaje.trim()) ? MENSAJE_SIN_CONEXION : mensaje;
}
