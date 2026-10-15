import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDiferido } from "../src/lib/diferidos.ts";
import { repararTexto } from "../src/lib/repararTexto.ts";

test("el diferido muestra capital e interés de la primera cuota y liquida el capital", () => {
  const plan = calcularDiferido(100, 3, 12);
  assert.equal(plan.cuotaMensual, 34.01);
  assert.deepEqual(plan.primeraCuota, { numero: 1, capital: 33.01, interes: 1, total: 34.01 });
  assert.equal(plan.cuotas.reduce((total, cuota) => total + Math.round(cuota.capital * 100), 0), 10000);
  assert.equal(plan.totalEstimado, 100 + plan.interesTotal);
  assert.equal(calcularDiferido(100, 3).cuotas[2].total, 33.32);
});

test("repara el nombre mal codificado y conserva los nombres correctos", () => {
  assert.equal(repararTexto("American ExpressÂ® ClÃ¡sica CrÃ©dito"), "American Express® Clásica Crédito");
  assert.equal(repararTexto("American Express® Clásica Crédito"), "American Express® Clásica Crédito");
});
