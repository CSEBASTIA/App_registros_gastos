import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { leerEnv, revisar, revisarDocumentosLegales } from "../scripts/entornoPublicacion.mjs";

// JWT de mentira (solo importa el payload): así se ven las claves de Supabase.
const jwt = (role) =>
  ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "firma"].join(".");

const ok = {
  EXPO_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
};

test("revisar: una configuración en la nube con clave anon está lista", () => {
  assert.deepEqual(revisar(ok), []);
  assert.deepEqual(revisar({ ...ok, EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xyz" }), []);
});

test("revisar: frena una URL local, de red interna o sin https", () => {
  for (const url of [
    "http://127.0.0.1:54321",
    "https://localhost:54321",
    "https://192.168.1.20:54321",
    "https://10.0.2.2:54321",
    "http://abcdefgh.supabase.co",
  ]) {
    assert.ok(revisar({ ...ok, EXPO_PUBLIC_SUPABASE_URL: url }).length > 0, url);
  }
});

test("revisar: frena la clave service_role o secreta (acceso total a la base)", () => {
  const errores = revisar({ ...ok, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") });
  assert.equal(errores.length, 1);
  assert.match(errores[0], /SECRETA/);
  assert.ok(revisar({ ...ok, EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc" }).length > 0);
});

test("revisar: frena si faltan variables o si quedó activo el modo sin login", () => {
  assert.equal(revisar({}).length, 2);
  assert.ok(revisar({ ...ok, EXPO_PUBLIC_SIN_LOGIN: "1" }).some((e) => /SIN_LOGIN/.test(e)));
});

const legal = {
  EXPO_PUBLIC_URL_PRIVACIDAD: "https://mi-app.vercel.app/privacidad.html",
  EXPO_PUBLIC_URL_TERMINOS: "https://mi-app.vercel.app/terminos.html",
  EXPO_PUBLIC_CORREO_PRIVACIDAD: "privacidad@mi-app.com",
  EXPO_PUBLIC_EXIGIR_ACEPTACION: "1",
};

test("revisar: para la tienda exige política, términos, correo de privacidad y la aceptación encendida; para pruebas no", () => {
  assert.deepEqual(revisar(ok), [], "el APK de prueba no los necesita");
  const faltan = revisar(ok, { produccion: true });
  for (const nombre of [
    "EXPO_PUBLIC_URL_PRIVACIDAD",
    "EXPO_PUBLIC_URL_TERMINOS",
    "EXPO_PUBLIC_CORREO_PRIVACIDAD",
    "EXPO_PUBLIC_EXIGIR_ACEPTACION",
  ]) {
    assert.ok(faltan.some((e) => e.includes(nombre)), `debe avisar que falta ${nombre}`);
  }
  assert.deepEqual(revisar({ ...ok, ...legal }, { produccion: true }), []);
});

test("revisar: la aceptación debe estar en 1 para publicar (vacía, 0 o true no valen)", () => {
  for (const valor of [undefined, "", "0", "true", "si", " 1"]) {
    const errores = revisar({ ...ok, ...legal, EXPO_PUBLIC_EXIGIR_ACEPTACION: valor }, { produccion: true });
    assert.equal(errores.length, 1, JSON.stringify(valor));
    assert.match(errores[0], /EXPO_PUBLIC_EXIGIR_ACEPTACION/);
  }
  assert.deepEqual(revisar({ ...ok, EXPO_PUBLIC_EXIGIR_ACEPTACION: "0" }), [], "para pruebas (APK) no se exige");
});

test("revisar: las direcciones legales deben ser https públicas (no http, no localhost, no relativas)", () => {
  for (const nombre of ["EXPO_PUBLIC_URL_PRIVACIDAD", "EXPO_PUBLIC_URL_TERMINOS"]) {
    for (const url of ["http://mi-app.vercel.app/x.html", "https://localhost/x.html", "https://127.0.0.1/x.html", "x.html", "/x.html"]) {
      const errores = revisar({ ...ok, ...legal, [nombre]: url }, { produccion: true });
      assert.equal(errores.length, 1, `${nombre} = ${url}`);
      assert.match(errores[0], new RegExp(nombre));
    }
  }
});

test("revisar: el correo de privacidad debe ser un correo", () => {
  for (const mal of ["privacidad", "privacidad@", "@mi-app.com", "privacidad@mi-app", "a b@mi-app.com", "<x@mi-app.com>"]) {
    const errores = revisar({ ...ok, ...legal, EXPO_PUBLIC_CORREO_PRIVACIDAD: mal }, { produccion: true });
    assert.equal(errores.length, 1, mal);
    assert.match(errores[0], /EXPO_PUBLIC_CORREO_PRIVACIDAD/);
  }
});

/** Una carpeta public/ de mentira con las dos páginas. */
function publicConPaginas(terminos, privacidad) {
  const dir = mkdtempSync(join(tmpdir(), "legal-"));
  if (terminos !== null) writeFileSync(join(dir, "terminos.html"), terminos);
  if (privacidad !== null) writeFileSync(join(dir, "privacidad.html"), privacidad);
  return dir;
}
const pagina = (cuerpo, version = "2026-10-16") =>
  `<!doctype html>\n<!-- BORRADOR: completar [corchetes] -->\n<html><head><meta name="version-legal" content="${version}"></head><body>${cuerpo}</body></html>`;

test("revisarDocumentosLegales: páginas completas y con versión están listas (los comentarios no cuentan)", () => {
  const dir = publicConPaginas(pagina("<p>Términos de Ana Pérez</p>"), pagina("<p>Privacidad de Ana Pérez</p>"));
  try {
    assert.deepEqual(revisarDocumentosLegales(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("revisarDocumentosLegales: frena si quedan datos [por completar], listándolos sin repetir", () => {
  const dir = publicConPaginas(
    pagina('<p>[Nombre completo o razón social]</p><a href="mailto:[correo de contacto]">[correo de contacto]</a>'),
    pagina("<p>Todo completo</p>")
  );
  try {
    const errores = revisarDocumentosLegales(dir);
    assert.equal(errores.length, 1);
    assert.match(errores[0], /terminos\.html/);
    assert.match(errores[0], /\[Nombre completo o razón social\], \[correo de contacto\]\.$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("revisarDocumentosLegales: frena si falta una página o su versión", () => {
  const dir = publicConPaginas(null, "<html><body>sin versión</body></html>");
  try {
    const errores = revisarDocumentosLegales(dir);
    assert.ok(errores.some((e) => /Falta public\/terminos\.html/.test(e)));
    assert.ok(errores.some((e) => /privacidad\.html no declara su versión/.test(e)));
    assert.equal(errores.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("revisarDocumentosLegales: las páginas reales de public/ existen y declaran su versión (lo único pendiente son datos por completar)", () => {
  const errores = revisarDocumentosLegales(fileURLToPath(new URL("../public", import.meta.url)));
  // Mientras haya [datos por completar] el verificador frena la publicación, y eso es lo esperado;
  // cualquier otro problema (falta un archivo o su versión) es un error de las páginas.
  assert.ok(errores.every((e) => /por completar/.test(e)), `problemas que no son datos por completar: ${errores.join(" | ")}`);
});

test("leerEnv: .env.production manda sobre .env, y el entorno manda sobre ambos", () => {
  const dir = mkdtempSync(join(tmpdir(), "entorno-"));
  try {
    writeFileSync(join(dir, ".env"), "EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nEXPO_PUBLIC_X=1\n");
    writeFileSync(join(dir, ".env.production"), 'EXPO_PUBLIC_SUPABASE_URL="https://nube.supabase.co"\n');

    const { valores, origen } = leerEnv(dir, {});
    assert.equal(valores.EXPO_PUBLIC_SUPABASE_URL, "https://nube.supabase.co");
    assert.equal(origen.EXPO_PUBLIC_SUPABASE_URL, ".env.production");
    assert.equal(valores.EXPO_PUBLIC_X, "1");

    const conEntorno = leerEnv(dir, { EXPO_PUBLIC_SUPABASE_URL: "https://eas.supabase.co" });
    assert.equal(conEntorno.valores.EXPO_PUBLIC_SUPABASE_URL, "https://eas.supabase.co");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("leerEnv: sin .env.production, se usaría el .env local y revisar lo frena", () => {
  const dir = mkdtempSync(join(tmpdir(), "entorno-"));
  try {
    writeFileSync(join(dir, ".env"), `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt("anon")}\n`);
    const { valores } = leerEnv(dir, {});
    assert.ok(revisar(valores).some((e) => /local/.test(e)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
