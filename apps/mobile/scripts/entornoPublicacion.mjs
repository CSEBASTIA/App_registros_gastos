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

const URL_PUBLICA = /^https:\/\/[^/\s]+\.[^/\s]+\//;
const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** https, con dominio (no `localhost`) y que no apunte a una dirección local o de red interna. */
function esUrlPublica(valor) {
  if (!URL_PUBLICA.test(valor)) return false;
  try {
    return !HOST_LOCAL.test(new URL(valor).hostname);
  } catch {
    return false;
  }
}

/** Documentos legales que la app enlaza desde el registro y desde Más. */
const URLS_LEGALES = [
  {
    nombre: "EXPO_PUBLIC_URL_PRIVACIDAD",
    queEs: "dirección pública de la política de privacidad",
    ejemplo: "https://tu-app.vercel.app/privacidad.html",
  },
  {
    nombre: "EXPO_PUBLIC_URL_TERMINOS",
    queEs: "dirección pública de los términos y condiciones",
    ejemplo: "https://tu-app.vercel.app/terminos.html",
  },
];

/**
 * Devuelve la lista de problemas que impiden publicar (vacía = todo bien).
 * Con `produccion` (tienda y actualizaciones a usuarios reales) exige además
 * lo legal: las direcciones públicas de la política de privacidad (Google Play
 * la pide) y de los términos, y un correo de contacto para temas de privacidad.
 * La app enlaza esas direcciones desde Más y el registro.
 */
export function revisar(valores, { produccion = false } = {}) {
  const errores = [];
  if (produccion) {
    for (const { nombre, queEs, ejemplo } of URLS_LEGALES) {
      const valor = valores[nombre] ?? "";
      if (!valor) {
        errores.push(`Falta ${nombre} (${queEs}).`);
      } else if (!esUrlPublica(valor)) {
        errores.push(`${nombre} debe ser una dirección https pública (por ejemplo ${ejemplo}).`);
      }
    }
    if (valores.EXPO_PUBLIC_EXIGIR_ACEPTACION !== "1") {
      errores.push(
        "Falta EXPO_PUBLIC_EXIGIR_ACEPTACION=1: sin esto la app no pide aceptar los términos ni la política de privacidad (antes, aplica en Supabase las migraciones de aceptación)."
      );
    }
    const correo = valores.EXPO_PUBLIC_CORREO_PRIVACIDAD ?? "";
    if (!correo) {
      errores.push("Falta EXPO_PUBLIC_CORREO_PRIVACIDAD (correo de contacto para temas de privacidad).");
    } else if (!CORREO.test(correo)) {
      errores.push("EXPO_PUBLIC_CORREO_PRIVACIDAD no es un correo válido.");
    }
  }
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

const PAGINAS_LEGALES = ["terminos.html", "privacidad.html"];

/**
 * Problemas de las páginas legales de `directorio` (la carpeta `public/`);
 * vacío = listas para publicar. Se niega mientras quede un dato `[por completar]`
 * (responsable, correo, fecha…) o falte la versión que la app compara para
 * pedir de nuevo la aceptación. Los comentarios HTML no cuentan.
 */
export function revisarDocumentosLegales(directorio) {
  const errores = [];
  for (const archivo of PAGINAS_LEGALES) {
    const ruta = join(directorio, archivo);
    if (!existsSync(ruta)) {
      errores.push(`Falta public/${archivo}.`);
      continue;
    }
    const visible = readFileSync(ruta, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    const pendientes = [...new Set([...visible.matchAll(/\[([^\]\n]+)\]/g)].map((m) => m[1]))];
    if (pendientes.length > 0) {
      errores.push(`public/${archivo} todavía tiene datos por completar: ${pendientes.map((p) => `[${p}]`).join(", ")}.`);
    }
    if (!/<meta name="version-legal" content="\d{4}-\d{2}-\d{2}"/.test(visible)) {
      errores.push(`public/${archivo} no declara su versión (<meta name="version-legal" content="AAAA-MM-DD">).`);
    }
  }
  return errores;
}
