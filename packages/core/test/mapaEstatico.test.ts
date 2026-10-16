import { test } from "node:test";
import assert from "node:assert/strict";
import { mapaEstatico, metrosPorPixel, posicionEnTeselas, TAMANO_TESELA } from "../src/lib/mapaEstatico.ts";

test("posicionEnTeselas: el origen y Quito caen en la tesela correcta", () => {
  assert.deepEqual(posicionEnTeselas(0, 0, 1), { x: 1, y: 1 });
  const quito = posicionEnTeselas(-0.18072, -78.46781, 16);
  assert.equal(Math.floor(quito.x), 18483);
  assert.equal(Math.floor(quito.y), 32800);
  // Cerca del ecuador, un píxel a zoom 16 mide unos 2,39 m.
  assert.ok(Math.abs(metrosPorPixel(-0.18072, 16) - 2.3886) < 0.001);
});

test("mapaEstatico: 3×3 teselas alrededor del punto, con el punto en la del centro", () => {
  const m = mapaEstatico({ latitud: -0.18072, longitud: -78.46781, precisionM: 12 });
  assert.equal(m.teselas.length, 9);
  assert.equal(m.teselas[0].url, "https://tile.openstreetmap.org/16/18482/32799.png");
  assert.equal(m.teselas[4].url, "https://tile.openstreetmap.org/16/18483/32800.png");
  assert.deepEqual([m.teselas[8].columna, m.teselas[8].fila], [2, 2]);
  // El punto queda dentro de la tesela central (entre 256 y 512 px).
  assert.ok(m.puntoX >= TAMANO_TESELA && m.puntoX < 2 * TAMANO_TESELA);
  assert.ok(m.puntoY >= TAMANO_TESELA && m.puntoY < 2 * TAMANO_TESELA);
  // 12 m de precisión ≈ 5 px.
  assert.equal(m.radioPrecisionPx, 5);
  assert.equal(mapaEstatico({ latitud: 1, longitud: 2 }).radioPrecisionPx, undefined);
});

test("mapaEstatico: la longitud da la vuelta en 180° y la plantilla se puede cambiar", () => {
  const m = mapaEstatico({ latitud: 0, longitud: 179.999 }, { zoom: 2, plantilla: "https://mapas.test/{z}/{x}/{y}" });
  // Columnas: 2, 3 y, al pasar 180°, 0.
  assert.deepEqual(m.teselas.slice(0, 3).map((t) => t.url), [
    "https://mapas.test/2/2/1",
    "https://mapas.test/2/3/1",
    "https://mapas.test/2/0/1",
  ]);
});
