// Lógica del verificador de publicación (sin efectos: se puede probar).
// La usa scripts/verificar-entorno-publicacion.mjs antes de `eas update` / `eas build`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Mismo orden de prioridad que usa Expo con NODE_ENV=production (el primero gana).
const ARCHIVOS = [".env.production.local", ".env.local", ".env.production", ".env"];

/** Variables EXPO_PUBLIC_* tal como las vería `expo export` en producción, y de qué archivo salió cada una. */
export function leerEnv(directorio, entorno = process.env) {
  const valores = {};
  const origen = {};
  for (const archivo of [...ARCHIVOS].reverse()) {
    const ruta = join(directorio, archivo);
    if (!existsSync(ruta)) continue;
    for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      valores[m[1]] = m[2].replace(/^["']|["']$/g, "");
      origen[m[1]] = archivo;
    }
  }
  // Las variables del entorno (p. ej. inyectadas por EAS) tienen prioridad.
  for (const [clave, valor] of Object.entries(entorno)) {
    if (clave.startsWith("EXPO_PUBLIC_") && valor !== undefined) {
      valores[clave] = valor;
      origen[clave] = "variable de entorno";
    }
  }
  return { valores, origen };
}

function rolDelJwt(token) {
  const partes = token.split(".");
  if (partes.length !== 3) return undefined;
  try {
    return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}

const HOST_LOCAL =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?)$/i;

/** Devuelve la lista de problemas que impiden publicar (vacía = todo bien). */
export function revisar(valores) {
  const errores = [];
  const url = valores.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const clave = valores.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url) {
    errores.push("Falta EXPO_PUBLIC_SUPABASE_URL.");
  } else {
    let host = "";
    try {
      const u = new URL(url);
      host = u.hostname;
      if (u.protocol !== "https:") errores.push(`La URL de Supabase debe usar https (es ${u.protocol}//${host}).`);
    } catch {
      errores.push("EXPO_PUBLIC_SUPABASE_URL no es una URL válida.");
    }
    if (host && HOST_LOCAL.test(host)) {
      errores.push(
        `La URL de Supabase apunta a una dirección local (${host}): los teléfonos de los usuarios no podrían conectarse.`
      );
    }
  }

  if (!clave) {
    errores.push("Falta EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  } else if (clave.startsWith("sb_secret_") || rolDelJwt(clave) === "service_role") {
    errores.push(
      "EXPO_PUBLIC_SUPABASE_ANON_KEY es una clave SECRETA (service_role): daría acceso total a la base a cualquiera que descargue la app. Usa la clave anon/publishable."
    );
  }

  if (valores.EXPO_PUBLIC_SIN_LOGIN === "1") {
    errores.push("EXPO_PUBLIC_SIN_LOGIN=1 es solo para desarrollo: quítalo antes de publicar.");
  }
  return errores;
}
