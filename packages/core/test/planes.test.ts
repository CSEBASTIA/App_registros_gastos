import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANES, estadoSuscriptor, textoPrecio } from "../src/lib/planes.ts";

test("hay tres planes: Gratis, $2.99 y $4.99", () => {
  assert.deepEqual(PLANES.map((p) => [p.id, p.precioMensual]), [["gratis", 0], ["plus", 2.99], ["pro", 4.99]]);
  assert.equal(textoPrecio(PLANES[1]), "$2.99 al mes");
});

test("sin plan pagado, la persona está en Gratis", () => {
  assert.equal(estadoSuscriptor(null, "2026-10-25").plan.id, "gratis");
});

test("un plan cancelado sigue vigente hasta su vencimiento", () => {
  const fila = { plan: "pro" as const, estado: "cancelada" as const, venceEn: "2026-11-01" };
  assert.equal(estadoSuscriptor(fila, "2026-10-25").plan.id, "pro");
  assert.equal(estadoSuscriptor(fila, "2026-11-02").plan.id, "gratis");
});
