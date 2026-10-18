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

const FALTA_EN_LA_BASE = new Set(["PGRST202", "PGRST205", "PGRST204", "42703", "42883", "42P01"]);

/**
 * La función, tabla o columna todavía no existe: falta aplicar una migración.
 * Lo usan las funciones nuevas para seguir andando (sin la novedad) en una
 * base que aún no se actualizó, como pide docs/actualizaciones.md.
 */
export function faltaEnLaBase(err: unknown): boolean {
  return FALTA_EN_LA_BASE.has(String((err as { code?: unknown } | null)?.code ?? ""));
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
    // Función, tabla o columna que no existe: falta aplicar una migración en Supabase.
    case "PGRST202":
    case "PGRST205":
    case "PGRST204":
    case "42703":
    case "42883":
      return "Esta función todavía no está disponible: falta actualizar la base de datos.";
    default:
      return undefined;
  }
}

/**
 * Errores de inicio de sesión de Supabase (vienen en inglés: antes la
 * pantalla mostraba "Invalid login credentials"). Por código; si una versión
 * vieja no trae código, por el texto.
 */
const MENSAJES_AUTH: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Todavía no confirmaste tu correo. Revisa tu bandeja de entrada (y la de spam).",
  user_already_exists: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.",
  email_exists: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.",
  weak_password: "La contraseña es muy débil: usa al menos 8 caracteres, con letras y números.",
  same_password: "La nueva contraseña debe ser distinta de la anterior.",
  over_email_send_rate_limit: "Ya te enviamos un correo hace poco. Espera unos minutos antes de pedir otro.",
  over_request_rate_limit: "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.",
  otp_expired: "El enlace venció o ya se usó. Pide uno nuevo.",
  flow_state_not_found: "El enlace venció o se abrió en otro dispositivo. Pide uno nuevo desde este teléfono.",
  flow_state_expired: "El enlace venció. Pide uno nuevo.",
  bad_code_verifier: "El enlace se pidió desde otro dispositivo. Pide uno nuevo desde este teléfono.",
  email_address_invalid: "Ese correo no es válido.",
  validation_failed: "Revisa el correo y la contraseña.",
  signup_disabled: "El registro de cuentas nuevas está cerrado por ahora.",
  session_not_found: "Tu sesión venció. Vuelve a iniciar sesión.",
  refresh_token_not_found: "Tu sesión venció. Vuelve a iniciar sesión.",
};
const TEXTOS_AUTH: [RegExp, string][] = [
  [/^Invalid login credentials$/i, "invalid_credentials"],
  [/^Email not confirmed$/i, "email_not_confirmed"],
  [/^User already registered$/i, "user_already_exists"],
  [/^Email rate limit exceeded$/i, "over_email_send_rate_limit"],
];

function mensajeDeAuth(codigo: string | undefined, mensaje: string): string | undefined {
  if (codigo && MENSAJES_AUTH[codigo]) return MENSAJES_AUTH[codigo];
  const porTexto = TEXTOS_AUTH.find(([re]) => re.test(mensaje.trim()));
  return porTexto ? MENSAJES_AUTH[porTexto[1]] : undefined;
}

/**
 * Convierte cualquier error en un mensaje para la persona.
 * - Los errores de Supabase (PostgrestError, AuthError, StorageError) NO son
 *   instancias de `Error`: son objetos planos con `message` (y `code`).
 * - Los de validación (zod) se reducen al primer problema, en español.
 * - Los de red se traducen a un mensaje claro.
 * - Los de Postgres conocidos (clave foránea, regla, duplicado) se traducen;
 *   los mensajes propios de la base (triggers) ya están en español y pasan tal cual.
 * - Los de inicio de sesión (Supabase Auth) se traducen por código.
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
  return mensajeDePostgres(codigo) ?? mensajeDeAuth(codigo, mensaje) ?? mensaje;
}
