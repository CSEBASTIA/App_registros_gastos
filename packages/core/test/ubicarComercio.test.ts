import { test } from "node:test";
import assert from "node:assert/strict";
import { comercioMasCercano, nombreParaBuscar, urlBusquedaComercio } from "../src/lib/ubicarComercio.ts";

const GUAYAQUIL = { latitud: -2.1894, longitud: -79.8891 };

test("nombreParaBuscar: quita la razón social y los números de local", () => {
  assert.equal(nombreParaBuscar("TIENDA PRUEBA S A"), "TIENDA PRUEBA");
  assert.equal(nombreParaBuscar("CORPORACION FAVORITA C.A."), "CORPORACION FAVORITA");
  assert.equal(nombreParaBuscar("AKI TARQUI"), "AKI TARQUI");
  assert.equal(nombreParaBuscar("Tienda 12"), "Tienda");
  assert.equal(nombreParaBuscar("12345"), undefined);
});

test("urlBusquedaComercio: solo Ecuador, cerca del teléfono y sin la posición exacta", () => {
  const url = new URL(urlBusquedaComercio("AKI TARQUI", { latitud: -2.189437, longitud: -79.889123 }));
  assert.equal(url.hostname, "nominatim.openstreetmap.org");
  assert.equal(url.searchParams.get("q"), "AKI TARQUI");
  assert.equal(url.searchParams.get("countrycodes"), "ec");
  assert.equal(url.searchParams.get("bounded"), "1");
  assert.equal(url.searchParams.get("viewbox"), "-80.14,-1.94,-79.64,-2.44", "con 2 decimales, no la posición exacta");
});

test("comercioMasCercano: el más cercano dentro de 15 km; ignora lo lejano y lo mal formado", () => {
  const r = comercioMasCercano(
    [
      { lat: "-2.1500", lon: "-79.9000", display_name: "Aki, Av. Lejana, Guayaquil" },
      { lat: "-2.1900", lon: "-79.8900", display_name: "Aki, Tarqui, Guayaquil, Guayas, Ecuador" },
      { lat: "-0.2200", lon: "-78.5100", display_name: "Aki, Quito" },
      { lat: "x", lon: "-79.89", display_name: "roto" },
      { lat: "-2.19", lon: "-79.89" },
    ],
    GUAYAQUIL
  );
  assert.equal(r?.direccion, "Aki, Tarqui, Guayaquil, Guayas, Ecuador");
  assert.ok(r!.distanciaKm < 1);
  assert.equal(comercioMasCercano([{ lat: "-0.22", lon: "-78.51", display_name: "Quito" }], GUAYAQUIL), undefined);
  assert.equal(comercioMasCercano({ error: "x" }, GUAYAQUIL), undefined);
});
