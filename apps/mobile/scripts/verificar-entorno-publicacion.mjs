#!/usr/bin/env node
// Frena una publicación (`eas update` / `eas build`) si las variables con las
// que se va a armar la app son peligrosas o incorrectas:
//   - URL de Supabase local o sin https (la app de los usuarios no conectaría),
//   - clave service_role o secreta (acceso total a la base para cualquiera),
//   - falta alguna variable obligatoria.
// Todo lo que empieza con EXPO_PUBLIC_ queda dentro de la app y es legible.
// Uso (desde apps/mobile): node scripts/verificar-entorno-publicacion.mjs

import { leerEnv, revisar } from "./entornoPublicacion.mjs";

const { valores, origen } = leerEnv(process.cwd());
const errores = revisar(valores);

if (errores.length > 0) {
  console.error("✖ No se puede publicar todavía:");
  for (const e of errores) console.error("  - " + e);
  console.error("\nRevisa apps/mobile/.env.production (ver docs/actualizaciones.md).");
  process.exit(1);
}

const host = new URL(valores.EXPO_PUBLIC_SUPABASE_URL).hostname;
console.log(
  `✔ Entorno listo para publicar: Supabase ${host} (desde ${origen.EXPO_PUBLIC_SUPABASE_URL}), clave pública.`
);
