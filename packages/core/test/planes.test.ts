import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANES, estadoSuscriptor, textoPrecio } from "../src/lib/planes.ts";
import { setSupabaseClient } from "../src/client.ts";
import { obtenerMiPlan } from "../src/repositories/planes.repo.ts";

function conFila(fila: unknown) {
  setSupabaseClient({
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }),
  } as any);
}

test("hay tres planes: Gratis, $1.99 y $3.99", () => {
  assert.deepEqual(PLANES.map((p) => [p.id, p.precioMensual]), [["gratis", 0], ["plus", 1.99], ["pro", 3.99]]);
  assert.equal(textoPrecio(PLANES[1]), "$1.99 al mes");
});

test("sin plan pagado, la persona está en Gratis", () => {
  assert.equal(estadoSuscriptor(null, "2026-10-25").plan.id, "gratis");
});

test("un plan cancelado sigue vigente hasta su vencimiento", () => {
  const fila = { plan: "pro" as const, estado: "cancelada" as const, venceEn: "2026-11-01" };
  assert.equal(estadoSuscriptor(fila, "2026-10-25").plan.id, "pro");
  assert.equal(estadoSuscriptor(fila, "2026-11-02").plan.id, "gratis");
});

test("obtenerMiPlan: sin fila es Gratis; con fila, el vencimiento queda como fecha", async () => {
  conFila(null);
  assert.equal(await obtenerMiPlan(), null);
  conFila({ plan: "plus", estado: "cancelada", vence_en: "2026-11-25T12:00:00+00:00" });
  assert.deepEqual(await obtenerMiPlan(), { plan: "plus", estado: "cancelada", venceEn: "2026-11-25" });
  conFila({ plan: "oro", estado: "activa", vence_en: null });
  assert.equal(await obtenerMiPlan(), null);
});
