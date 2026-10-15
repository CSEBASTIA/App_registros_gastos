import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leerEnv, revisar } from "../scripts/entornoPublicacion.mjs";

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
