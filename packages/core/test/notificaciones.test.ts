import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO,
  avisoBandeja,
  guardarPreferenciasNotificaciones,
  leerPreferenciasNotificaciones,
  normalizarPreferenciasNotificaciones,
  recordatoriosAProgramar,
  textoAvisoPresupuesto,
} from "../src/lib/notificaciones.ts";
import type { Recordatorio } from "../src/types/domain.ts";

/** 18-oct-2026 a la hora local indicada. */
const el18 = (hora: number, minuto = 0) => new Date(2026, 9, 18, hora, minuto);

function recordatorio(id: string, fecha: string, extra: Partial<Recordatorio> = {}): Recordatorio {
  return { id, titulo: `Pago ${id}`, tipo: "pago", fecha, recurrente: false, completado: false, createdAt: "", ...extra };
}

function almacen() {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

test("preferencias: todo encendido por defecto, 1 día antes a las 9; lo raro vuelve al valor por defecto", () => {
  assert.deepEqual(normalizarPreferenciasNotificaciones(undefined), PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO);
  assert.deepEqual(
    normalizarPreferenciasNotificaciones({ pagos: false, bandeja: "no", diasAntes: 2, hora: 25, presupuestos: false }),
    { ...PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO, pagos: false, presupuestos: false }
  );
  assert.equal(normalizarPreferenciasNotificaciones({ diasAntes: 3, hora: 20 }).diasAntes, 3);
});

test("preferencias: se guardan por persona y un JSON roto no rompe nada", async () => {
  const a = almacen();
  await guardarPreferenciasNotificaciones(a, "ana", { ...PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO, recordatorios: false, hora: 20 });
  assert.equal((await leerPreferenciasNotificaciones(a, "ana")).recordatorios, false);
  assert.equal((await leerPreferenciasNotificaciones(a, "beto")).recordatorios, true);
  a.datos.set("fintrack.notificaciones.carla", "{roto");
  assert.deepEqual(await leerPreferenciasNotificaciones(a, "carla"), PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO);
});

test("recordatoriosAProgramar: días antes a la hora elegida, o el mismo día si ya pasó; nada si venció", () => {
  const lista = [
    recordatorio("en5", "2026-10-23", { monto: 36 }),
    recordatorio("manana", "2026-10-19"),
    recordatorio("hoy", "2026-10-18"),
    recordatorio("vencido", "2026-10-10"),
    recordatorio("hecho", "2026-10-25", { completado: true }),
  ];
  const prefs = { diasAntes: 3 as const, hora: 9 };
  // 18-oct, 10:00: las 9 de hoy ya pasaron.
  assert.deepEqual(
    recordatoriosAProgramar(lista, el18(10), prefs).map((n) => [n.id, n.fecha, n.hora, n.cuerpo]),
    [
      ["recordatorio:manana", "2026-10-19", 9, "Vence hoy."],
      ["recordatorio:en5", "2026-10-20", 9, "Vence en 3 días · $36.00."],
    ]
  );
  // 18-oct, 8:00: el de hoy todavía se avisa hoy a las 9; el de mañana, hoy (3 días antes ya pasó).
  assert.deepEqual(
    recordatoriosAProgramar(lista, el18(8), { diasAntes: 1, hora: 9 }).map((n) => [n.id, n.fecha, n.cuerpo]),
    [
      ["recordatorio:hoy", "2026-10-18", "Vence hoy."],
      ["recordatorio:manana", "2026-10-18", "Vence mañana."],
      ["recordatorio:en5", "2026-10-22", "Vence mañana · $36.00."],
    ]
  );
});

test("recordatoriosAProgramar: de un diferido solo la cuota que toca, y como mucho `maximo`", () => {
  const cuotas = ["2026-10-20", "2026-11-20", "2026-12-20"].map((fecha, i) =>
    recordatorio(`c${i}`, fecha, { automatico: true, deudaId: "d1", recurrente: false })
  );
  const programadas = recordatoriosAProgramar(cuotas, el18(10), { diasAntes: 0, hora: 9 });
  assert.deepEqual(programadas.map((n) => n.id), ["recordatorio:c0"]);
  const muchos = Array.from({ length: 10 }, (_, i) => recordatorio(`r${i}`, `2026-11-${String(i + 1).padStart(2, "0")}`));
  assert.equal(recordatoriosAProgramar(muchos, el18(10), { diasAntes: 0, hora: 9 }, 4).length, 4);
});

test("avisoBandeja: nada si está vacía; hoy a las 19 o mañana si ya pasó", () => {
  assert.equal(avisoBandeja(0, el18(10)), null);
  const hoy = avisoBandeja(1, el18(10))!;
  assert.deepEqual([hoy.fecha, hoy.hora, hoy.titulo, hoy.ruta], ["2026-10-18", 19, "Tienes 1 movimiento por confirmar", "/bandeja"]);
  const manana = avisoBandeja(3, el18(20))!;
  assert.deepEqual([manana.fecha, manana.titulo], ["2026-10-19", "Tienes 3 movimientos por confirmar"]);
});

test("textoAvisoPresupuesto: 75 %, límite y te pasaste, sin errores de coma flotante", () => {
  const base = { presupuestoId: "p", categoria: "Comida", limite: 20 };
  assert.deepEqual(textoAvisoPresupuesto({ ...base, nivel: 75, porcentaje: 82.5, gastado: 16.5 }), {
    titulo: "Presupuesto de Comida: 82 %",
    cuerpo: "Llevas $16.50 de $20.00 este mes. Te quedan $3.50.",
  });
  assert.equal(textoAvisoPresupuesto({ ...base, nivel: 100, porcentaje: 100, gastado: 20 }).titulo, "Llegaste al límite de Comida");
  assert.deepEqual(textoAvisoPresupuesto({ ...base, nivel: 101, porcentaje: 100.5, gastado: 20.1 }), {
    titulo: "Te pasaste del presupuesto de Comida",
    cuerpo: "Llevas $20.10: $0.10 más que el límite de $20.00.",
  });
});
