import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoPresupuestos, sugerirLimite } from "../src/usecases/estadoPresupuestos.ts";
import type { Categoria, Gasto, Presupuesto } from "../src/types/domain.ts";

const categorias: Categoria[] = [
  { id: "c1", nombre: "Comida", color: "#f97316", tipo: "gasto" },
  { id: "c2", nombre: "Transporte", color: "#3b82f6", tipo: "gasto" },
];

function gasto(categoriaId: string, fecha: string, monto: number): Gasto {
  return { id: `${categoriaId}-${fecha}-${monto}`, monto, descripcion: "x", categoriaId, fecha, createdAt: fecha };
}

function presupuesto(id: string, categoriaId: string, mes: string, montoLimite: number): Presupuesto {
  return { id, categoriaId, mes, montoLimite };
}

test("estadoPresupuestos: suma solo el mes pedido y marca niveles 80 % / 100 %", () => {
  const presupuestos = [
    presupuesto("p1", "c1", "2026-10", 100),
    presupuesto("p2", "c2", "2026-10", 50),
    presupuesto("p3", "c1", "2026-09", 10), // otro mes: se ignora
  ];
  const gastos = [
    gasto("c1", "2026-10-05", 60),
    gasto("c1", "2026-10-20", 25),
    gasto("c2", "2026-10-01", 50),
    gasto("c1", "2026-09-10", 999), // otro mes: no cuenta
  ];

  const estado = estadoPresupuestos("2026-10", presupuestos, gastos, categorias);

  assert.equal(estado.length, 2);
  // Ordenado por porcentaje descendente: Transporte (100 %) antes que Comida (85 %).
  assert.equal(estado[0].categoriaNombre, "Transporte");
  assert.equal(estado[0].porcentaje, 100);
  assert.equal(estado[0].nivel, "excedido");
  assert.equal(estado[0].restante, 0);

  assert.equal(estado[1].categoriaNombre, "Comida");
  assert.equal(estado[1].gastado, 85);
  assert.equal(estado[1].restante, 15);
  assert.equal(estado[1].nivel, "cerca");
});

test("estadoPresupuestos: nivel ok por debajo de 80 % y categoría desconocida", () => {
  const estado = estadoPresupuestos(
    "2026-10",
    [presupuesto("p1", "borrada", "2026-10", 200)],
    [gasto("borrada", "2026-10-02", 100)],
    categorias
  );
  assert.equal(estado[0].nivel, "ok");
  assert.equal(estado[0].porcentaje, 50);
  assert.equal(estado[0].categoriaNombre, "Sin categoría");
});

test("estadoPresupuestos: gastar de más deja restante negativo", () => {
  const estado = estadoPresupuestos(
    "2026-10",
    [presupuesto("p1", "c1", "2026-10", 100)],
    [gasto("c1", "2026-10-02", 130)],
    categorias
  );
  assert.equal(estado[0].restante, -30);
  assert.equal(estado[0].nivel, "excedido");
});

test("sugerirLimite: promedia meses previos con gasto, cruza de año y redondea a 5", () => {
  const gastos = [
    gasto("c1", "2025-12-03", 60),
    gasto("c1", "2025-12-20", 40), // dic = 100
    // nov = 0 (sin gasto, no entra al promedio)
    gasto("c1", "2025-10-15", 47), // oct = 47
    gasto("c1", "2026-01-05", 500), // mes actual: no entra
    gasto("c2", "2025-12-01", 999), // otra categoría
  ];
  // (100 + 47) / 2 = 73.5 -> 75
  assert.equal(sugerirLimite("c1", "2026-01", gastos), 75);
});

test("sugerirLimite: sin historial devuelve null", () => {
  assert.equal(sugerirLimite("c1", "2026-01", []), null);
});
