// Cómo reporta cada motor un fallo de red (sin internet, servidor caído,
// dominio inexistente): Chrome/Edge, React Native y Safari, respectivamente.
// Supabase además lo envuelve en un objeto plano con "TypeError: ..." delante.
const FALLO_DE_RED = /^(TypeError: )?(Failed to fetch|Network request failed|Load failed)$/i;

export const MENSAJE_SIN_CONEXION =
  "No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.";

interface ProblemaZod {
  code: string;
  message: string;
  path?: (string | number)[];
  received?: string;
}

/** Un ZodError trae `issues`; su `.message` es un JSON en inglés que nunca debe verse. */
function problemaDeValidacion(err: unknown): ProblemaZod | undefined {
  const issues = (err as { issues?: unknown })?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return undefined;
  return issues[0] as ProblemaZod;
}

function mensajeDeValidacion(p: ProblemaZod): string {
  const campo = typeof p.path?.[0] === "string" ? String(p.path[0]) : "";
  if (p.code === "invalid_type" && (p.received === "nan" || p.received === "undefined" || p.received === "null")) {
    return campo === "monto" || campo.startsWith("monto") || campo.startsWith("cupo") || campo.startsWith("cuota")
      ? "Escribe un monto válido, por ejemplo 12,50."
      : "Completa todos los campos obligatorios.";
  }
  // Los mensajes propios de los schemas ya están en español; los de zod en inglés, no.
  if (/^(Invalid|Expected|Required|Unrecognized|Too (big|small)|(String|Number|Array|Value) must)/.test(p.message)) {
    return "Revisa los datos ingresados: alguno no tiene el formato esperado.";
  }
  return p.message;
}

/** Errores de Postgres que pueden llegar a la pantalla, por código SQLSTATE. */
function mensajeDePostgres(codigo: string | undefined): string | undefined {
  switch (codigo) {
    case "23503":
      return "No se puede completar: hay otros datos que dependen de este registro.";
    case "23514":
      return "Algún dato no cumple las reglas (por ejemplo, un texto demasiado largo o un monto inválido).";
    case "23505":
      return "Ese registro ya existe.";
    case "57014":
      return "La operación tardó demasiado. Inténtalo de nuevo.";
    default:
      return undefined;
  }
}

/**
 * Convierte cualquier error en un mensaje para la persona.
 * - Los errores de Supabase (PostgrestError, AuthError, StorageError) NO son
 *   instancias de `Error`: son objetos planos con `message` (y `code`).
 * - Los de validación (zod) se reducen al primer problema, en español.
 * - Los de red se traducen a un mensaje claro.
 * - Los de Postgres conocidos (clave foránea, regla, duplicado) se traducen;
 *   los mensajes propios de la base (triggers) ya están en español y pasan tal cual.
 */
export function mensajeError(err: unknown): string {
  const problema = problemaDeValidacion(err);
  if (problema) return mensajeDeValidacion(problema);

  let mensaje: string;
  let codigo: string | undefined;
  if (err instanceof Error) {
    mensaje = err.message;
    codigo = (err as { code?: string }).code;
  } else if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    mensaje = (err as { message: string }).message;
    codigo = (err as { code?: string }).code;
  } else {
    return String(err);
  }

  if (FALLO_DE_RED.test(mensaje.trim())) return MENSAJE_SIN_CONEXION;
  return mensajeDePostgres(codigo) ?? mensaje;
}
