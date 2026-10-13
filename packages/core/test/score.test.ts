import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFinanciero } from "../src/usecases/scoreFinanciero.ts";
import type { Endeudamiento } from "../src/usecases/calcularEndeudamiento.ts";
import type { Cuenta, Recordatorio } from "../src/types/domain.ts";

const sinDeuda: Endeudamiento = { totalPendiente: 0, cuotasMensuales: 0, porcentaje: 0, nivel: "bajo" };

function tarjeta(cupoTotal: number, disponible: number): Cuenta {
  return { id: "t", nombre: "Visa", tipo: "credito", banco: "otro", cupoTotal, disponible, createdAt: "" };
}

function recordatorio(fecha: string, completado: boolean): Recordatorio {
  return { id: fecha, titulo: "x", tipo: "pago", fecha, recurrente: false, completado, createdAt: "" };
}

test("scoreFinanciero: sin deudas y ahorrando 30 % → excelente", () => {
  const s = scoreFinanciero({
    endeudamiento: sinDeuda,
    ingresosMes: 1000,
    gastosMes: 700,
    cuentas: [],
    recordatorios: [],
    hoy: "2026-10-13",
  });
  // 35 + 30 + 10 (sin tarjetas, neutral) + 7.5 (sin vencidos, neutral) = 82.5
  assert.equal(s.total, 83);
  assert.equal(s.etiqueta, "excelente");
});

test("scoreFinanciero: todo mal → 0 y crítico", () => {
  const s = scoreFinanciero({
    endeudamiento: { totalPendiente: 5000, cuotasMensuales: 600, porcentaje: 60, nivel: "alto" },
    ingresosMes: 1000,
    gastosMes: 1200,
    cuentas: [tarjeta(1000, 0)],
    recordatorios: [recordatorio("2026-10-01", false), recordatorio("2026-10-05", false)],
    hoy: "2026-10-13",
  });
  assert.equal(s.total, 0);
  assert.equal(s.etiqueta, "critico");
});

test("scoreFinanciero: caso intermedio calculado a mano", () => {
  const s = scoreFinanciero({
    // 25 % → 35 × 0.5 = 17.5
    endeudamiento: { totalPendiente: 1000, cuotasMensuales: 250, porcentaje: 25, nivel: "bajo" },
    // ahorro 10 % → 30 × 0.5 = 15
    ingresosMes: 1000,
    gastosMes: 900,
    // uso 65 % → 20 × (1 − 0.5) = 10
    cuentas: [tarjeta(1000, 350)],
    // 1 de 2 vencidos completado → 7.5; el futuro no cuenta
    recordatorios: [
      recordatorio("2026-10-01", true),
      recordatorio("2026-10-05", false),
      recordatorio("2026-12-01", false),
    ],
    hoy: "2026-10-13",
  });
  assert.equal(s.total, 50);
  assert.equal(s.etiqueta, "regular");
  assert.deepEqual(s.detalle, { endeudamiento: 18, ahorro: 15, cupo: 10, recordatorios: 8 });
});
