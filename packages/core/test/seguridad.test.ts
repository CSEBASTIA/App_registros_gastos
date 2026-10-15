import { test } from "node:test";
import assert from "node:assert/strict";
import { crearFetchConTimeout, ErrorTiempoAgotado } from "../src/lib/fetchConTimeout.ts";
import { fechaLocal, mesLocal, sumarMeses } from "../src/lib/semanas.ts";
import { gastoSchema } from "../src/schemas/gasto.schema.ts";
import { presupuestoSchema } from "../src/schemas/presupuesto.schema.ts";
import { pagoTarjetaSchema } from "../src/schemas/pagoTarjeta.schema.ts";
import { categoriaSchema } from "../src/schemas/categoria.schema.ts";

// --- Timeouts ---------------------------------------------------------

/** fetch falso que nunca responde: solo termina si lo abortan. */
function fetchColgado(_input: unknown, init: { signal: AbortSignal }) {
  return new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("AbortError")));
  });
}

test("fetchConTimeout: corta una petición colgada con un error claro", async () => {
  const fetchSeguro = crearFetchConTimeout({ ms: 50, fetchBase: fetchColgado as any });
  const inicio = Date.now();
  await assert.rejects(fetchSeguro("https://api.ejemplo/rest/v1/gastos"), ErrorTiempoAgotado);
  assert.ok(Date.now() - inicio < 1000, "debería cortar cerca de los 50 ms");
});

test("fetchConTimeout: las subidas a Storage tienen su propio límite (más largo)", async () => {
  const fetchSeguro = crearFetchConTimeout({ ms: 20, msSubidas: 120, fetchBase: fetchColgado as any });
  const inicio = Date.now();
  await assert.rejects(
    fetchSeguro("https://api.ejemplo/storage/v1/object/facturas/u/a.pdf", { method: "POST" }),
    ErrorTiempoAgotado
  );
  assert.ok(Date.now() - inicio >= 100, "una subida no debería cortarse a los 20 ms");
});

test("fetchConTimeout: deja pasar la respuesta si llega a tiempo", async () => {
  const fetchSeguro = crearFetchConTimeout({ ms: 500, fetchBase: async () => ({ ok: true, status: 200 }) });
  const res = await fetchSeguro("https://api.ejemplo/rest/v1/gastos");
  assert.equal(res.status, 200);
});

test("fetchConTimeout: respeta la cancelación de quien llama (no la disfraza de timeout)", async () => {
  const fetchSeguro = crearFetchConTimeout({ ms: 5_000, fetchBase: fetchColgado as any });
  const controlador = new AbortController();
  const promesa = fetchSeguro("https://api.ejemplo/rest/v1/gastos", { signal: controlador.signal });
  controlador.abort();
  await assert.rejects(promesa, (err: Error) => !(err instanceof ErrorTiempoAgotado));
});

// --- Fechas locales (bug de UTC) ----------------------------------------

test("fechaLocal: 21:30 del 13 de octubre sigue siendo el 13 (no el 14 en UTC)", () => {
  const nocheLocal = new Date(2026, 9, 13, 21, 30);
  assert.equal(fechaLocal(nocheLocal), "2026-10-13");
  assert.equal(mesLocal(new Date(2026, 9, 31, 23, 59)), "2026-10");
});

test("sumarMeses: cruza de año sin desfasar el día", () => {
  assert.equal(sumarMeses("2026-11-15", 2), "2027-01-15");
  // Antes JS desbordaba febrero al 3 de marzo; ahora se queda en el último día, como la base.
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
});

// --- Validación de entrada (primera barrera antes de la base) -----------

const gastoValido = {
  monto: 12.5,
  descripcion: "Almuerzo",
  categoriaId: "3f1c2a1e-1111-4222-8333-444455556666",
  fecha: "2026-10-13",
};

test("gastoSchema: acepta un gasto válido y recorta espacios", () => {
  const r = gastoSchema.parse({ ...gastoValido, descripcion: "  Almuerzo  " });
  assert.equal(r.descripcion, "Almuerzo");
});

test("gastoSchema: rechaza textos vacíos, larguísimos, montos absurdos y fechas imposibles", () => {
  const casos = [
    { descripcion: "   " },
    { descripcion: "x".repeat(201) },
    { monto: 0 },
    { monto: -5 },
    { monto: Number.POSITIVE_INFINITY },
    { monto: Number.NaN },
    { monto: 1e13 },
    { fecha: "2026-13-01" },
    { fecha: "2026-02-30" },
    { fecha: "13/10/2026" },
    { categoriaId: "1 OR 1=1" },
  ];
  for (const caso of casos) {
    assert.equal(gastoSchema.safeParse({ ...gastoValido, ...caso }).success, false, JSON.stringify(caso));
  }
});

test("gastoSchema: un texto con SQL es solo texto (se valida, no se interpreta)", () => {
  const r = gastoSchema.parse({ ...gastoValido, descripcion: "'); DROP TABLE gastos; --" });
  assert.equal(r.descripcion, "'); DROP TABLE gastos; --");
});

