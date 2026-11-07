import { test } from "node:test";
import assert from "node:assert/strict";
import { cifrasAnuales, resumenAnualDe } from "../src/lib/resumenAnual.ts";
import { movimientosParaGuardar, type FilaImportacion } from "../src/lib/importacionEstadoCuenta.ts";
import { gastoSchema } from "../src/schemas/gasto.schema.ts";

const meses = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
const base = resumenAnualDe(
  {
    meses: meses.map((mes) => ({
      mes,
      gastos: mes === "2026-03" ? 400 : mes === "2026-10" ? 100.1 : mes === "2026-11" ? 50 : 0,
      ingresos: mes === "2026-10" ? 800 : 0,
    })),
    categorias: [
      { categoria_id: "c1", nombre: "Comida", color: "#f97316", total: "450.10", cantidad: 12 },
      { nombre: null, total: 100, cantidad: 2 },
    ],
    comercios: [{ descripcion: " Supermaxi ", total: 300, cantidad: 4 }, { descripcion: "", total: 1, cantidad: 1 }],
  },
  2026,
);

test("resumenAnualDe: convierte la respuesta de la base y descarta lo que no sirve", () => {
  assert.equal(base.meses.length, 12);
  assert.equal(base.categorias[0].total, 450.1);
  assert.equal(base.categorias[1].nombre, "Sin categoría");
  assert.deepEqual(base.comercios, [{ descripcion: "Supermaxi", total: 300, cantidad: 4 }]);
  assert.deepEqual(resumenAnualDe(null, 2025), { anio: 2025, meses: [], categorias: [], comercios: [] });
});

test("cifrasAnuales: totales, ahorro, promedio de los meses con gasto y el mes más caro", () => {
  const c = cifrasAnuales(base, "2026-11");
  assert.equal(c.totalGastos, 550.1);
  assert.equal(c.totalIngresos, 800);
  assert.equal(c.ahorro, 249.9);
  assert.equal(c.promedioMensual, 183.37); // (400 + 100.10 + 50) / 3
  assert.equal(c.mesMayorGasto?.mes, "2026-03");
  assert.deepEqual(c.porcentajes, [81.8, 18.2]);
});

test("cifrasAnuales: los meses ya pasados sin nada son los que piden su estado de cuenta (no los futuros)", () => {
  const c = cifrasAnuales(base, "2026-11");
  assert.deepEqual(c.mesesSinDatos, ["2026-01", "2026-02", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
});

const fila = (tipo: "gasto" | "ingreso"): FilaImportacion =>
  ({ id: 1, tipo, monto: 10, descripcion: "X", fecha: "2026-03-05", seleccionada: true, categoriaSugerida: "Otros" }) as FilaImportacion;

test("movimientosParaGuardar: un estado de un mes pasado va al historial (no mueve el saldo)", () => {
  const cats = [{ id: "otros", nombre: "Otros", tipo: "gasto" as const }];
  const hist = movimientosParaGuardar([fila("gasto"), fila("ingreso")], { id: "a", tipo: "ahorro" }, cats, true);
  assert.equal(hist.gastos[0].historico, true);
  assert.equal(hist.ingresos[0].historico, true);
  const hoy = movimientosParaGuardar([fila("gasto")], { id: "a", tipo: "ahorro" }, cats);
  assert.equal(hoy.gastos[0].historico, undefined);
});

test("gastoSchema: guarda la marca de historial y no la deja en un diferido", () => {
  const g = { monto: 10, descripcion: "X", categoriaId: "11111111-1111-4111-8111-111111111111", fecha: "2026-03-05" };
  assert.equal(gastoSchema.parse({ ...g, historico: true }).historico, true);
  assert.equal(
    gastoSchema.safeParse({ ...g, historico: true, metodoPago: "diferido", mesesDiferido: 3, cuentaId: "11111111-1111-4111-8111-111111111111" }).success,
    false,
  );
});
