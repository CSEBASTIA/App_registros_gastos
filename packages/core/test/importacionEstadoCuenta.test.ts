import { test } from "node:test";
import assert from "node:assert/strict";
import { lineasDeTextoPdf, paginaSinTexto, parseEstadoCuenta, type TransaccionEstadoCuenta } from "../src/lib/estadoCuenta.ts";
import {
  cupoInsuficiente,
  movimientosParaGuardar,
  prepararFilasImportacion,
  rangoDeFilas,
  resumenImportacion,
  textoResultadoImportacion,
  TOPE_FILAS_IMPORTACION,
} from "../src/lib/importacionEstadoCuenta.ts";
import { ErrorImportacionParcial, importarMovimientos } from "../src/usecases/importarEstadoCuenta.ts";
import { setSupabaseClient } from "../src/client.ts";

const CUENTA = "11111111-1111-4111-8111-111111111111";
const OCIO = "22222222-2222-4222-8222-222222222222";
const SALUD = "33333333-3333-4333-8333-333333333333";
const OTROS = "44444444-4444-4444-8444-444444444444";
const OTROS_INGRESO = "55555555-5555-4555-8555-555555555555";
const CATEGORIAS = [
  { id: OCIO, nombre: "Ocio", tipo: "gasto" as const },
  { id: SALUD, nombre: "Salud", tipo: "gasto" as const },
  { id: OTROS_INGRESO, nombre: "Otros", tipo: "ingreso" as const },
  { id: OTROS, nombre: "Otros", tipo: "gasto" as const },
];

function tx(fecha: string, descripcion: string, monto: number, extra: Partial<TransaccionEstadoCuenta> = {}): TransaccionEstadoCuenta {
  return { fecha, descripcion, monto, categoriaSugerida: "Otros", posiblePago: false, ...extra };
}

/** Una cuenta como la devuelve la base (`listarCuentas` la lee justo antes de guardar). */
function filaCuenta(tipo: string, disponible: number, nombre = "Visa") {
  return { id: CUENTA, nombre, tipo, banco: "pichincha", marca: null, estilo: null, cupo_total: tipo === "credito" ? 1000 : null, identificador: null, dia_corte: null, dia_pago: null, disponible, created_at: "2026-10-01T00:00:00Z" };
}

/**
 * Cliente falso: anota cada insert y devuelve las filas como si la base las
 * guardara (o falla en `tablaQueFalla`); `cuentas` es lo que lee listarCuentas.
 */
function clienteFalso(tablaQueFalla?: string, cuentas: unknown[] = [filaCuenta("ahorro", 0)]) {
  const inserts: { tabla: string; filas: any[] }[] = [];
  setSupabaseClient({
    from: (tabla: string) => ({
      select: () => ({ order: () => Promise.resolve({ data: tabla === "cuentas" ? cuentas : [], error: null }) }),
      insert(filas: any[]) {
        inserts.push({ tabla, filas });
        return {
          select: () =>
            Promise.resolve(
              tabla === tablaQueFalla
                ? { data: null, error: { message: "sin conexión con la base" } }
                : { data: filas.map((f, i) => ({ ...f, id: `id-${i}`, created_at: "2026-10-17T00:00:00Z" })), error: null }
            ),
        };
      },
    }),
  } as any);
  return inserts;
}

// --- Filas a revisar -------------------------------------------------------

test("prepararFilasImportacion: en tarjeta omite los pagos y propone los consumos marcados", () => {
  const { filas, pagosOmitidos, truncado } = prepararFilasImportacion(
    [tx("2026-10-02", "SUPERMAXI", 45.3), tx("2026-10-05", "PAGO RECIBIDO", 200, { posiblePago: true }), tx("2026-10-06", "CINEMARK", 12.5, { categoriaSugerida: "Ocio" })],
    "credito"
  );
  assert.equal(pagosOmitidos, 1);
  assert.equal(truncado, false);
  assert.deepEqual(filas.map((f) => [f.descripcion, f.tipo, f.seleccionada]), [
    ["SUPERMAXI", "gasto", true],
    ["CINEMARK", "gasto", true],
  ]);
  assert.deepEqual(filas.map((f) => f.id), [0, 1]);
});

