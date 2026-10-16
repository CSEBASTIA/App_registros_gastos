import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fechaHora,
  fechaLarga,
  filasDetalleAviso,
  filasDetalleGasto,
  filasDetalleIngreso,
  textoUbicacion,
} from "../src/lib/detalleTransaccion.ts";
import type { Categoria, Cuenta, Gasto, Ingreso, Lugar, TransaccionDetectada } from "../src/types/domain.ts";

const zona = { zona: "America/Guayaquil" };
const comida: Categoria = { id: "c1", nombre: "Comida", tipo: "gasto", color: "#f00" } as Categoria;
const otros: Categoria = { id: "c2", nombre: "Otros", tipo: "gasto", color: "#999" } as Categoria;
const visa: Cuenta = { id: "a1", nombre: "Visa Produbanco", tipo: "credito", banco: "produbanco", disponible: 900, createdAt: "" } as Cuenta;
const supermaxi: Lugar = { id: "l1", nombre: "Supermaxi El Bosque", latitud: -0.1807, longitud: -78.4678, radioM: 80, createdAt: "" };

const gasto: Gasto = {
  id: "8f14e45f-ceea-467a-9575-5a3c1b2d9e10",
  monto: 23.5,
  descripcion: "Compras de la semana",
  categoriaId: "c1",
  cuentaId: "a1",
  metodoPago: "credito",
  billetera: "apple_pay",
  ubicacion: { latitud: -0.18072, longitud: -78.46781, precisionM: 12.4 },
  lugarId: "l1",
  fecha: "2026-10-16",
  // 19:32 UTC = 14:32 en Ecuador
  createdAt: "2026-10-16T19:32:10Z",
};

test("fechaLarga y fechaHora: en español, con la hora de Ecuador", () => {
  assert.equal(fechaLarga("2026-10-16"), "viernes, 16 de octubre de 2026");
  const fh = fechaHora("2026-10-16T19:32:10Z", zona);
  assert.match(fh, /^16 oct\.? 2026, 14:32$/);
  // A las 21:00 de Ecuador ya es el día siguiente en UTC: manda la zona del teléfono.
  assert.match(fechaHora("2026-10-17T02:00:00Z", zona), /^16 oct\.? 2026, 21:00$/);
  assert.equal(fechaHora("no es fecha", zona), "no es fecha");
  assert.equal(textoUbicacion({ latitud: -0.18072, longitud: -78.46781, precisionM: 12.4 }), "-0.1807, -78.4678 (±12 m)");
  assert.equal(textoUbicacion({ latitud: 1, longitud: 2 }), "1.0000, 2.0000");
});

test("filasDetalleGasto: id, fecha, hora de registro, lugar, ubicación, método con billetera y cuenta", () => {
  const filas = filasDetalleGasto(gasto, { categoria: comida, cuenta: visa, lugar: supermaxi }, zona);
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor;
  assert.deepEqual(filas.map((f) => f.clave), ["id", "fecha", "registrado", "lugar", "ubicacion", "categoria", "metodo", "cuenta"]);
  assert.equal(valor("id"), gasto.id);
  assert.equal(filas[0].mono, true);
  assert.equal(valor("fecha"), "viernes, 16 de octubre de 2026");
  assert.match(valor("registrado")!, /14:32$/);
  assert.equal(valor("lugar"), "Supermaxi El Bosque");
  assert.equal(valor("ubicacion"), "-0.1807, -78.4678 (±12 m)");
  assert.equal(valor("metodo"), "Crédito con Apple Pay");
  assert.equal(valor("cuenta"), "Visa Produbanco");
});

test("filasDetalleGasto: sin lugar ni ubicación no muestra esas filas; diferido, factura y «Otros» con detalle", () => {
  const diferido: Gasto = {
    ...gasto,
    billetera: undefined,
    ubicacion: undefined,
    lugarId: undefined,
    metodoPago: "diferido",
    mesesDiferido: 12,
    tasaInteres: 16,
    categoriaId: "c2",
    categoriaDetalle: "Regalo",
    facturaPath: "u/factura.pdf",
  };
  const filas = filasDetalleGasto(diferido, { categoria: otros }, zona);
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor;
  assert.equal(valor("lugar"), undefined);
  assert.equal(valor("ubicacion"), undefined);
  assert.equal(valor("metodo"), "Diferido");
  assert.equal(valor("diferido"), "12 meses · 16% anual");
  assert.equal(valor("categoria"), "Otros · Regalo");
  assert.equal(valor("cuenta"), "Sin cuenta");
  assert.equal(valor("factura"), "Adjunta");
  assert.equal(filasDetalleGasto({ ...diferido, tasaInteres: 0 }, {}, zona).find((f) => f.clave === "diferido")?.valor, "12 meses · sin interés");
  // Sin método ni billetera, no hay fila de método.
  assert.equal(filasDetalleGasto({ ...gasto, metodoPago: undefined, billetera: undefined }, {}, zona).some((f) => f.clave === "metodo"), false);
});

