import { test } from "node:test";
import assert from "node:assert/strict";
import { planDeudas } from "../src/usecases/planDeudas.ts";
import { calcularEndeudamiento } from "../src/usecases/calcularEndeudamiento.ts";
import type { Deuda } from "../src/types/domain.ts";

function deuda(id: string, saldo: number, cuota: number, tasaInteres?: number): Deuda {
  return {
    id,
    nombre: id,
    tipo: "prestamo",
    montoTotal: saldo,
    saldoPendiente: saldo,
    cuotaMensual: cuota,
    tasaInteres,
    fechaInicio: "2026-01-01",
    createdAt: "2026-01-01",
  };
}

test("planDeudas: bola de nieve sin interés, cuenta los meses a mano", () => {
  // Pago 300/mes. d1 300 (cuota 100), d2 1000 (cuota 100).
  // m1: d1 200→100 (extra), d2 900 | m2: d1 0, d2 800→700 | m3: 400 | m4: 100 | m5: 0
  const plan = planDeudas([deuda("d1", 300, 100), deuda("d2", 1000, 100)], 300, "bola_de_nieve");
  assert.equal(plan.viable, true);
  assert.equal(plan.mesesTotales, 5);
  assert.deepEqual(
    plan.orden.map((p) => [p.nombre, p.mesLiquidacion]),
    [
      ["d1", 2],
      ["d2", 5],
    ]
  );
  assert.equal(plan.interesTotal, 0);
});

test("planDeudas: avalancha paga primero la de mayor tasa y ahorra interés", () => {
  const deudas = [deuda("tarjeta", 1000, 50, 24), deuda("prestamo", 500, 50, 0)];
  const avalancha = planDeudas(deudas, 300, "avalancha");
  const bola = planDeudas(deudas, 300, "bola_de_nieve");

  assert.equal(avalancha.viable, true);
  assert.equal(bola.viable, true);
  assert.equal(avalancha.orden[0].nombre, "tarjeta");
  assert.equal(bola.orden[0].nombre, "prestamo");
  assert.ok(
    avalancha.interesTotal < bola.interesTotal,
    `avalancha (${avalancha.interesTotal}) debería pagar menos interés que bola de nieve (${bola.interesTotal})`
  );
});

test("planDeudas: no es viable si el pago no cubre las cuotas mínimas", () => {
  const plan = planDeudas([deuda("d1", 1000, 200), deuda("d2", 1000, 200)], 300, "avalancha");
  assert.equal(plan.viable, false);
  assert.equal(plan.mesesTotales, 0);
});

test("planDeudas: no es viable si el interés crece más que el pago", () => {
  // 5 % mensual sobre 10 000 = 500 de interés > 100 de pago.
  const plan = planDeudas([deuda("d1", 10000, 100, 60)], 100, "avalancha");
  assert.equal(plan.viable, false);
});

test("planDeudas: ignora deudas ya saldadas", () => {
  const plan = planDeudas([deuda("pagada", 0, 100), deuda("d1", 200, 100)], 100, "avalancha");
  assert.equal(plan.orden.length, 1);
  assert.equal(plan.mesesTotales, 2);
});

test("planDeudas: sin deudas el plan está cumplido (viable, 0 meses)", () => {
  const plan = planDeudas([], 0, "avalancha");
  assert.equal(plan.viable, true);
  assert.equal(plan.mesesTotales, 0);
  assert.deepEqual(plan.orden, []);
});

test("calcularEndeudamiento: usa el ingreso de referencia en un mes sin ingresos", () => {
  const deudas = [deuda("d1", 1000, 300)];
  assert.equal(calcularEndeudamiento(deudas, 0).porcentaje, 0);
  const conReferencia = calcularEndeudamiento(deudas, 0, 600);
  assert.equal(conReferencia.porcentaje, 50);
  assert.equal(conReferencia.nivel, "alto");
  // Si hay ingreso del mes, manda ese.
  assert.equal(calcularEndeudamiento(deudas, 1000, 600).porcentaje, 30);
});