test("presupuestoSchema: mes YYYY-MM válido y límite positivo", () => {
  const base = { categoriaId: gastoValido.categoriaId, montoLimite: 100, mes: "2026-10" };
  assert.equal(presupuestoSchema.safeParse(base).success, true);
  assert.equal(presupuestoSchema.safeParse({ ...base, mes: "2026-13" }).success, false);
  assert.equal(presupuestoSchema.safeParse({ ...base, mes: "2026-1" }).success, false);
  assert.equal(presupuestoSchema.safeParse({ ...base, montoLimite: 0 }).success, false);
});

test("pagoTarjetaSchema: acepta pagos válidos y rechaza referencias o importes inválidos", () => {
  const id = gastoValido.categoriaId;
  const otraCuenta = "8f1c2a1e-1111-4222-8333-444455556666";
  const pagoValido = { cuentaId: id, cuentaOrigenId: otraCuenta, monto: 10, fecha: "2026-10-13" };

  assert.equal(pagoTarjetaSchema.safeParse(pagoValido).success, true);
  assert.equal(
    pagoTarjetaSchema.safeParse({ cuentaId: id, monto: 10, fecha: "2026-10-13" }).success,
    true
  );
  assert.equal(
    pagoTarjetaSchema.safeParse({ ...pagoValido, cuentaOrigenId: id }).success,
    false
  );
  assert.equal(pagoTarjetaSchema.safeParse({ ...pagoValido, cuentaId: "no-es-uuid" }).success, false);
  assert.equal(pagoTarjetaSchema.safeParse({ ...pagoValido, monto: 0 }).success, false);
  assert.equal(pagoTarjetaSchema.safeParse({ ...pagoValido, monto: -10 }).success, false);
  assert.equal(pagoTarjetaSchema.safeParse({ ...pagoValido, fecha: "2026-02-30" }).success, false);
  assert.equal(pagoTarjetaSchema.safeParse({ ...pagoValido, fecha: "13/10/2026" }).success, false);
});

test("categoriaSchema: color solo en formato #RRGGBB", () => {
  assert.equal(categoriaSchema.safeParse({ nombre: "Mascotas", tipo: "gasto", color: "#aa5500" }).success, true);
  assert.equal(
    categoriaSchema.safeParse({ nombre: "Mascotas", tipo: "gasto", color: "red;background:url(x)" }).success,
    false
  );
});

test("abonoDeudaSchema: monto positivo, ids UUID y fecha válida", async () => {
  const { abonoDeudaSchema } = await import("../src/schemas/deuda.schema.ts");
  const id = gastoValido.categoriaId;
  const base = { deudaId: id, monto: 50, fecha: "2026-10-14" };
  assert.equal(abonoDeudaSchema.safeParse(base).success, true);
  assert.equal(abonoDeudaSchema.safeParse({ ...base, cuentaId: id }).success, true);
  assert.equal(abonoDeudaSchema.safeParse({ ...base, monto: 0 }).success, false);
  assert.equal(abonoDeudaSchema.safeParse({ ...base, monto: -10 }).success, false);
  assert.equal(abonoDeudaSchema.safeParse({ ...base, deudaId: "x' or '1'='1" }).success, false);
  assert.equal(abonoDeudaSchema.safeParse({ ...base, fecha: "2026-02-30x" }).success, false);
});

test("mensajeError: los fallos de red se muestran en lenguaje claro", async () => {
  const { mensajeError, MENSAJE_SIN_CONEXION } = await import("../src/lib/mensajeError.ts");
  assert.equal(mensajeError(new TypeError("Failed to fetch")), MENSAJE_SIN_CONEXION);
  assert.equal(mensajeError(new TypeError("Network request failed")), MENSAJE_SIN_CONEXION);
  assert.equal(mensajeError(new TypeError("Load failed")), MENSAJE_SIN_CONEXION);
  assert.equal(mensajeError(new Error("La cuenta indicada no existe o no es tuya.")), "La cuenta indicada no existe o no es tuya.");
  assert.equal(mensajeError({ message: "TypeError: Failed to fetch" }), MENSAJE_SIN_CONEXION); // forma en que lo envuelve Supabase
  assert.equal(mensajeError({ message: "duplicate key" }), "duplicate key");
});

test("cambiosIngresoSchema: valida solo lo enviado, null quita y vacío se rechaza", async () => {
  const { cambiosIngresoSchema } = await import("../src/schemas/ingreso.schema.ts");
  const id = gastoValido.categoriaId;
  assert.equal(cambiosIngresoSchema.safeParse({ monto: 120 }).success, true);
  assert.equal(cambiosIngresoSchema.safeParse({ cuentaId: null }).success, true);
  assert.equal(cambiosIngresoSchema.safeParse({ cuentaId: id, fecha: "2026-10-15" }).success, true);
  assert.equal(cambiosIngresoSchema.safeParse({}).success, false); // nada que guardar
  assert.equal(cambiosIngresoSchema.safeParse({ monto: 0 }).success, false);
  assert.equal(cambiosIngresoSchema.safeParse({ descripcion: "   " }).success, false);
  assert.equal(cambiosIngresoSchema.safeParse({ cuentaId: "otra-cuenta" }).success, false);
});
