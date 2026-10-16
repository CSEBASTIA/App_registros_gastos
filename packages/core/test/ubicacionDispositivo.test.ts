import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import {
  cambiarPreferenciaUbicacion,
  clavePreferenciaUbicacion,
  enlaceMapa,
  leerPreferenciaUbicacion,
  ubicacionParaGasto,
  type AlmacenPreferencias,
  type ProveedorUbicacion,
} from "../src/lib/ubicacionDispositivo.ts";
import { borrarMisUbicaciones } from "../src/repositories/lugares.repo.ts";

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BETO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function almacen(inicial: Record<string, string> = {}): AlmacenPreferencias & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: async (k) => datos[k] ?? null,
    setItem: async (k, v) => void (datos[k] = v),
    removeItem: async (k) => void delete datos[k],
  };
}

/** GPS falso: anota qué se le pidió. */
function gps(opciones: {
  permiso?: boolean;
  concede?: boolean;
  posicion?: () => Promise<{ latitud: number; longitud: number; precisionM?: number | null }>;
} = {}) {
  const llamadas: string[] = [];
  const proveedor: ProveedorUbicacion = {
    pedirPermiso: async () => (llamadas.push("pedir"), opciones.concede ?? true),
    tienePermiso: async () => (llamadas.push("tiene"), opciones.permiso ?? true),
    posicion: () => (llamadas.push("posicion"), (opciones.posicion ?? (async () => ({ latitud: -0.180749, longitud: -78.467851, precisionM: 12.4 })))()),
  };
  return { proveedor, llamadas };
}

test("ubicación: apagada por defecto, sin tocar el GPS ni pedir permiso", async () => {
  const { proveedor, llamadas } = gps();
  assert.deepEqual(await ubicacionParaGasto(almacen(), proveedor, ANA), { motivo: "apagada" });
  assert.deepEqual(llamadas, []);
});

test("ubicación: encenderla pide permiso y solo queda encendida si se concede", async () => {
  const a = almacen();
  const negado = gps({ concede: false });
  assert.deepEqual(await cambiarPreferenciaUbicacion(a, negado.proveedor, ANA, true), { activa: false, motivo: "sin_permiso" });
  assert.equal(await leerPreferenciaUbicacion(a, ANA), false);

  const concedido = gps({ concede: true });
  assert.deepEqual(await cambiarPreferenciaUbicacion(a, concedido.proveedor, ANA, true), { activa: true });
  assert.equal(await leerPreferenciaUbicacion(a, ANA), true);

  // Apagarla no pide nada.
  const apagar = gps();
  assert.deepEqual(await cambiarPreferenciaUbicacion(a, apagar.proveedor, ANA, false), { activa: false });
  assert.deepEqual(apagar.llamadas, []);
  assert.equal(await leerPreferenciaUbicacion(a, ANA), false);
});

test("ubicación: la preferencia es de cada usuario, no del teléfono", async () => {
  const a = almacen({ [clavePreferenciaUbicacion(ANA)]: "si" });
  assert.equal(await leerPreferenciaUbicacion(a, ANA), true);
  assert.equal(await leerPreferenciaUbicacion(a, BETO), false);
  const { proveedor, llamadas } = gps();
  assert.deepEqual(await ubicacionParaGasto(a, proveedor, BETO), { motivo: "apagada" });
  assert.deepEqual(llamadas, []);
});

test("ubicación: un valor raro o un almacén que falla cuentan como apagada", async () => {
  assert.equal(await leerPreferenciaUbicacion(almacen({ [clavePreferenciaUbicacion(ANA)]: "true" }), ANA), false);
  const roto: AlmacenPreferencias = {
    getItem: async () => { throw new Error("almacén roto"); },
    setItem: async () => {},
    removeItem: async () => {},
  };
  assert.equal(await leerPreferenciaUbicacion(roto, ANA), false);
});

test("ubicación: con permiso devuelve la posición redondeada", async () => {
  const a = almacen({ [clavePreferenciaUbicacion(ANA)]: "si" });
  const { proveedor, llamadas } = gps();
  assert.deepEqual(await ubicacionParaGasto(a, proveedor, ANA), {
    ubicacion: { latitud: -0.1807, longitud: -78.4679, precisionM: 12 },
  });
  assert.deepEqual(llamadas, ["tiene", "posicion"]); // nunca pide permiso al guardar
});

test("ubicación: sin permiso, GPS lento, dato imposible o error → gasto sin ubicación, sin lanzar", async () => {
  const a = almacen({ [clavePreferenciaUbicacion(ANA)]: "si" });
  assert.deepEqual(await ubicacionParaGasto(a, gps({ permiso: false }).proveedor, ANA), { motivo: "sin_permiso" });

  const lento = gps({ posicion: () => new Promise((r) => setTimeout(() => r({ latitud: 0, longitud: 0 }), 200)) });
  const inicio = Date.now();
  assert.deepEqual(await ubicacionParaGasto(a, lento.proveedor, ANA, 30), { motivo: "tiempo_agotado" });
  assert.ok(Date.now() - inicio < 150, "no esperó al GPS");

  assert.deepEqual(await ubicacionParaGasto(a, gps({ posicion: async () => ({ latitud: 999, longitud: 0 }) }).proveedor, ANA), { motivo: "invalida" });
  assert.deepEqual(await ubicacionParaGasto(a, gps({ posicion: async () => ({ latitud: NaN, longitud: 0 }) }).proveedor, ANA), { motivo: "invalida" });
  assert.deepEqual(await ubicacionParaGasto(a, gps({ posicion: async () => { throw new Error("GPS apagado"); } }).proveedor, ANA), { motivo: "error" });

  // precisión null (la web a veces no la da) no invalida la posición
  assert.deepEqual(await ubicacionParaGasto(a, gps({ posicion: async () => ({ latitud: 1, longitud: 2, precisionM: null }) }).proveedor, ANA), {
    ubicacion: { latitud: 1, longitud: 2 },
  });
});

test("enlaceMapa: abre la app de mapas de cada plataforma solo con las coordenadas", () => {
  const u = { latitud: -0.180749, longitud: -78.467851 };
  assert.equal(enlaceMapa(u, "android"), "geo:-0.1807,-78.4679?q=-0.1807,-78.4679");
  assert.equal(enlaceMapa(u, "ios"), "https://maps.apple.com/?q=-0.1807,-78.4679");
  assert.equal(enlaceMapa(u), "https://www.google.com/maps/search/?api=1&query=-0.1807,-78.4679");
});

test("borrarMisUbicaciones: llama a la función de la base y devuelve los conteos", async () => {
  const llamadas: unknown[] = [];
  setSupabaseClient({
    rpc: async (fn: string, args?: unknown) => (llamadas.push([fn, args]), { data: { gastos: 3, avisos: 1, lugares: 2 }, error: null }),
  } as any);
  assert.deepEqual(await borrarMisUbicaciones(), { gastos: 3, avisos: 1, lugares: 2 });
  assert.deepEqual(llamadas, [["borrar_mis_ubicaciones", undefined]]);

  setSupabaseClient({ rpc: async () => ({ data: null, error: { code: "42501", message: "Necesitas iniciar sesión." } }) } as any);
  await assert.rejects(borrarMisUbicaciones());
});