test("prepararFilasImportacion: en ahorro un abono es ingreso pero sale sin marcar", () => {
  const { filas, pagosOmitidos } = prepararFilasImportacion([tx("2026-10-01", "ABONO NOMINA", 800, { posiblePago: true })], "ahorro");
  assert.equal(pagosOmitidos, 0);
  assert.equal(filas[0].tipo, "ingreso");
  assert.equal(filas[0].seleccionada, false);
});

test("prepararFilasImportacion: marca posibles duplicados uno a uno (fecha + monto en centavos)", () => {
  const { filas } = prepararFilasImportacion(
    [tx("2026-10-03", "CAFE", 2.5), tx("2026-10-03", "CAFE", 2.5), tx("2026-10-04", "FARMACIA", 10)],
    "debito",
    // Un solo café ya registrado (con error de coma flotante incluido) y la farmacia en otra fecha.
    { gastos: [{ fecha: "2026-10-03", monto: 2.4999999 }, { fecha: "2026-10-05", monto: 10 }], ingresos: [] }
  );
  assert.deepEqual(filas.map((f) => [f.posibleDuplicado, f.seleccionada]), [
    [true, false],
    [false, true],
    [false, true],
  ]);
});

test("prepararFilasImportacion: un ingreso registrado no hace duplicado a un gasto igual", () => {
  const { filas } = prepararFilasImportacion([tx("2026-10-03", "TRANSFERENCIA", 50)], "ahorro", {
    gastos: [],
    ingresos: [{ fecha: "2026-10-03", monto: 50 }],
  });
  assert.equal(filas[0].posibleDuplicado, false);
});

test("prepararFilasImportacion: corta en el tope y lo avisa", () => {
  const muchas = Array.from({ length: TOPE_FILAS_IMPORTACION + 5 }, (_, i) => tx("2026-10-01", `COMPRA ${i}`, 1));
  const { filas, truncado } = prepararFilasImportacion(muchas, "credito");
  assert.equal(filas.length, TOPE_FILAS_IMPORTACION);
  assert.equal(truncado, true);
});

test("rangoDeFilas: primera y última fecha, o nada si no hay filas", () => {
  assert.deepEqual(rangoDeFilas([{ fecha: "2026-10-09" }, { fecha: "2026-09-28" }, { fecha: "2026-10-01" }]), {
    desde: "2026-09-28",
    hasta: "2026-10-09",
  });
  assert.equal(rangoDeFilas([]), undefined);
});

// --- Resumen y saldo ---------------------------------------------------------

test("resumenImportacion: resta los gastos y suma los ingresos sin errores de coma flotante", () => {
  const { filas } = prepararFilasImportacion(
    [tx("2026-10-01", "A", 0.1), tx("2026-10-01", "B", 0.2), tx("2026-10-02", "SUELDO", 100.3, { posiblePago: true })],
    "ahorro"
  );
  filas[2].seleccionada = true;
  assert.deepEqual(resumenImportacion(filas, { tipo: "ahorro", disponible: 50 }), {
    gastos: 2,
    totalGastos: 0.3,
    ingresos: 1,
    totalIngresos: 100.3,
    disponibleDespues: 150,
  });
});

test("resumenImportacion: en tarjeta baja el cupo disponible y no cuenta ingresos", () => {
  const { filas } = prepararFilasImportacion([tx("2026-10-01", "SUPERMAXI", 45.3)], "credito");
  const r = resumenImportacion(filas, { tipo: "credito", disponible: 1000 });
  assert.equal(r.disponibleDespues, 954.7);
  assert.equal(r.ingresos, 0);
});

// --- Qué se envía a la base --------------------------------------------------

test("movimientosParaGuardar: categoría sugerida o «Otros» de gastos, método según la cuenta", () => {
  const { filas } = prepararFilasImportacion(
    [
      tx("2026-10-01", "CINEMARK", 12.5, { categoriaSugerida: "Ocio" }),
      tx("2026-10-02", "FYBECA", 8, { categoriaSugerida: "Salud" }),
      tx("2026-10-03", "TIENDA", 3),
    ],
    "credito"
  );
  const { gastos, ingresos } = movimientosParaGuardar(filas, { id: CUENTA, tipo: "credito" }, CATEGORIAS);
  assert.deepEqual(gastos.map((g) => g.categoriaId), [OCIO, SALUD, OTROS]); // nunca el «Otros» de ingresos
  assert.ok(gastos.every((g) => g.cuentaId === CUENTA && g.metodoPago === "credito"));
  assert.deepEqual(ingresos, []);
});