test("filasDetalleIngreso y filasDetalleAviso: la bandeja muestra la hora del pago de la billetera", () => {
  const ingreso: Ingreso = { id: "i-1", monto: 500, descripcion: "Sueldo", fecha: "2026-10-01", createdAt: "2026-10-01T14:00:00Z" };
  const fi = filasDetalleIngreso(ingreso, {}, zona);
  assert.deepEqual(fi.map((f) => f.clave), ["id", "fecha", "registrado", "categoria", "cuenta"]);
  assert.equal(fi.find((f) => f.clave === "categoria")?.valor, "Sin fuente");

  const aviso: TransaccionDetectada = {
    id: "t-1",
    mensajeId: "google_wallet:x",
    tipo: "gasto",
    monto: 12.5,
    descripcion: "SUPERMAXI",
    banco: "pichincha",
    fecha: "2026-10-16",
    origen: "google_wallet",
    comercio: "SUPERMAXI",
    tarjetaFinal: "4321",
    estado: "pendiente",
    createdAt: "2026-10-16T17:05:00Z",
  };
  const fa = filasDetalleAviso(aviso, {}, zona);
  const valor = (clave: string) => fa.find((f) => f.clave === clave);
  assert.equal(valor("origen")?.valor, "Google Wallet");
  assert.equal(valor("llego")?.etiqueta, "Hora del pago");
  assert.match(valor("llego")!.valor, /12:05$/);
  assert.equal(valor("banco")?.valor, "Banco Pichincha");
  assert.equal(valor("tarjeta")?.valor, "•••• 4321");
  assert.equal(valor("cuenta")?.valor, "Por elegir");
  assert.equal(filasDetalleAviso({ ...aviso, origen: "correo", correoAsunto: "Consumo aprobado" }, {}, zona).find((f) => f.clave === "llego")?.etiqueta, "Llegó");
});

test("hora del pago: el gasto confirmado desde la billetera la muestra antes de «Registrado»; el aviso la usa si la tiene", () => {
  // Pagó a las 12:05 y lo confirmó en la bandeja a las 14:32.
  const confirmado: Gasto = { ...gasto, pagadoEn: "2026-10-16T17:05:00Z" };
  const filas = filasDetalleGasto(confirmado, {}, zona);
  const claves = filas.map((f) => f.clave);
  assert.ok(claves.indexOf("pagado") === claves.indexOf("registrado") - 1);
  assert.equal(filas.find((f) => f.clave === "pagado")?.etiqueta, "Hora del pago");
  assert.match(filas.find((f) => f.clave === "pagado")!.valor, /12:05$/);
  assert.equal(filasDetalleGasto(gasto, {}, zona).some((f) => f.clave === "pagado"), false);

  const atrasado: TransaccionDetectada = {
    id: "t-2",
    mensajeId: "google_wallet:y",
    tipo: "gasto",
    monto: 2.4,
    descripcion: "Panadería",
    fecha: "2026-10-14",
    origen: "google_wallet",
    estado: "pendiente",
    createdAt: "2026-10-16T17:05:00Z",
    pagadoEn: "2026-10-14T13:15:00Z",
  };
  assert.match(filasDetalleAviso(atrasado, {}, zona).find((f) => f.clave === "llego")!.valor, /^14 oct\.? 2026, 08:15$/);
});

test("semanaDeFecha y semanaInicial: Gastos abre en la semana de hoy (1-7, 8-14, 15-21, 22 al fin de mes)", async () => {
  const { semanaDeFecha, semanaInicial } = await import("../src/lib/semanas.ts");
  assert.equal(semanaDeFecha("2026-10-01"), 1);
  assert.equal(semanaDeFecha("2026-10-07"), 1);
  assert.equal(semanaDeFecha("2026-10-08"), 2);
  assert.equal(semanaDeFecha("2026-10-16"), 3);
  assert.equal(semanaDeFecha("2026-10-21"), 3);
  assert.equal(semanaDeFecha("2026-10-22"), 4);
  assert.equal(semanaDeFecha("2026-10-31"), 4);
  assert.equal(semanaInicial("2026-10", "2026-10-16"), 3);
  assert.equal(semanaInicial("2026-10", "2026-10-23"), 4);
  // Otro mes: empieza en la semana 1.
  assert.equal(semanaInicial("2026-09", "2026-10-16"), 1);
});
