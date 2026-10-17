import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import { FILAS_POR_PAGINA, traerTodasLasFilas, validarRango } from "../src/lib/paginacion.ts";
import { listarGastos, listarGastosRecientes } from "../src/repositories/gastos.repo.ts";
import { listarIngresos, listarIngresosRecientes } from "../src/repositories/ingresos.repo.ts";
import { eliminarMiCuenta } from "../src/repositories/cuentaUsuario.repo.ts";
import { totalesPorMes } from "../src/repositories/totales.repo.ts";

/** Cliente falso con `total` filas; anota los filtros y las páginas pedidas. */
function clienteConFilas(total: number) {
  const llamadas: string[] = [];
  const filas = Array.from({ length: total }, (_, i) => ({
    id: `id${i}`, monto: "1.50", descripcion: "x", categoria_id: null, fecha: "2026-10-01", created_at: "",
  }));
  setSupabaseClient({
    from: () => {
      let rango: [number, number] = [0, total - 1];
      const consulta: any = {
        select: () => consulta,
        order: () => consulta,
        eq: (c: string, v: string) => (llamadas.push(`eq ${c} ${v}`), consulta),
        gte: (c: string, v: string) => (llamadas.push(`gte ${c} ${v}`), consulta),
        lte: (c: string, v: string) => (llamadas.push(`lte ${c} ${v}`), consulta),
        range: (a: number, b: number) => {
          llamadas.push(`range ${a}-${b}`);
          rango = [a, b];
          return consulta;
        },
        limit: (n: number) => {
          llamadas.push(`limit ${n}`);
          rango = [0, n - 1];
          return consulta;
        },
        then: (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) =>
          Promise.resolve({ data: filas.slice(rango[0], rango[1] + 1), error: null }).then(ok, mal),
      };
      return consulta;
    },
  } as any);
  return llamadas;
}

test("listarGastos: pasa el tope de 1.000 filas de Supabase pidiendo todas las páginas", async () => {
  const llamadas = clienteConFilas(2500);
  const gastos = await listarGastos();
  assert.equal(gastos.length, 2500);
  assert.deepEqual(llamadas, ["range 0-999", "range 1000-1999", "range 2000-2999"]);
});

test("listarIngresos: con exactamente 1.000 filas pide una página más para confirmar que no hay otra", async () => {
  const llamadas = clienteConFilas(FILAS_POR_PAGINA);
  assert.equal((await listarIngresos()).length, 1000);
  assert.deepEqual(llamadas, ["range 0-999", "range 1000-1999"]);
});

test("listarGastos: con rango filtra en la base, en cada página", async () => {
  const llamadas = clienteConFilas(10);
  await listarGastos({ desde: "2026-10-01", hasta: "2026-10-31" });
  assert.deepEqual(llamadas, ["gte fecha 2026-10-01", "lte fecha 2026-10-31", "range 0-999"]);
});

test("el resumen pide solo ocho movimientos recientes de cada tipo, sin excluir fechas antiguas", async () => {
  const llamadasGastos = clienteConFilas(100);
  assert.equal((await listarGastosRecientes()).length, 8);
  assert.deepEqual(llamadasGastos, ["limit 8"]);
  const llamadasIngresos = clienteConFilas(100);
  assert.equal((await listarIngresosRecientes()).length, 8);
  assert.deepEqual(llamadasIngresos, ["limit 8"]);
});

test("validarRango: rechaza fechas imposibles o al revés", () => {
  assert.throws(() => validarRango({ desde: "2026-02-30" }));
  assert.throws(() => validarRango({ desde: "2026-10-31", hasta: "2026-10-01" }), /posterior/);
  assert.deepEqual(validarRango({}), { desde: undefined, hasta: undefined });
});

test("traerTodasLasFilas: un error de la base se propaga, no devuelve datos a medias", async () => {
  const fallo = { message: "timeout", code: "57014" };
  await assert.rejects(
    traerTodasLasFilas(async (inicio) => (inicio === 0 ? { data: new Array(1000).fill(0), error: null } : { data: null, error: fallo })),
    (err) => err === fallo
  );
});

/** Cliente falso para eliminar la cuenta: anota cada paso en orden. */
function clienteParaEliminar(opciones: { errorRpc?: unknown; sinSesion?: boolean } = {}) {
  const pasos: string[] = [];
  let archivos: { id: string | null; name: string }[] = [
    { id: "1", name: "a.pdf" },
    { id: "2", name: "b.jpg" },
    { id: null, name: "carpeta" },
  ];
  setSupabaseClient({
    auth: {
      getSession: async () => ({ data: { session: opciones.sinSesion ? null : { user: { id: "u1" } } } }),
      signOut: async (o: { scope: string }) => (pasos.push(`cerrar sesión ${o.scope}`), { error: null }),
    },
    storage: {
      from: (bucket: string) => ({
        list: async (carpeta: string) => (pasos.push(`listar ${bucket}/${carpeta}`), { data: archivos, error: null }),
        remove: async (rutas: string[]) => {
          pasos.push(`borrar ${rutas.join(", ")}`);
          archivos = archivos.filter((a) => !a.id);
          return { error: null };
        },
      }),
    },
    rpc: async (funcion: string, args: { p_confirmacion: string }) => {
      pasos.push(`${funcion}(${args.p_confirmacion})`);
      return { error: opciones.errorRpc ?? null };
    },
  } as any);
  return pasos;
}

test("eliminarMiCuenta: borra las facturas, luego la cuenta, y cierra la sesión local", async () => {
  const pasos = clienteParaEliminar();
  await eliminarMiCuenta("ELIMINAR");
  assert.deepEqual(pasos, [
    "listar facturas/u1",
    "borrar u1/a.pdf, u1/b.jpg",
    "listar facturas/u1",
    "eliminar_mi_cuenta(ELIMINAR)",
    "cerrar sesión local",
  ]);
});

test("eliminarMiCuenta: sin la palabra de confirmación o sin sesión no toca nada", async () => {
  const pasos = clienteParaEliminar();
  await assert.rejects(eliminarMiCuenta("eliminar"), /Escribe ELIMINAR/);
  assert.deepEqual(pasos, []);

  const sinSesion = clienteParaEliminar({ sinSesion: true });
  await assert.rejects(eliminarMiCuenta("ELIMINAR"), /iniciar sesión/);
  assert.deepEqual(sinSesion, []);
});

test("eliminarMiCuenta: si la base falla, la sesión sigue abierta para reintentar", async () => {
  const pasos = clienteParaEliminar({ errorRpc: { message: "Todavía quedan facturas guardadas." } });
  await assert.rejects(eliminarMiCuenta("ELIMINAR"));
  assert.equal(pasos.includes("cerrar sesión local"), false);
});

test("totalesPorMes: convierte los totales de la base y valida el rango antes de llamar", async () => {
  const llamadas: unknown[] = [];
  setSupabaseClient({
    rpc: async (funcion: string, args: unknown) => {
      llamadas.push([funcion, args]);
      return { data: [{ mes: "2026-10", total_gastos: "20.30", total_ingresos: "100.00" }], error: null };
    },
  } as any);
  assert.deepEqual(await totalesPorMes("2026-10-01", "2026-10-31"), [{ mes: "2026-10", totalGastos: 20.3, totalIngresos: 100 }]);
  assert.deepEqual(llamadas, [["totales_por_mes", { p_desde: "2026-10-01", p_hasta: "2026-10-31" }]]);

  await assert.rejects(totalesPorMes("2026-10-31", "2026-10-01"));
  assert.equal(llamadas.length, 1);
});