test("movimientosParaGuardar: solo lo marcado; en ahorro sin método y con ingresos", () => {
  const { filas } = prepararFilasImportacion(
    [tx("2026-10-01", "RETIRO", 20), tx("2026-10-02", "DEPOSITO", 300, { posiblePago: true }), tx("2026-10-03", "OTRO", 5)],
    "ahorro"
  );
  filas[1].seleccionada = true;
  filas[2].seleccionada = false;
  const { gastos, ingresos } = movimientosParaGuardar(filas, { id: CUENTA, tipo: "ahorro" }, CATEGORIAS);
  assert.deepEqual(gastos.map((g) => [g.descripcion, g.metodoPago]), [["RETIRO", undefined]]);
  assert.deepEqual(ingresos, [{ monto: 300, descripcion: "DEPOSITO", cuentaId: CUENTA, fecha: "2026-10-02" }]);
});

test("movimientosParaGuardar: sin categoría «Otros» de gastos avisa en vez de guardar a medias", () => {
  const { filas } = prepararFilasImportacion([tx("2026-10-01", "TIENDA", 3)], "debito");
  assert.throws(
    () => movimientosParaGuardar(filas, { id: CUENTA, tipo: "debito" }, [{ id: OTROS_INGRESO, nombre: "Otros", tipo: "ingreso" }]),
    /Falta la categoría «Otros»/
  );
});

// --- Guardado ----------------------------------------------------------------

test("importarMovimientos: una sola escritura por tabla y cuenta lo guardado", async () => {
  const inserts = clienteFalso();
  const { filas } = prepararFilasImportacion(
    [tx("2026-10-01", "A", 1), tx("2026-10-02", "B", 2), tx("2026-10-03", "ABONO", 3, { posiblePago: true })],
    "ahorro"
  );
  filas[2].seleccionada = true;
  const r = await importarMovimientos(movimientosParaGuardar(filas, { id: CUENTA, tipo: "ahorro" }, CATEGORIAS));
  assert.deepEqual(r, { gastos: 2, ingresos: 1 });
  assert.deepEqual(inserts.map((i) => [i.tabla, i.filas.length]), [["gastos", 2], ["ingresos", 1]]);
  assert.equal(inserts[0].filas[0].cuenta_id, CUENTA);
  assert.equal(inserts[0].filas[0].categoria_id, OTROS);
});

test("importarMovimientos: si una fila es inválida no se guarda nada", async () => {
  const inserts = clienteFalso();
  await assert.rejects(
    importarMovimientos({
      gastos: [
        { monto: 5, descripcion: "BIEN", categoriaId: OTROS, cuentaId: CUENTA, fecha: "2026-10-01" },
        { monto: 5, descripcion: "MAL", categoriaId: OTROS, cuentaId: CUENTA, fecha: "2026-02-30" },
      ],
      ingresos: [],
    }),
    /Revisa «MAL»/
  );
  assert.equal(inserts.length, 0);
});

test("importarMovimientos: si fallan los ingresos avisa que los gastos sí quedaron", async () => {
  clienteFalso("ingresos");
  await assert.rejects(
    importarMovimientos({
      gastos: [{ monto: 5, descripcion: "A", categoriaId: OTROS, cuentaId: CUENTA, fecha: "2026-10-01" }],
      ingresos: [{ monto: 9, descripcion: "B", cuentaId: CUENTA, fecha: "2026-10-01" }],
    }),
    (err: unknown) => err instanceof ErrorImportacionParcial && err.gastosGuardados === 1 && /solo se enviarán los ingresos/.test(err.message)
  );
});

test("importarMovimientos: nada elegido o demasiadas filas se rechazan antes de ir a la base", async () => {
  const inserts = clienteFalso();
  await assert.rejects(importarMovimientos({ gastos: [], ingresos: [] }), /al menos un movimiento/);
  const muchos = Array.from({ length: TOPE_FILAS_IMPORTACION + 1 }, () => ({
    monto: 1,
    descripcion: "X",
    categoriaId: OTROS,
    cuentaId: CUENTA,
    fecha: "2026-10-01",
  }));
  await assert.rejects(importarMovimientos({ gastos: muchos, ingresos: [] }), /máximo por importación/);
  assert.equal(inserts.length, 0);
});

