import { test } from "node:test";
import assert from "node:assert/strict";
import { claveComercio, detectarSuscripciones, totalMensualSuscripciones } from "../src/lib/suscripciones.ts";
import { proyectarMes } from "../src/lib/proyeccionMes.ts";
import type { Gasto, Presupuesto } from "../src/types/domain.ts";

let n = 0;
function gasto(descripcion: string, fecha: string, monto: number, categoriaId = "ocio"): Gasto {
  n++;
  return { id: `g${n}`, descripcion, fecha, monto, categoriaId, createdAt: `${fecha}T12:00:${String(n % 60).padStart(2, "0")}Z` };
}

test("claveComercio: el mismo comercio con referencias distintas da la misma clave", () => {
  assert.equal(claveComercio("NETFLIX.COM 8829-221"), claveComercio("Netflix.com"));
  assert.equal(claveComercio("Gimnasio Fuerza Total 0012"), claveComercio("GIMNASIO FUERZA TOTAL 0098"));
});

test("un servicio conocido es suscripción con 2 cobros mensuales", () => {
  const [s, ...resto] = detectarSuscripciones(
    [gasto("NETFLIX.COM 123", "2026-09-05", 10.99), gasto("Netflix.com 456", "2026-10-05", 10.99)],
    "2026-10-20",
  );
  assert.equal(resto.length, 0);
  assert.equal(s.nombre, "Netflix");
  assert.equal(s.cobros, 2);
  assert.equal(s.proximoCobro, "2026-11-05");
  assert.equal(s.estado, "activa");
  assert.equal(s.subioPrecio, false);
});

test("un comercio cualquiera necesita 3 cobros mensuales", () => {
  const dos = [gasto("Gimnasio Fuerza", "2026-08-10", 30), gasto("Gimnasio Fuerza", "2026-09-10", 30)];
  assert.equal(detectarSuscripciones(dos, "2026-09-20").length, 0);
  const tres = [...dos, gasto("Gimnasio Fuerza", "2026-10-10", 30)];
  assert.equal(detectarSuscripciones(tres, "2026-10-20").length, 1);
});

test("compras frecuentes en el mismo lugar no son suscripción", () => {
  const supermercado = ["2026-09-02", "2026-09-09", "2026-09-17", "2026-10-01", "2026-10-08"].map((f) =>
    gasto("Supermaxi", f, 40),
  );
  assert.equal(detectarSuscripciones(supermercado, "2026-10-20").length, 0);
});

test("avisa cuando sube el precio", () => {
  const [s] = detectarSuscripciones(
    [gasto("Spotify", "2026-08-03", 5.99), gasto("Spotify", "2026-09-03", 5.99), gasto("Spotify", "2026-10-03", 6.99)],
    "2026-10-10",
  );
  assert.equal(s.subioPrecio, true);
  assert.equal(s.montoAnterior, 5.99);
  assert.equal(s.monto, 6.99);
});

test("más de 10 días sin el cobro esperado → cancelada", () => {
  const cobros = [gasto("Disney Plus", "2026-07-15", 7.99), gasto("Disney Plus", "2026-08-15", 7.99)];
  const [atrasada] = detectarSuscripciones(cobros, "2026-09-25");
  assert.equal(atrasada.estado, "activa");
  assert.equal(atrasada.diasAtraso, 10);
  const [cancelada] = detectarSuscripciones(cobros, "2026-09-26");
  assert.equal(cancelada.estado, "cancelada");
  assert.equal(totalMensualSuscripciones([cancelada]), 0);
});

test("dos cobros el mismo día cuentan como uno", () => {
  const [s] = detectarSuscripciones(
    [gasto("Netflix", "2026-09-05", 10.99), gasto("Netflix", "2026-10-05", 10.99), gasto("Netflix", "2026-10-05", 10.99)],
    "2026-10-06",
  );
  assert.equal(s.cobros, 2);
});

test("proyección sin historial: reparte lo gastado por día", () => {
  const p = proyectarMes("2026-10", "2026-10-10", [gasto("Comida", "2026-10-02", 100, "comida")], []);
  assert.equal(p.metodo, "ritmo");
  assert.equal(p.gastado, 100);
  assert.equal(p.proyectado, 310); // 100 / 10 días × 31
});

test("proyección con historial: suma lo que se suele gastar después de este día", () => {
  const gastos = [
    // Meses previos: 50 antes del día 10 y 150 después.
    ...["2026-07", "2026-08", "2026-09"].flatMap((m) => [gasto("Comida", `${m}-05`, 50, "comida"), gasto("Comida", `${m}-20`, 150, "comida")]),
    gasto("Comida", "2026-10-05", 50, "comida"),
  ];
  const p = proyectarMes("2026-10", "2026-10-10", gastos, []);
  assert.equal(p.metodo, "historial");
  assert.equal(p.proyectado, 200);

  // Si este mes se gastó el doble a esta altura, se espera el doble de lo restante.
  const p2 = proyectarMes("2026-10", "2026-10-10", [...gastos, gasto("Comida", "2026-10-06", 50, "comida")], []);
  assert.equal(p2.proyectado, 400);
});

test("las suscripciones pendientes se suman una vez; las cobradas no se duplican", () => {
  const netflix = [gasto("Netflix", "2026-08-25", 10), gasto("Netflix", "2026-09-25", 10)];
  const spotify = [gasto("Spotify", "2026-09-03", 6), gasto("Spotify", "2026-10-03", 6)];
  const todos = [...netflix, ...spotify, gasto("Comida", "2026-10-05", 100, "comida")];
  const subs = detectarSuscripciones(todos, "2026-10-10");
  const p = proyectarMes("2026-10", "2026-10-10", todos, subs);
  assert.equal(p.gastado, 106);
  assert.equal(p.suscripcionesPendientes, 10); // Netflix del 25; Spotify ya se cobró
  // Variable sin historial: 100 / 10 × 31 = 310; + Spotify 6 cobrado + Netflix 10 pendiente.
  assert.equal(p.proyectado, 326);
});

test("avisa qué presupuestos se pasarán", () => {
  const presupuestos: Presupuesto[] = [
    { id: "p1", categoriaId: "comida", montoLimite: 250, mes: "2026-10" },
    { id: "p2", categoriaId: "ocio", montoLimite: 100, mes: "2026-10" },
  ];
  const gastos = [gasto("Comida", "2026-10-02", 100, "comida"), gasto("Cine", "2026-10-03", 10, "ocio")];
  const p = proyectarMes("2026-10", "2026-10-10", gastos, [], presupuestos, [
    { id: "comida", nombre: "Comida", color: "", tipo: "gasto" },
    { id: "ocio", nombre: "Ocio", color: "", tipo: "gasto" },
  ] as never);
  assert.equal(p.presupuestos[0].categoriaNombre, "Comida");
  assert.equal(p.presupuestos[0].excedera, true);
  assert.equal(p.presupuestos[0].exceso, 60);
  assert.equal(p.presupuestos[1].excedera, false);
});

test("mes ya cerrado: la proyección es lo gastado", () => {
  const p = proyectarMes("2026-09", "2026-10-10", [gasto("Comida", "2026-09-02", 80, "comida")], []);
  assert.equal(p.metodo, "cerrado");
  assert.equal(p.proyectado, 80);
});
