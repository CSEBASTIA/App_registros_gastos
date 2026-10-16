import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import {
  fusionarLugares,
  renombrarLugar,
  resumenPorComercio,
  resumenPorLugar,
  validarRangoResumen,
} from "../src/repositories/lugares.repo.ts";
import { listarGastosDeLugar } from "../src/repositories/gastos.repo.ts";
import { generarRecomendaciones } from "../src/usecases/generarRecomendaciones.ts";
import { calcularEndeudamiento } from "../src/usecases/calcularEndeudamiento.ts";
import type { Gasto, Lugar } from "../src/types/domain.ts";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";

test("validarRangoResumen: mismos límites que la base (orden, formato, 2 años)", () => {
  assert.deepEqual(validarRangoResumen("2026-10-01", "2026-10-31"), { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.doesNotThrow(() => validarRangoResumen("2024-10-31", "2026-10-31")); // 730 días
  assert.throws(() => validarRangoResumen("2026-10-31", "2026-10-01"), /anterior/);
  assert.throws(() => validarRangoResumen("2020-01-01", "2026-10-31"), /2 años/);
  assert.throws(() => validarRangoResumen("2026-13-01", "2026-12-31"));
});

test("resumenPorLugar: valida antes de ir a la red y convierte los números", async () => {
  const llamadas: unknown[] = [];
  setSupabaseClient({
    rpc: async (fn: string, args: unknown) => (
      llamadas.push([fn, args]),
      {
        data: [{
          lugar_id: L1, nombre: "Supermaxi", latitud: "-0.1700", longitud: "-78.4800", pagos: 3, total: "60.00",
          promedio: "20.00", porcentaje: "52.2", primer_pago: "2026-10-02", ultimo_pago: "2026-10-20",
          categoria_id: null, billetera: null,
        }],
        error: null,
      }
    ),
  } as any);
  const [r] = await resumenPorLugar("2026-10-01", "2026-10-31");
  assert.deepEqual(r, {
    lugarId: L1, nombre: "Supermaxi", latitud: -0.17, longitud: -78.48, pagos: 3, total: 60, promedio: 20,
    porcentaje: 52.2, primerPago: "2026-10-02", ultimoPago: "2026-10-20", categoriaId: undefined, billetera: undefined,
  });
  assert.deepEqual(llamadas, [["resumen_por_lugar", { p_desde: "2026-10-01", p_hasta: "2026-10-31" }]]);

  await assert.rejects(resumenPorLugar("2026-10-31", "2026-10-01"));
  assert.equal(llamadas.length, 1);
});

test("resumenPorComercio: convierte los números y una lista vacía de lugares", async () => {
  setSupabaseClient({
    rpc: async () => ({
      data: [{ comercio: "Supermaxi", locales: 2, pagos: 5, total: "100.00", promedio: "20.00", ultimo_pago: "2026-10-25", lugar_ids: null }],
      error: null,
    }),
  } as any);
  assert.deepEqual(await resumenPorComercio("2026-10-01", "2026-10-31"), [
    { comercio: "Supermaxi", locales: 2, pagos: 5, total: 100, promedio: 20, ultimoPago: "2026-10-25", lugarIds: [] },
  ]);
});

test("renombrarLugar y fusionarLugares: validan antes de ir a la red", async () => {
  const pasos: unknown[] = [];
  setSupabaseClient({
    from: () => ({
      update: (datos: unknown) => (
        pasos.push(["update", datos]),
        { eq: () => ({ select: () => ({ single: async () => ({ data: { id: L1, nombre: "Supermaxi", latitud: 0, longitud: 0, radio_m: 80, created_at: "" }, error: null }) }) }) }
      ),
    }),
    rpc: async (fn: string, args: unknown) => (pasos.push([fn, args]), { data: 2, error: null }),
  } as any);

  assert.equal((await renombrarLugar(L1, "  Supermaxi  ")).nombre, "Supermaxi");
  assert.deepEqual(pasos[0], ["update", { nombre: "Supermaxi" }]);
  await assert.rejects(renombrarLugar(L1, "   "));
  await assert.rejects(renombrarLugar(L1, "x".repeat(81)));

  assert.equal(await fusionarLugares(L2, L1), 2);
  assert.deepEqual(pasos[1], ["fusionar_lugares", { p_origen: L2, p_destino: L1 }]);
  await assert.rejects(fusionarLugares(L1, L1), /distintos/);
  await assert.rejects(fusionarLugares("no-es-uuid", L1));
  assert.equal(pasos.length, 2);
});

test("listarGastosDeLugar: filtra por el lugar y rechaza un id inválido", async () => {
  const filtros: string[] = [];
  setSupabaseClient({
    from: () => {
      const q: any = {
        select: () => q,
        eq: (c: string, v: string) => (filtros.push(`${c}=${v}`), q),
        gte: () => q,
        lte: () => q,
        order: () => q,
        range: () => q,
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
      };
      return q;
    },
  } as any);
  await listarGastosDeLugar(L1, { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.deepEqual(filtros, [`lugar_id=${L1}`]);
  await assert.rejects(listarGastosDeLugar("x"));
});

const lugares: Lugar[] = [
  { id: L1, nombre: "Supermaxi", latitud: 0, longitud: 0, radioM: 80, createdAt: "" },
  { id: L2, nombre: "Farmacia", latitud: 0, longitud: 0, radioM: 80, createdAt: "" },
];
const pago = (lugarId: string, monto: number, fecha: string): Gasto => ({
  id: `${lugarId}${monto}${fecha}`, monto, descripcion: "x", categoriaId: "c1", lugarId, fecha, createdAt: "",
});
const base = {
  mes: "2026-10",
  ingresos: [],
  categorias: [],
  cuentas: [],
  endeudamiento: calcularEndeudamiento([], 0),
};
const mensajesDeLugar = (gastos: Gasto[], conLugares = lugares) =>
  generarRecomendaciones({ ...base, gastos, lugares: conLugares })
    .map((r) => r.mensaje)
    .filter((m) => m.startsWith("Este mes llevas"));

test("recomendación por lugar: avisa cuando el lugar con más gasto sube 30 % o más", () => {
  const gastos = [pago(L1, 50, "2026-09-10"), pago(L1, 85, "2026-10-05"), pago(L2, 30, "2026-10-06")];
  assert.deepEqual(mensajesDeLugar(gastos), ['Este mes llevas $85.00 en "Supermaxi", un 70% más que en todo el mes pasado.']);
});

test("recomendación por lugar: no inventa aumentos ni avisa por poco", () => {
  // Sin datos del mes pasado.
  assert.deepEqual(mensajesDeLugar([pago(L1, 85, "2026-10-05")]), []);
  // Menos de $20.
  assert.deepEqual(mensajesDeLugar([pago(L1, 5, "2026-09-05"), pago(L1, 15, "2026-10-05")]), []);
  // Sube menos de 30 %.
  assert.deepEqual(mensajesDeLugar([pago(L1, 80, "2026-09-05"), pago(L1, 100, "2026-10-05")]), []);
  // Sin la lista de lugares (pantallas que todavía no la pasan): igual que antes.
  assert.deepEqual(mensajesDeLugar([pago(L1, 50, "2026-09-10"), pago(L1, 85, "2026-10-05")], []), []);
  // Enero compara con diciembre del año anterior.
  assert.equal(
    generarRecomendaciones({ ...base, mes: "2027-01", gastos: [pago(L1, 20, "2026-12-10"), pago(L1, 40, "2027-01-03")], lugares })
      .some((r) => r.mensaje.includes("100% más")),
    true
  );
});

test("rangoDelMes: primer y último día, también en febrero bisiesto", async () => {
  const { rangoDelMes } = await import("../src/lib/semanas.ts");
  assert.deepEqual(rangoDelMes("2026-10"), { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.deepEqual(rangoDelMes("2028-02"), { desde: "2028-02-01", hasta: "2028-02-29" });
  assert.deepEqual(rangoDelMes("2026-02"), { desde: "2026-02-01", hasta: "2026-02-28" });
});

test("mensajeError: sin la migración en Supabase dice que falta actualizar la base, en español", async () => {
  const { mensajeError } = await import("../src/lib/mensajeError.ts");
  for (const code of ["PGRST202", "PGRST205", "42703"]) {
    assert.match(mensajeError({ code, message: "Could not find the function public.resumen_por_lugar" }), /falta actualizar la base de datos/);
  }
});
