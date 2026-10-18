import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEstadoCuenta } from "../src/lib/estadoCuenta.ts";

test("usa la fecha de consumo cuando el estado trae también fecha de proceso", () => {
  const texto = [
    "Fecha proceso  Fecha consumo  Descripción  Monto",
    "15/10/2026  13/10/2026  CINEMARK QUITO  12,50",
    "15/10/2026  12/10/2026  FYBECA CENTRO  1.234,56",
    "15/10/2026  11/10/2026  COMERCIO DESCONOCIDO  8.00",
  ].join("\n");
  assert.deepEqual(parseEstadoCuenta(texto).map((t) => [t.fecha, t.monto, t.categoriaSugerida]), [
    ["2026-10-13", 12.5, "Ocio"],
    ["2026-10-12", 1234.56, "Salud"],
    ["2026-10-11", 8, "Otros"],
  ]);
});

test("CSV toma la columna de consumo aunque aparezca después de la de proceso", () => {
  const texto = [
    'Fecha proceso;Fecha de consumo;Comercio;Importe',
    '15/10/2026;13/10/2026;"CLÍNICA, DEL VALLE";25,00',
    '15/10/2026;14/10/2026;NETFLIX;9,99',
  ].join("\n");
  assert.deepEqual(parseEstadoCuenta(texto).map((t) => [t.fecha, t.descripcion, t.categoriaSugerida]), [
    ["2026-10-13", "CLÍNICA, DEL VALLE", "Salud"],
    ["2026-10-14", "NETFLIX", "Ocio"],
  ]);
});

test("fechas sin año respetan el corte y descarta fechas imposibles y pagos", () => {
  const texto = [
    "Fecha de corte: 05/01/2027",
    "30/12 CINE 7.50",
    "31/02 FARMACIA 10.00",
    "02/01 PAGO RECIBIDO 20.00",
  ].join("\n");
  const resultado = parseEstadoCuenta(texto);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].fecha, "2026-12-30");
  assert.equal(resultado[1].fecha, "2027-01-02");
  assert.equal(resultado[1].posiblePago, true);
});

test("fechas con el mes en letras, año primero con barra y un número de referencia antes de la fecha", () => {
  const texto = [
    "Fecha de corte: 15-OCT-2026",
    "15-OCT-2026 SUPERMAXI QUITO 12.50",
    "2026/10/14 FYBECA 3,20",
    "00123 13/10/2026 KFC EL BOSQUE 7.80",
    "12 oct. CINEMARK 5.00",
    "10OCT2026 NETFLIX.COM 9.99",
    "05 DIC SPOTIFY 5.99",
    "Total consumos 1.234,56",
  ].join("\n");
  assert.deepEqual(parseEstadoCuenta(texto).map((t) => [t.fecha, t.descripcion, t.monto]), [
    ["2026-10-15", "SUPERMAXI QUITO", 12.5],
    ["2026-10-14", "FYBECA", 3.2],
    ["2026-10-13", "KFC EL BOSQUE", 7.8],
    ["2026-10-12", "CINEMARK", 5],
    ["2026-10-10", "NETFLIX.COM", 9.99],
    // Diciembre en un corte de octubre es del año anterior.
    ["2025-12-05", "SPOTIFY", 5.99],
  ]);
});

test("el monto que quedó solo en la línea de abajo se junta con su fila", () => {
  const texto = ["11/10/2026 UBER TRIP", "6,20", "10/10/2026 SIN MONTO", "Saldo anterior 500,00"].join("\n");
  assert.deepEqual(parseEstadoCuenta(texto).map((t) => [t.fecha, t.descripcion, t.monto]), [
    ["2026-10-11", "UBER TRIP", 6.2],
  ]);
});

test("un número que solo parece fecha no corta la descripción ni inventa movimientos", () => {
  const texto = ["2 MAYORISTA 10.00", "SUPERMAXI 15/10/2026 4.00", "15/10/2026 CUOTA 01/03 ARTEFACTA 30.00"].join("\n");
  assert.deepEqual(parseEstadoCuenta(texto, { fechaReferencia: "2026-10-20" }).map((t) => [t.fecha, t.descripcion, t.monto]), [
    ["2026-10-15", "CUOTA 01/03 ARTEFACTA", 30],
  ]);
});
