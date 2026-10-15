import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecibo } from "../src/lib/ocr.ts";

test("parseRecibo: extrae monto latino, fecha y categoría sugerida", () => {
  const texto = "Supermaxi Quito\nFecha 14/10/2026\nTOTAL $1.234,56";

  assert.deepEqual(parseRecibo(texto), {
    monto: 1234.56,
    fecha: "2026-10-14",
    comercio: "Supermaxi Quito",
    categoriaSugerida: "Comida",
    textoCrudo: texto,
  });
});

test("parseRecibo: conserva el monto pero no propone fechas imposibles", () => {
  const recibo = parseRecibo("Restaurante\n31/02/2026\nTOTAL 12,50");

  assert.equal(recibo.monto, 12.5);
  assert.equal(recibo.fecha, undefined);
});

test("parseRecibo: valida años bisiestos en fechas ISO", () => {
  assert.equal(parseRecibo("Cine\n2024-02-29\nTOTAL 8.00").fecha, "2024-02-29");
  assert.equal(parseRecibo("Cine\n2026-02-29\nTOTAL 8.00").fecha, undefined);
});
