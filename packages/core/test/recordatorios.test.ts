import { test } from "node:test";
import assert from "node:assert/strict";
import { organizarRecordatorios, textoVencimiento } from "../src/lib/recordatorios.ts";
import { setSupabaseClient } from "../src/client.ts";
import { listarRecordatorios } from "../src/repositories/recordatorios.repo.ts";
import type { Recordatorio } from "../src/types/domain.ts";

function cuota(n: number, fecha: string, extra: Partial<Recordatorio> = {}): Recordatorio {
  return {
    id: `c${n}`,
    titulo: `Cuota ${n} de 3 · Televisor`,
    tipo: "tarjeta",
    monto: 43.34,
    fecha,
    recurrente: false,
    completado: false,
    deudaId: "d1",
    automatico: true,
    createdAt: "",
    ...extra,
  };
}

const manual: Recordatorio = {
  id: "m1",
  titulo: "Pagar el arriendo",
  tipo: "pago",
  fecha: "2026-10-01",
  recurrente: false,
  completado: false,
  createdAt: "",
};

const televisor = [cuota(1, "2026-10-10"), cuota(2, "2026-11-10"), cuota(3, "2026-12-10")];

test("organizarRecordatorios: de un diferido se muestra solo la cuota que toca, con cuántas quedan", () => {
  const r = organizarRecordatorios([...televisor, manual], "2026-10-05");
  assert.deepEqual(r.proximos.map((x) => x.id), ["m1", "c1"]);
  assert.equal(r.cuotasDespues.c1, 2);
  assert.deepEqual(r.anteriores, []);
});

test("organizarRecordatorios: la cuota del día y la vencida siguen a la vista hasta la siguiente", () => {
  assert.deepEqual(organizarRecordatorios(televisor, "2026-10-10").proximos.map((x) => x.id), ["c1"]);
  // Venció el 10 y no se registró el pago: sigue a la vista hasta el 10 de noviembre.
  const vencida = organizarRecordatorios(televisor, "2026-10-25");
  assert.deepEqual(vencida.proximos.map((x) => x.id), ["c1"]);
  // El 10 de noviembre toca la segunda; la primera pasa a «anteriores».
  const siguiente = organizarRecordatorios(televisor, "2026-11-10");
  assert.deepEqual(siguiente.proximos.map((x) => x.id), ["c2"]);
  assert.equal(siguiente.cuotasDespues.c2, 1);
  assert.deepEqual(siguiente.anteriores.map((x) => x.id), ["c1"]);
});

test("organizarRecordatorios: pagar una cuota muestra la siguiente; al terminar el plazo no queda nada a la vista", () => {
  const pagada = organizarRecordatorios([{ ...televisor[0], completado: true }, televisor[1], televisor[2]], "2026-10-12");
  assert.deepEqual(pagada.proximos.map((x) => x.id), ["c2"]);
  assert.deepEqual(pagada.anteriores.map((x) => x.id), ["c1"]);
  // Un mes después de la última cuota, el diferido venció: todo pasa a «anteriores».
  const vencido = organizarRecordatorios(televisor, "2027-01-10");
  assert.deepEqual(vencido.proximos, []);
  assert.deepEqual(vencido.anteriores.map((x) => x.id), ["c3", "c2", "c1"]);
});

test("organizarRecordatorios: los manuales vencidos no se esconden y cada diferido va por separado", () => {
  const otra = [cuota(1, "2026-10-20", { id: "o1", deudaId: "d2" }), cuota(2, "2026-11-20", { id: "o2", deudaId: "d2" })];
  const r = organizarRecordatorios([...televisor, ...otra, manual, { ...manual, id: "m2", completado: true }], "2026-12-15");
  assert.deepEqual(r.proximos.map((x) => x.id), ["m1", "o2", "c3"]);
  assert.equal(r.cuotasDespues.o2, 0);
  assert.ok(r.anteriores.some((x) => x.id === "m2"));
});

test("textoVencimiento", () => {
  assert.equal(textoVencimiento("2026-10-16", "2026-10-16"), "hoy");
  assert.equal(textoVencimiento("2026-10-17", "2026-10-16"), "mañana");
  assert.equal(textoVencimiento("2026-10-20", "2026-10-16"), "en 4 días");
  assert.equal(textoVencimiento("2026-10-15", "2026-10-16"), "venció ayer");
  assert.equal(textoVencimiento("2026-10-13", "2026-10-16"), "venció hace 3 días");
});

test("listarRecordatorios: lee la marca de automático y funciona sin la columna (base sin actualizar)", async () => {
  const filas = [
    { id: "1", titulo: "Cuota 1 de 3 · TV", tipo: "tarjeta", monto: "43.34", fecha: "2026-10-10", recurrente: false, frecuencia: null, completado: false, deuda_id: "d1", automatico: true, created_at: "" },
    { id: "2", titulo: "Arriendo", tipo: "pago", monto: null, fecha: "2026-10-01", recurrente: true, frecuencia: "mensual", completado: false, deuda_id: null, created_at: "" },
  ];
  setSupabaseClient({
    from: () => ({ select: () => ({ order: async () => ({ data: filas, error: null }) }) }),
  } as any);
  const lista = await listarRecordatorios();
  assert.equal(lista[0].automatico, true);
  assert.equal(lista[0].monto, 43.34);
  assert.equal(lista[1].automatico, false);
});
