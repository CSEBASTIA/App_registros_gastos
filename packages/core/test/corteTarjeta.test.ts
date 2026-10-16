import { test } from "node:test";
import assert from "node:assert/strict";
import { cicloTarjeta, corteDeGasto, fechaDelDia, pagoDeCorte, textoDias } from "../src/lib/corteTarjeta.ts";
import { esCasaComercial, inicialesDeEntidad, OPCIONES_CASA_COMERCIAL, ETIQUETA_BANCO, GRADIENTE_BANCO } from "../src/lib/marcas.ts";
import { cuentaSchema, fechasTarjetaSchema } from "../src/schemas/cuenta.schema.ts";
import { setSupabaseClient } from "../src/client.ts";
import { actualizarFechasTarjeta } from "../src/repositories/cuentas.repo.ts";

test("fechaDelDia: un día 31 en un mes corto es el último día (y febrero bisiesto)", () => {
  assert.equal(fechaDelDia(2026, 11, 31), "2026-11-30");
  assert.equal(fechaDelDia(2026, 2, 30), "2026-02-28");
  assert.equal(fechaDelDia(2028, 2, 30), "2028-02-29");
  assert.equal(fechaDelDia(2026, 13, 5), "2027-01-05");
  assert.equal(fechaDelDia(2026, 0, 5), "2025-12-05");
});

test("corteDeGasto: hasta el día de corte entra en ese mes; después, en el siguiente", () => {
  assert.equal(corteDeGasto("2026-10-10", 15), "2026-10-15");
  assert.equal(corteDeGasto("2026-10-15", 15), "2026-10-15");
  assert.equal(corteDeGasto("2026-10-16", 15), "2026-11-15");
  assert.equal(corteDeGasto("2026-12-20", 15), "2027-01-15");
  // Corte el 31: en noviembre corta el 30.
  assert.equal(corteDeGasto("2026-11-30", 31), "2026-11-30");
  assert.equal(corteDeGasto("2026-12-01", 31), "2026-12-31");
});

test("pagoDeCorte: el primer día de pago después del corte", () => {
  assert.equal(pagoDeCorte("2026-10-15", 30), "2026-10-30");
  assert.equal(pagoDeCorte("2026-10-25", 10), "2026-11-10");
  assert.equal(pagoDeCorte("2026-01-28", 30), "2026-01-30");
  assert.equal(pagoDeCorte("2026-01-31", 30), "2026-02-28");
});

test("cicloTarjeta: corte, inicio del ciclo, pago y días que faltan", () => {
  assert.deepEqual(cicloTarjeta(15, "2026-10-11", 30), {
    corte: "2026-10-15",
    diasHastaCorte: 4,
    inicio: "2026-09-16",
    pago: "2026-10-30",
    diasHastaPago: 19,
  });
  // Al día siguiente del corte empieza un ciclo nuevo.
  const despues = cicloTarjeta(15, "2026-10-16");
  assert.deepEqual(despues, { corte: "2026-11-15", diasHastaCorte: 30, inicio: "2026-10-16" });
  assert.equal(cicloTarjeta(15, "2026-10-15").diasHastaCorte, 0);
  assert.equal(textoDias(0), "hoy");
  assert.equal(textoDias(1), "mañana");
  assert.equal(textoDias(4), "en 4 días");
});

test("casas comerciales: etiquetas, colores e iniciales para el ícono sin logo", () => {
  assert.equal(OPCIONES_CASA_COMERCIAL.length, 8);
  for (const casa of OPCIONES_CASA_COMERCIAL) {
    assert.ok(ETIQUETA_BANCO[casa]);
    assert.equal(GRADIENTE_BANCO[casa].length, 2);
    assert.ok(esCasaComercial(casa));
  }
  assert.equal(esCasaComercial("produbanco"), false);
  assert.equal(inicialesDeEntidad("comandato"), "C");
  assert.equal(inicialesDeEntidad("la_ganga"), "LG");
  assert.equal(inicialesDeEntidad("de_prati"), "DP");
  assert.equal(inicialesDeEntidad("creditos_economicos"), "CE");
  assert.equal(inicialesDeEntidad("otra_casa_comercial"), "CC");
  assert.equal(inicialesDeEntidad("banco_pacifico"), "P");
});

const base = { nombre: "Crédito Comandato", tipo: "credito" as const, banco: "comandato", cupoTotal: 1500, disponible: 1500 };

test("cuentaSchema: casa comercial solo como crédito; días de corte y pago de 1 a 31 y solo en crédito", () => {
  assert.equal(cuentaSchema.safeParse({ ...base, diaCorte: 15, diaPago: 30 }).success, true);
  assert.equal(cuentaSchema.safeParse({ ...base, tipo: "ahorro", cupoTotal: undefined }).success, false);
  assert.equal(cuentaSchema.safeParse({ ...base, diaCorte: 0 }).success, false);
  assert.equal(cuentaSchema.safeParse({ ...base, diaCorte: 32 }).success, false);
  assert.equal(cuentaSchema.safeParse({ ...base, diaCorte: 15.5 }).success, false);
  assert.equal(
    cuentaSchema.safeParse({ nombre: "Ahorro", tipo: "ahorro", banco: "pichincha", disponible: 10, diaCorte: 15 }).success,
    false
  );
  assert.equal(cuentaSchema.safeParse({ ...base, banco: "tienda_inventada" }).success, false);
  assert.equal(fechasTarjetaSchema.safeParse({ diaCorte: null, diaPago: 5 }).success, true);
});

test("actualizarFechasTarjeta: valida antes de ir a la red y envía solo lo indicado", async () => {
  const enviado: unknown[] = [];
  setSupabaseClient({
    from: () => ({
      update: (d: unknown) => (
        enviado.push(d),
        { eq: () => ({ select: () => ({ single: async () => ({ data: { id: "1", nombre: "x", tipo: "credito", banco: "comandato", marca: null, estilo: null, cupo_total: 100, identificador: null, dia_corte: 15, dia_pago: null, disponible: 100, created_at: "" }, error: null }) }) }) }
      ),
    }),
  } as any);
  const c = await actualizarFechasTarjeta("1", { diaCorte: 15, diaPago: null });
  assert.deepEqual(enviado, [{ dia_corte: 15, dia_pago: null }]);
  assert.equal(c.diaCorte, 15);
  assert.equal(c.diaPago, undefined);
  await assert.rejects(actualizarFechasTarjeta("1", { diaCorte: 40 }));
  assert.equal(enviado.length, 1);
});
