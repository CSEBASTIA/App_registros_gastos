import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cambiosDeGasto,
  cambiosDeIngreso,
  edicionPermitida,
  MENSAJE_EDICION_DIFERIDO,
  sinCambios,
} from "../src/lib/edicionMovimiento.ts";
import { fechaPropuesta } from "../src/lib/semanas.ts";
import type { Gasto, Ingreso } from "../src/types/domain.ts";

const almuerzo: Gasto = {
  id: "g1",
  monto: 5.2,
  descripcion: "Almuerzo",
  categoriaId: "c-comida",
  cuentaId: "a-debito",
  metodoPago: "debito",
  fecha: "2026-10-16",
  createdAt: "",
};

const formulario = (g: Gasto | Ingreso) => ({
  monto: g.monto,
  descripcion: g.descripcion,
  categoriaId: g.categoriaId,
  categoriaDetalle: g.categoriaDetalle,
  cuentaId: g.cuentaId ?? "",
  fecha: g.fecha,
});

test("fechaPropuesta: «+ Nuevo» propone una fecha del mes y la semana que se estaban viendo", () => {
  const hoy = "2026-10-16";
  assert.equal(fechaPropuesta("2026-10", hoy, 3), hoy); // semana de hoy
  assert.equal(fechaPropuesta("2026-10", hoy), hoy); // mes actual, sin semana
  assert.equal(fechaPropuesta("2026-09", hoy, 2), "2026-09-14"); // semana pasada: su último día
  assert.equal(fechaPropuesta("2026-09", hoy), "2026-09-30"); // mes pasado: su último día
  assert.equal(fechaPropuesta("2026-02", hoy, 4), "2026-02-28"); // febrero corto
  assert.equal(fechaPropuesta("2026-10", hoy, 1), "2026-10-07"); // semana ya pasada de este mes
  assert.equal(fechaPropuesta("2026-10", hoy, 4), "2026-10-22"); // semana que todavía no llega: su primer día
  assert.equal(fechaPropuesta("2026-11", hoy), "2026-11-01");
  assert.equal(fechaPropuesta(undefined, hoy), hoy);
  assert.equal(fechaPropuesta("septiembre", hoy), hoy);
  assert.equal(fechaPropuesta("2026-13", hoy), hoy);
});

test("cambiosDeGasto: solo envía lo que cambió", () => {
  assert.ok(sinCambios(cambiosDeGasto(almuerzo, formulario(almuerzo))));
  // $5,20 → $5,70 y otra cuenta; 5.2 vs 5.20000001 no cuenta como cambio.
  assert.deepEqual(
    cambiosDeGasto(almuerzo, { ...formulario(almuerzo), monto: 5.7, cuentaId: "a-efectivo", descripcion: " Almuerzo " }),
    { monto: 5.7, cuentaId: "a-efectivo" },
  );
  assert.ok(sinCambios(cambiosDeGasto(almuerzo, { ...formulario(almuerzo), monto: 5.2000001 })));
  // Quitar la cuenta y cambiar la fecha y la categoría.
  assert.deepEqual(
    cambiosDeGasto(almuerzo, { ...formulario(almuerzo), cuentaId: "", fecha: "2026-10-15", categoriaId: "c-otros", categoriaDetalle: "Regalo" }),
    { cuentaId: "", fecha: "2026-10-15", categoriaId: "c-otros", categoriaDetalle: "Regalo" },
  );
});

test("cambiosDeGasto: un diferido solo cambia descripción y categoría", () => {
  const audifonos: Gasto = { ...almuerzo, id: "g2", monto: 36, descripcion: "Audífonos", cuentaId: "a-visa", metodoPago: "diferido", mesesDiferido: 3 };
  assert.deepEqual(edicionPermitida(audifonos), { monto: false, cuenta: false, fecha: false, aviso: MENSAJE_EDICION_DIFERIDO });
  assert.deepEqual(edicionPermitida(almuerzo), { monto: true, cuenta: true, fecha: true });
  assert.deepEqual(
    cambiosDeGasto(audifonos, { ...formulario(audifonos), descripcion: "Audífonos inalámbricos", categoriaId: "c-tecno" }),
    { descripcion: "Audífonos inalámbricos", categoriaId: "c-tecno" },
  );
  for (const cambio of [{ monto: 40 }, { cuentaId: "a-otra" }, { fecha: "2026-10-20" }]) {
    assert.throws(() => cambiosDeGasto(audifonos, { ...formulario(audifonos), ...cambio }), { message: MENSAJE_EDICION_DIFERIDO });
  }
});

test("cambiosDeIngreso: solo lo que cambió; sin cuenta o sin fuente se envía como null", () => {
  const sueldo: Ingreso = { id: "i1", monto: 500, descripcion: "Sueldo", categoriaId: "c-sueldo", cuentaId: "a-debito", fecha: "2026-10-01", createdAt: "" };
  assert.ok(sinCambios(cambiosDeIngreso(sueldo, formulario(sueldo))));
  assert.deepEqual(
    cambiosDeIngreso(sueldo, { ...formulario(sueldo), monto: 520, cuentaId: "", categoriaId: undefined, fecha: "2026-10-02" }),
    { monto: 520, cuentaId: null, categoriaId: null, fecha: "2026-10-02" },
  );
});