test("cupoInsuficiente: avisa si los gastos a una tarjeta pasan su cupo (sumando en centavos)", () => {
  const visa = { id: CUENTA, nombre: "Visa", tipo: "credito" as const, disponible: 0.3 };
  assert.equal(cupoInsuficiente([{ monto: 0.1, cuentaId: CUENTA }, { monto: 0.2, cuentaId: CUENTA }], [visa]), undefined);
  assert.match(
    cupoInsuficiente([{ monto: 0.2, cuentaId: CUENTA }, { monto: 0.2, cuentaId: CUENTA }], [visa]) ?? "",
    /suman \$0\.40 y el cupo disponible de «Visa» es \$0\.30/
  );
  // En ahorro no hay cupo: puede quedar en negativo, como al registrar a mano.
  assert.equal(cupoInsuficiente([{ monto: 50, cuentaId: CUENTA }], [{ ...visa, tipo: "ahorro" }]), undefined);
  assert.equal(cupoInsuficiente([{ monto: 50 }], [visa]), undefined);
});

test("importarMovimientos: si el lote pasa el cupo de la tarjeta no guarda nada", async () => {
  const inserts = clienteFalso(undefined, [filaCuenta("credito", 100)]);
  await assert.rejects(
    importarMovimientos({
      gastos: [
        { monto: 60, descripcion: "A", categoriaId: OTROS, cuentaId: CUENTA, metodoPago: "credito", fecha: "2026-10-01" },
        { monto: 60, descripcion: "B", categoriaId: OTROS, cuentaId: CUENTA, metodoPago: "credito", fecha: "2026-10-02" },
      ],
      ingresos: [],
    }),
    /suman \$120\.00 y el cupo disponible de «Visa» es \$100\.00/
  );
  assert.equal(inserts.length, 0);
});

test("textoResultadoImportacion: singular, plural y nada", () => {
  assert.equal(textoResultadoImportacion({ gastos: 1, ingresos: 0 }), "Se importaron 1 gasto.");
  assert.equal(textoResultadoImportacion({ gastos: 3, ingresos: 2 }), "Se importaron 3 gastos y 2 ingresos.");
  assert.equal(textoResultadoImportacion({ gastos: 0, ingresos: 0 }), "No se importó ningún movimiento.");
});

// --- Texto de PDF --------------------------------------------------------------

test("lineasDeTextoPdf: arma líneas por altura (tolerancia 2,5 pt) y las ordena por X, de arriba a abajo", () => {
  const lineas = lineasDeTextoPdf([
    { texto: "45,30", x: 400, y: 700.4 },
    { texto: "02/10/2026", x: 50, y: 700 },
    { texto: "SUPERMAXI", x: 150, y: 699.8 },
    { texto: "03/10/2026 CINEMARK 12,50", x: 50, y: 680 },
    { texto: "   ", x: 10, y: 660 },
  ]);
  assert.deepEqual(lineas, ["02/10/2026 SUPERMAXI 45,30", "03/10/2026 CINEMARK 12,50"]);
  // Y el resultado lo entiende el lector de estados de cuenta.
  assert.deepEqual(parseEstadoCuenta(lineas.join("\n")).map((t) => [t.fecha, t.descripcion, t.monto]), [
    ["2026-10-02", "SUPERMAXI", 45.3],
    ["2026-10-03", "CINEMARK", 12.5],
  ]);
});


test("lineasDeTextoPdf: una fila con alturas casi iguales (700,9 y 701,1) no se parte en dos", () => {
  // Con el redondeo de antes, 700,9 y 701,1 caían en líneas distintas: la
  // fecha quedaba sin monto y el estado de cuenta salía sin movimientos.
  const lineas = lineasDeTextoPdf([
    { texto: "02/10/2026", x: 50, y: 700.9 },
    { texto: "SUPERMAXI", x: 150, y: 700.9 },
    { texto: "45,30", x: 400, y: 701.1 },
    { texto: "03/10/2026", x: 50, y: 688.0 },
    { texto: "FYBECA", x: 150, y: 687.2 },
    { texto: "8,00", x: 400, y: 689.4 },
  ]);
  assert.deepEqual(lineas, ["02/10/2026 SUPERMAXI 45,30", "03/10/2026 FYBECA 8,00"]);
});
test("paginaSinTexto: una página escaneada casi no trae texto", () => {
  assert.equal(paginaSinTexto([{ texto: " " }, { texto: "1" }]), true);
  assert.equal(paginaSinTexto([{ texto: "02/10/2026 SUPERMAXI 45,30" }]), false);
});
