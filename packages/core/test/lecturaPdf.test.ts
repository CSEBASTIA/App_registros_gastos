import { test } from "node:test";
import assert from "node:assert/strict";
import { cuentaDelEstado, parsearComprobante, pareceEstadoDeCuenta } from "../src/lib/lecturaPdf.ts";
import {
  consultaGmailEstadosDeCuenta,
  estadosDeCuentaEnCorreos,
  textoNotificacionEstadoCuenta,
  type CorreoRecibido,
} from "../src/lib/sincronizacionCorreo.ts";
import type { Cuenta } from "../src/types/domain.ts";

// Datos inventados (nombres y dígitos que se ve que no son reales).
const cuenta = (c: Partial<Cuenta> & Pick<Cuenta, "id" | "tipo" | "banco">): Cuenta => ({
  nombre: c.id,
  disponible: 0,
  createdAt: "2026-10-01T00:00:00Z",
  ...c,
});

const ESTADO_AHORRO = [
  "Página 1 de 3",
  "ESTADO DE CUENTA",
  "PRUEBA LOPEZ ANA FECHA ÚLTIMO CORTE (FACTURA) 08-09-2026",
  "CUENTA 0000001234",
  "BANCO PICHINCHA C.A. CONCILIACIÓN",
  "SALDO ANTERIOR 50.00",
  "DETALLE DE MOVIMIENTOS",
  "FECHA OFIC. N.DOC. DESCRIPCION DEBITO CREDITO SALDO",
  "12-sep. 11 12345678 TRANSFERENCIA INTERNET 12.34 0.00 37.66",
  "Daremos por recibida su conformidad al presente estado de cuenta, a menos que en 30 días…",
].join("\n");

test("reconoce la cuenta de un estado de ahorro por el banco y los últimos dígitos", () => {
  const cuentas = [
    cuenta({ id: "ahorro-1234", tipo: "ahorro", banco: "pichincha", identificador: "1234" }),
    cuenta({ id: "ahorro-5678", tipo: "ahorro", banco: "pichincha", identificador: "5678" }),
    cuenta({ id: "tarjeta-1234", tipo: "credito", banco: "pichincha", identificador: "1234" }),
  ];
  assert.deepEqual(cuentaDelEstado(ESTADO_AHORRO, cuentas), {
    cuentaId: "ahorro-1234",
    banco: "pichincha",
    digitos: "1234",
    esTarjeta: false,
  });
});

test("un estado de tarjeta busca solo entre las tarjetas, aunque los dígitos estén enmascarados", () => {
  const texto = [
    "BANCO DE GUAYAQUIL",
    "ESTADO DE CUENTA TARJETA DE CRÉDITO",
    "Tarjeta XXXX-XXXX-XXXX-4321",
    "Cupo total 1.000,00   Pago mínimo 50,00",
  ].join("\n");
  const cuentas = [
    cuenta({ id: "debito-4321", tipo: "debito", banco: "banco_guayaquil", identificador: "4321" }),
    cuenta({ id: "visa-4321", tipo: "credito", banco: "banco_guayaquil", identificador: "4321" }),
  ];
  const r = cuentaDelEstado(texto, cuentas);
  assert.equal(r.cuentaId, "visa-4321");
  assert.equal(r.esTarjeta, true);
  assert.equal(r.digitos, "4321");
});

test("si hay duda no elige: dos cuentas del banco sin dígitos anotados", () => {
  const cuentas = [
    cuenta({ id: "a", tipo: "ahorro", banco: "pichincha" }),
    cuenta({ id: "b", tipo: "ahorro", banco: "pichincha" }),
  ];
  assert.equal(cuentaDelEstado(ESTADO_AHORRO, cuentas).cuentaId, undefined);
});

test("sin banco reconocido, basta que una sola cuenta lleve esos dígitos", () => {
  const texto = "ESTADO DE CUENTA\nCuenta No.: 9876541111\nDETALLE DE MOVIMIENTOS";
  const cuentas = [
    cuenta({ id: "x", tipo: "ahorro", banco: "otro", identificador: "1111" }),
    cuenta({ id: "y", tipo: "ahorro", banco: "otro", identificador: "8765" }),
  ];
  assert.equal(cuentaDelEstado(texto, cuentas).cuentaId, "x");
});

test("los números de los movimientos no se toman como número de cuenta", () => {
  const texto = ["ESTADO DE CUENTA", ...Array.from({ length: 45 }, () => "relleno"), "REG EN CTA-T1-123456789"].join("\n");
  assert.equal(cuentaDelEstado(texto, []).digitos, undefined);
});

