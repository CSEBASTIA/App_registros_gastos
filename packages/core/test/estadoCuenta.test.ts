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
