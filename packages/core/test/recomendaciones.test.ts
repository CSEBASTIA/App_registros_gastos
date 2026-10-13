import { test } from "node:test";
import assert from "node:assert/strict";
import { generarRecomendaciones } from "../src/usecases/generarRecomendaciones.ts";
import { calcularEndeudamiento } from "../src/usecases/calcularEndeudamiento.ts";
import type { Categoria, Gasto, Ingreso } from "../src/types/domain.ts";

const categorias: Categoria[] = [
  { id: "c1", nombre: "Comida", color: "#f97316", tipo: "gasto" },
  { id: "c2", nombre: "Ocio", color: "#a855f7", tipo: "gasto" },
];
const gasto = (categoriaId: string, monto: number): Gasto => ({
  id: `${categoriaId}${monto}`,
  monto,
  descripcion: "x",
  categoriaId,
  fecha: "2026-10-05",
  createdAt: "",
});
const ingresos: Ingreso[] = [{ id: "i", monto: 2000, descripcion: "Sueldo", fecha: "2026-10-01", createdAt: "" }];
const base = {
  mes: "2026-10",
  ingresos,
  categorias,
  cuentas: [],
  endeudamiento: calcularEndeudamiento([], 2000),
};

test("generarRecomendaciones: avisa al 80 % y alerta al pasarse del presupuesto", () => {
  const recomendaciones = generarRecomendaciones({
    ...base,
    gastos: [gasto("c1", 90), gasto("c2", 120)],
    presupuestos: [
      { id: "p1", categoriaId: "c1", montoLimite: 100, mes: "2026-10" },
      { id: "p2", categoriaId: "c2", montoLimite: 100, mes: "2026-10" },
    ],
  });

  const ocio = recomendaciones.find((r) => r.mensaje.includes("Ocio"));
  const comida = recomendaciones.find((r) => r.mensaje.includes("Comida"));
  assert.equal(ocio?.severidad, "alerta");
  assert.match(ocio!.mensaje, /Te pasaste/);
  assert.equal(comida?.severidad, "info");
  assert.match(comida!.mensaje, /90%/);
});

test("generarRecomendaciones: sin presupuestos se comporta igual que antes", () => {
  const recomendaciones = generarRecomendaciones({ ...base, gastos: [gasto("c1", 90)] });
  assert.equal(recomendaciones.length, 1);
  assert.match(recomendaciones[0].mensaje, /Vas bien/);
});