test("distingue un estado de cuenta de una factura", () => {
  assert.equal(pareceEstadoDeCuenta(ESTADO_AHORRO), true);
  assert.equal(pareceEstadoDeCuenta("FACTURA No. 001-001-000001234\nVALOR TOTAL 12.34"), false);
});

test("factura electrónica: el valor total (no el subtotal), la fecha de emisión y el comercio de arriba", () => {
  const texto = [
    "TIENDA PRUEBA S A",
    "R.U.C.: 0999999999001",
    "FACTURA",
    "No. 001-001-000001234",
    "NÚMERO DE AUTORIZACIÓN 1234567890",
    "FECHA Y HORA DE AUTORIZACIÓN: 02/10/2026 12:34:56",
    "Razón Social / Nombres y Apellidos: PRUEBA LOPEZ ANA",
    "Fecha Emisión: 01/10/2026",
    "SUBTOTAL 15% 10.73",
    "IVA 15% 1.61",
    "VALOR TOTAL 12.34",
  ].join("\n");
  assert.deepEqual(parsearComprobante(texto, "2026-10-20"), {
    monto: 12.34,
    fecha: "2026-10-01",
    comercio: "TIENDA PRUEBA S A",
  });
});

test("comprobante de transferencia: monto, fecha y beneficiario", () => {
  const texto = [
    "Comprobante de transferencia",
    "Fecha: 15/10/2026 12:34",
    "Beneficiario: PRUEBA LOPEZ ANA",
    "Cuenta destino: ****1234",
    "Monto: $50,00",
    "Comisión: $0,41",
  ].join("\n");
  assert.deepEqual(parsearComprobante(texto, "2026-10-20"), {
    monto: 50,
    fecha: "2026-10-15",
    comercio: "PRUEBA LOPEZ ANA",
  });
});

test("un comprobante sin total legible ni fecha válida deja esos datos vacíos", () => {
  const r = parsearComprobante("FARMACIA PRUEBA\nGracias por su compra\nFecha: 31/02/2026", "2026-10-20");
  assert.equal(r.monto, undefined);
  assert.equal(r.fecha, undefined);
  assert.equal(r.comercio, "FARMACIA PRUEBA");
  assert.equal(r.categoriaSugerida, "Salud");
});

test("una fecha en el futuro no se toma como la del comprobante", () => {
  assert.equal(parsearComprobante("Fecha: 15/12/2026\nTOTAL 12.34", "2026-10-20").fecha, undefined);
});

const correo = (c: Partial<CorreoRecibido>): CorreoRecibido => ({
  mensajeId: "m",
  remitente: "",
  asunto: "",
  cuerpoTexto: "",
  fecha: "2026-10-08",
  ...c,
});

test("detecta los correos con el estado de cuenta en PDF y marca el remitente desconocido", () => {
  const r = estadosDeCuentaEnCorreos([
    correo({ mensajeId: "1", remitente: "banco@pichincha.com", asunto: "Tu estado de cuenta de septiembre", tienePdf: true, fecha: "2026-09-08" }),
    correo({ mensajeId: "2", remitente: "avisos@banco-falso.test", asunto: "Estado de cuenta Banco Pichincha", tienePdf: true, fecha: "2026-10-08" }),
    correo({ mensajeId: "3", remitente: "banco@pichincha.com", asunto: "Estado de cuenta", tienePdf: false }),
    correo({ mensajeId: "4", remitente: "tienda@prueba.test", asunto: "Tu factura", tienePdf: true }),
  ]);
  assert.deepEqual(r, [
    { mensajeId: "2", remitente: "avisos@banco-falso.test", fecha: "2026-10-08", banco: "pichincha", remitenteConocido: false },
    { mensajeId: "1", remitente: "banco@pichincha.com", fecha: "2026-09-08", banco: "pichincha", remitenteConocido: true },
  ]);
});

test("la búsqueda de Gmail pide PDF adjunto y los últimos días; la notificación abre la lista", () => {
  assert.match(consultaGmailEstadosDeCuenta(90), /has:attachment filename:pdf newer_than:90d/);
  const n = textoNotificacionEstadoCuenta({ mensajeId: "1", remitente: "banco@pichincha.com", fecha: "2026-10-08", banco: "pichincha", remitenteConocido: true });
  assert.equal(n.titulo, "Llegó tu estado de cuenta de Banco Pichincha");
  // Solo rutas sin parámetros: el id del correo no viaja en la notificación.
  assert.match(n.ruta, /^\/[a-z/-]*$/);
});
