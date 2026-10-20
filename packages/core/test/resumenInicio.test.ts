import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparacionMensual,
  mesAnterior,
  resumenAhorro,
  resumenDiferidos,
  resumenTarjetas,
} from "../src/lib/resumenInicio.ts";
import type { Cuenta, Deuda, Gasto, Ingreso } from "../src/types/domain.ts";

// Datos inventados.
const cuenta = (c: Partial<Cuenta> & Pick<Cuenta, "id" | "tipo">): Cuenta => ({
  nombre: c.id,
  banco: "otro",
  disponible: 0,
  createdAt: "2026-10-01T00:00:00Z",
  ...c,
});
const gasto = (g: Partial<Gasto> & Pick<Gasto, "id" | "monto" | "fecha">): Gasto => ({
  descripcion: "TIENDA PRUEBA",
  categoriaId: "cat",
  createdAt: `${g.fecha}T12:34:56Z`,
  ...g,
});
const ingreso = (i: Pick<Ingreso, "id" | "monto" | "fecha">): Ingreso =>
  ({ descripcion: "Sueldo", createdAt: `${i.fecha}T12:34:56Z`, ...i }) as Ingreso;

test("mes anterior, también en enero", () => {
  assert.equal(mesAnterior("2026-10"), "2026-09");
  assert.equal(mesAnterior("2027-01"), "2026-12");
});

test("ingresos y gastos contra el mes anterior: menos gasto es mejora", () => {
  const { mesAnterior: previo, filas } = comparacionMensual(
    [gasto({ id: "g1", monto: 50, fecha: "2026-10-02" }), gasto({ id: "g2", monto: 100, fecha: "2026-09-15" })],
    [ingreso({ id: "i1", monto: 200, fecha: "2026-10-01" }), ingreso({ id: "i2", monto: 200, fecha: "2026-09-01" })],
    "2026-10"
  );
  assert.equal(previo, "2026-09");
  assert.deepEqual(filas, [
    { concepto: "Ingresos", actual: 200, anterior: 200, cambio: 0, mejora: undefined },
    { concepto: "Gastos", actual: 50, anterior: 100, cambio: -50, mejora: true },
    { concepto: "Balance", actual: 150, anterior: 100, cambio: 50, mejora: true },
  ]);
});

test("sin mes anterior no hay porcentaje", () => {
  const { filas } = comparacionMensual([gasto({ id: "g", monto: 12.34, fecha: "2026-10-02" })], [], "2026-10");
  assert.equal(filas[1].cambio, undefined);
});

test("tarjetas: las favoritas en su orden; sin favoritas, las dos con más gasto del mes", () => {
  const cuentas = [
    cuenta({ id: "visa", tipo: "credito", cupoTotal: 500, disponible: -45.1, diaCorte: 28, diaPago: 5 }),
    cuenta({ id: "master", tipo: "credito", cupoTotal: 500, disponible: 380 }),
    cuenta({ id: "amex", tipo: "credito", cupoTotal: 1000, disponible: 1000 }),
    cuenta({ id: "ahorro", tipo: "ahorro", disponible: 50 }),
  ];
  const gastos = [
    gasto({ id: "1", monto: 545.1, fecha: "2026-10-03", cuentaId: "visa" }),
    gasto({ id: "2", monto: 120, fecha: "2026-10-04", cuentaId: "master" }),
    gasto({ id: "3", monto: 999, fecha: "2026-09-04", cuentaId: "amex" }),
  ];
  const favoritas = resumenTarjetas(cuentas, gastos, "2026-10", ["master", "ahorro", "visa"], "2026-10-20");
  assert.deepEqual(favoritas.map((t) => t.cuenta.id), ["master", "visa"]);
  const visa = favoritas[1];
  assert.equal(visa.gastadoMes, 545.1);
  assert.equal(visa.sobreendeudada, true);
  assert.equal(visa.usado, 109);
  assert.equal(visa.corte, "2026-10-28");
  assert.equal(visa.pago, "2026-11-05");
  assert.deepEqual(resumenTarjetas(cuentas, gastos, "2026-10", [], "2026-10-20").map((t) => t.cuenta.id), ["visa", "master"]);
});

test("ahorro: saldo de las cuentas de ahorro y la tasa de lo que te quedó", () => {
  const r = resumenAhorro(
    [cuenta({ id: "a", tipo: "ahorro", disponible: 875.32 }), cuenta({ id: "e", tipo: "efectivo", disponible: 50 })],
    [gasto({ id: "g", monto: 1265.44, fecha: "2026-10-02" })],
    [ingreso({ id: "i", monto: 2500, fecha: "2026-10-01" })],
    "2026-10"
  );
  assert.equal(r.cuentas.length, 1);
  assert.equal(r.totalAhorrado, 875.32);
  assert.equal(r.teQuedo, 1234.56);
  assert.equal(r.tasa, 49);
  assert.equal(resumenAhorro([], [], [], "2026-10").tasa, undefined);
});

test("diferidos: cuotas que faltan desde el gasto que los creó, o estimadas", () => {
  const deuda = (d: Partial<Deuda> & Pick<Deuda, "id">): Deuda => ({
    nombre: "Celular", tipo: "diferido", montoTotal: 600, saldoPendiente: 200, cuotaMensual: 50,
    fechaInicio: "2026-03-01", createdAt: "2026-03-01T00:00:00Z", ...d,
  });
  const r = resumenDiferidos(
    [
      deuda({ id: "d1", gastoId: "g1", cuentaId: "visa" }),
      deuda({ id: "d2", nombre: "Lavadora", montoTotal: 192.6, saldoPendiente: 64.2, cuotaMensual: 32.1 }),
      deuda({ id: "d3", nombre: "Pagado", saldoPendiente: 0 }),
      deuda({ id: "d4", nombre: "Préstamo", tipo: "prestamo" }),
    ],
    [cuenta({ id: "visa", tipo: "credito", nombre: "Visa Prueba" })],
    [gasto({ id: "g1", monto: 600, fecha: "2026-03-01", mesesDiferido: 12 })]
  );
  assert.deepEqual(r.filas.map((f) => [f.deuda.nombre, f.tarjeta, f.cuotasRestantes, f.cuotasTotales]), [
    ["Celular", "Visa Prueba", 4, 12],
    ["Lavadora", undefined, 2, 6],
  ]);
  assert.equal(r.cuotasDelMes, 82.1);
});
