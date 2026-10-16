import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import {
  configuracionAtajo,
  configuracionGoogleWallet,
  PAQUETE_GOOGLE_WALLET,
  crearClaveCaptura,
  listarClavesCaptura,
  revocarClaveCaptura,
} from "../src/repositories/clavesCaptura.repo.ts";

test("crearClaveCaptura: valida el nombre antes de ir a la base y devuelve la clave", async () => {
  const llamadas: unknown[] = [];
  setSupabaseClient({
    rpc: async (fn: string, args: unknown) => (llamadas.push([fn, args]), { data: "ft_" + "a".repeat(64), error: null }),
  } as any);
  assert.equal(await crearClaveCaptura("  Mi iPhone "), "ft_" + "a".repeat(64));
  assert.deepEqual(llamadas, [["crear_clave_captura", { p_nombre: "Mi iPhone" }]]);

  await assert.rejects(crearClaveCaptura("   "));
  await assert.rejects(crearClaveCaptura("x".repeat(41)));
  assert.equal(llamadas.length, 1);
});

test("listarClavesCaptura: pide solo las columnas visibles (nunca la huella)", async () => {
  let columnas = "";
  setSupabaseClient({
    from: () => {
      const q: any = {
        select: (c: string) => ((columnas = c), q),
        order: async () => ({
          data: [{ id: "1", nombre: "Mi iPhone", prefijo: "ab12cd", created_at: "2026-10-16T10:00:00Z", ultimo_uso: null }],
          error: null,
        }),
      };
      return q;
    },
  } as any);
  const lista = await listarClavesCaptura();
  assert.equal(columnas.includes("huella"), false);
  assert.equal(columnas.includes("*"), false);
  assert.deepEqual(lista, [{ id: "1", nombre: "Mi iPhone", prefijo: "ab12cd", createdAt: "2026-10-16T10:00:00Z", ultimoUso: undefined }]);
});

test("revocarClaveCaptura: borra la clave por id", async () => {
  const pasos: string[] = [];
  setSupabaseClient({
    from: (t: string) => ({ delete: () => ({ eq: async (c: string, v: string) => (pasos.push(`${t} ${c}=${v}`), { error: null }) }) }),
  } as any);
  await revocarClaveCaptura("abc");
  assert.deepEqual(pasos, ["claves_captura id=abc"]);
});

test("configuracionAtajo: la URL de la función, la clave pública en el encabezado y la de captura en el cuerpo", () => {
  const c = configuracionAtajo("https://proyecto.supabase.co/", "sb_publishable_x");
  assert.equal(c.url, "https://proyecto.supabase.co/rest/v1/rpc/registrar_pago_billetera");
  assert.equal(c.metodo, "POST");
  assert.deepEqual(c.encabezados, { apikey: "sb_publishable_x", "Content-Type": "application/json" });
  assert.equal(c.url.includes("ft_"), false);
  assert.ok(c.campos.includes("p_clave"));
});

test("configuracionGoogleWallet: envía título y texto a la función que lee el aviso, con la clave en el cuerpo", () => {
  const c = configuracionGoogleWallet("https://proyecto.supabase.co///", "sb_publishable_x");
  assert.equal(c.url, "https://proyecto.supabase.co/rest/v1/rpc/registrar_aviso_billetera");
  assert.equal(c.metodo, "POST");
  assert.deepEqual(c.encabezados, { apikey: "sb_publishable_x", "Content-Type": "application/json" });
  assert.deepEqual([...c.campos], ["p_clave", "p_titulo", "p_texto", "p_paquete", "p_cuando"]);
  assert.equal(c.paquete, PAQUETE_GOOGLE_WALLET);
  assert.equal(PAQUETE_GOOGLE_WALLET, "com.google.android.apps.walletnfcrel");
});
