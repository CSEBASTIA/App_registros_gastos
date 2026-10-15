import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearMonto, sumarMontos } from "../src/lib/montos.ts";
import { mensajeError, MENSAJE_SIN_CONEXION } from "../src/lib/mensajeError.ts";
import { balanceGeneral } from "../src/usecases/balanceGeneral.ts";
import { estadoPresupuestos } from "../src/usecases/estadoPresupuestos.ts";
import { generarRecomendaciones } from "../src/usecases/generarRecomendaciones.ts";
import { calcularEndeudamiento } from "../src/usecases/calcularEndeudamiento.ts";
import { parsearCorreoBancario } from "../src/lib/correoBancario.ts";
import { etiquetaFecha, movimientosDe } from "../src/lib/movimientosCuenta.ts";
import { siguienteFechaRecurrente, sumarMeses } from "../src/lib/semanas.ts";
import { crearFetchConTimeout, ErrorTiempoAgotado } from "../src/lib/fetchConTimeout.ts";
import { cambiosGastoSchema, gastoSchema } from "../src/schemas/gasto.schema.ts";
import { setSupabaseClient } from "../src/client.ts";
import {
  avisoGuardable,
  insertarTransaccionesDetectadas,
  marcarTransaccionDetectada,
} from "../src/repositories/transaccionesDetectadas.repo.ts";
import { actualizarGasto, crearGasto } from "../src/repositories/gastos.repo.ts";
import { completarRecordatorio } from "../src/repositories/recordatorios.repo.ts";
import type { AbonoDeuda, Categoria, Gasto, Ingreso, PagoTarjeta, Recordatorio } from "../src/types/domain.ts";

const UUID = "11111111-1111-4111-8111-111111111111";

/** Cliente de Supabase falso: anota cada escritura y responde `fila`. */
function clienteFalso(fila: Record<string, unknown> = {}) {
  const escrituras: { tabla: string; metodo: "update" | "upsert" | "insert"; datos: any }[] = [];
  const desde = (tabla: string) => {
    const consulta: any = {
      update(datos: unknown) {
        escrituras.push({ tabla, metodo: "update", datos });
        return consulta;
      },
      upsert(datos: unknown) {
        escrituras.push({ tabla, metodo: "upsert", datos });
        return consulta;
      },
      insert(datos: unknown) {
        escrituras.push({ tabla, metodo: "insert", datos });
        return consulta;
      },
      eq: () => consulta,
      select: () => consulta,
      single: () => consulta,
      then: (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve({ data: fila, error: null }).then(ok, mal),
    };
    return consulta;
  };
  setSupabaseClient({ from: desde } as any);
  return escrituras;
}

// --- Montos -------------------------------------------------------------

test("parsearMonto: entiende la coma decimal de Ecuador y los separadores de miles", () => {
  assert.equal(parsearMonto("12,50"), 12.5);
  assert.equal(parsearMonto("12.50"), 12.5);
  assert.equal(parsearMonto("1.234,56"), 1234.56);
  assert.equal(parsearMonto("1,234.56"), 1234.56);
  assert.equal(parsearMonto("$ 1 234,5"), 1234.5);
  assert.equal(parsearMonto("USD 25"), 25);
  assert.equal(parsearMonto("1.234"), 1234);
  assert.equal(parsearMonto("12.345.678"), 12345678);
  assert.equal(parsearMonto("10,006"), 10006); // agrupación de miles válida
  assert.equal(parsearMonto("0,005"), 0.01); // decimal, no "5"
  assert.equal(parsearMonto("1234.567"), 1234.57); // "1234" no es agrupación de miles
});

test("parsearMonto: devuelve NaN para lo que no es un número", () => {
  for (const texto of ["", "abc", "12,", "1,,5", "12a", "--5", "$"]) {
    assert.ok(Number.isNaN(parsearMonto(texto)), `"${texto}" debería ser NaN`);
  }
});

test("sumarMontos: suma en centavos, sin errores de coma flotante", () => {
  assert.equal(sumarMontos([0.1, 0.2]), 0.3);
  assert.equal(sumarMontos([100.3, -50.1, -50.2]), 0);
  assert.equal(sumarMontos([]), 0);
});

test("balanceGeneral: 100,30 − 50,10 − 50,20 da 0 exacto (antes: −$0.00)", () => {
  const gastos = [50.1, 50.2].map((monto, i) => ({ id: `g${i}`, monto, descripcion: "", categoriaId: "c", fecha: "2026-10-01", createdAt: "" }));
  const ingresos = [{ id: "i", monto: 100.3, descripcion: "", fecha: "2026-10-01", createdAt: "" }];
  const resultado = balanceGeneral(gastos, ingresos);
  assert.equal(resultado.totalGastos, 100.3);
  assert.equal(resultado.balance, 0);
});

test("estadoPresupuestos: 70,10 + 29,90 de un límite de 100 es justo 100 % y restante 0", () => {
  const [estado] = estadoPresupuestos(
    "2026-10",
    [{ id: "p", categoriaId: "c", montoLimite: 100, mes: "2026-10" }],
    [70.1, 29.9].map((monto, i) => ({ id: `g${i}`, monto, descripcion: "", categoriaId: "c", fecha: "2026-10-03", createdAt: "" })),
    [{ id: "c", nombre: "Comida", color: "#000", tipo: "gasto" }]
  );
  assert.equal(estado.gastado, 100);
  assert.equal(estado.porcentaje, 100);
  assert.equal(estado.restante, 0);
});

// --- Mensajes de error --------------------------------------------------

test("mensajeError: un monto vacío o con letras no muestra el JSON de zod", () => {
  const r = gastoSchema.safeParse({ monto: NaN, descripcion: "Café", categoriaId: UUID, fecha: "2026-10-15" });
  assert.equal(r.success, false);
  assert.equal(mensajeError(r.error), "Escribe un monto válido, por ejemplo 12,50.");
});

test("mensajeError: los mensajes de zod en inglés se reemplazan; los propios en español pasan", () => {
  const ingles = cambiosGastoSchema.safeParse({ cuentaId: "no-es-uuid" });
  assert.equal(ingles.success, false);
  assert.match(mensajeError(ingles.error), /^Revisa los datos ingresados/);

  const diferido = gastoSchema.safeParse({ monto: 10, descripcion: "TV", categoriaId: UUID, metodoPago: "diferido", fecha: "2026-10-15" });
  assert.equal(diferido.success, false);
  assert.equal(mensajeError(diferido.error), "Indica a cuántos meses es el diferido.");
});

test("mensajeError: sin conexión, en cualquier motor, da un mensaje claro", () => {
  assert.equal(mensajeError(new TypeError("Network request failed")), MENSAJE_SIN_CONEXION);
  assert.equal(mensajeError({ message: "TypeError: Failed to fetch" }), MENSAJE_SIN_CONEXION);
  assert.equal(mensajeError(new TypeError("Load failed")), MENSAJE_SIN_CONEXION);
});

test("mensajeError: traduce los códigos de Postgres y deja pasar los mensajes de los triggers", () => {
  assert.match(mensajeError({ code: "23503", message: "update or delete on table violates foreign key" }), /dependen de este registro/);
  assert.match(mensajeError({ code: "23514", message: "new row violates check constraint" }), /no cumple las reglas/);
  assert.equal(mensajeError({ code: "23505", message: "duplicate key" }), "Ese registro ya existe.");
  assert.equal(mensajeError({ code: "22023", message: "El abono debe ser de al menos $0,01." }), "El abono debe ser de al menos $0,01.");
  assert.equal(mensajeError({ code: "P0001", message: "No puedes borrar esta deuda." }), "No puedes borrar esta deuda.");
});

// --- Correos bancarios --------------------------------------------------

test("parsearCorreoBancario: lee montos con miles y coma decimal, y fechas reales", () => {
  const r = parsearCorreoBancario("x@y.com", "Consumo con tu tarjeta", "Monto: $1.234,56 el 15/10/2026");
  assert.equal(r.monto, 1234.56);
  assert.equal(r.fecha, "2026-10-15");
  assert.equal(r.tipo, "gasto");

  const sinPrefijo = parsearCorreoBancario("x@y.com", "Compra", "Total$1234.56");
  assert.equal(sinPrefijo.monto, 1234.56); // antes leía 234.56
});

test("parsearCorreoBancario: no toma los dígitos de la tarjeta como monto ni acepta fechas imposibles", () => {
  const r = parsearCorreoBancario("x@y.com", "Consumo", "Tarjeta terminada en 1234, consumo de $25.00 el 30/02/2026");
  assert.equal(r.monto, 25);
  assert.equal(r.fecha, undefined);
});

test("parsearCorreoBancario: 'abono a tu tarjeta' es una salida, no un ingreso", () => {
  assert.equal(parsearCorreoBancario("x@y.com", "Abono a tu tarjeta", "Valor $100.00").tipo, "gasto");
  assert.equal(parsearCorreoBancario("x@y.com", "Pago de su tarjeta", "Valor $100.00").tipo, "gasto");
  assert.equal(parsearCorreoBancario("x@y.com", "Depósito recibido", "Valor $100.00").tipo, "ingreso");
});

const aviso = (cambios: Record<string, unknown> = {}) => ({
  mensajeId: "m1",
  tipo: "gasto" as const,
  monto: 10,
  descripcion: "Compra",
  fecha: "2026-10-15",
  ...cambios,
});

test("avisoGuardable: descarta montos y fechas imposibles", () => {
  assert.equal(avisoGuardable(aviso()), true);
  assert.equal(avisoGuardable(aviso({ monto: NaN })), false);
  assert.equal(avisoGuardable(aviso({ monto: 0 })), false);
  assert.equal(avisoGuardable(aviso({ fecha: "2026-02-30" })), false);
  assert.equal(avisoGuardable(aviso({ mensajeId: "" })), false);
});

test("insertarTransaccionesDetectadas: un aviso malo ya no tumba el lote", async () => {
  const escrituras = clienteFalso();
  const r = await insertarTransaccionesDetectadas([aviso(), aviso({ mensajeId: "m2", fecha: "2026-02-30" }), aviso({ mensajeId: "m3", monto: NaN })]);
  assert.deepEqual(r, { enviados: 1, descartados: 2 });
  assert.equal(escrituras.length, 1);
  assert.equal(escrituras[0].datos.length, 1);

  const vacias = clienteFalso();
  assert.deepEqual(await insertarTransaccionesDetectadas([aviso({ monto: -1 })]), { enviados: 0, descartados: 1 });
  assert.equal(vacias.length, 0, "sin avisos válidos no se llama a la base");
});

test("marcarTransaccionDetectada: solo descarta, y borra el asunto del correo", async () => {
  const escrituras = clienteFalso();
  await marcarTransaccionDetectada("id", "descartado");
  assert.deepEqual(escrituras[0].datos, { estado: "descartado", correo_asunto: null });
  await assert.rejects(marcarTransaccionDetectada("id", "confirmado" as any));
  assert.equal(escrituras.length, 1);
});

// --- Edición de gastos --------------------------------------------------

const filaGasto = { id: "g", monto: "10", descripcion: "x", categoria_id: UUID, fecha: "2026-10-15", created_at: "" };

test("actualizarGasto: valida antes de ir a la base", async () => {
  const escrituras = clienteFalso(filaGasto);
  await assert.rejects(actualizarGasto("g", { monto: NaN }), (err) => {
    assert.equal(mensajeError(err), "Escribe un monto válido, por ejemplo 12,50.");
    return true;
  });
  await assert.rejects(actualizarGasto("g", { fecha: "2026-02-30" }));
  await assert.rejects(actualizarGasto("g", { descripcion: "x".repeat(500) }));
  assert.equal(escrituras.length, 0);
});

test("actualizarGasto: \"\" quita cuenta, detalle y método (como lo envía la web) y redondea el monto", async () => {
  const escrituras = clienteFalso(filaGasto);
  await actualizarGasto("g", { cuentaId: "", categoriaDetalle: "", metodoPago: "" as any, monto: 10.006 });
  assert.deepEqual(escrituras[0].datos, { monto: 10.01, cuenta_id: null, categoria_detalle: null, metodo_pago: null });
});

test("crearGasto: sin tasa no envía la columna (funciona en una base sin la migración de intereses)", async () => {
  const sinTasa = clienteFalso(filaGasto);
  await crearGasto({ monto: 10, descripcion: "Café", categoriaId: UUID, fecha: "2026-10-15" });
  assert.equal("tasa_interes" in sinTasa[0].datos, false);

  const conTasa = clienteFalso(filaGasto);
  await crearGasto({ monto: 600, descripcion: "TV", categoriaId: UUID, metodoPago: "diferido", mesesDiferido: 6, tasaInteres: 16.5, fecha: "2026-10-15" });
  assert.equal(conTasa[0].datos.tasa_interes, 16.5);
});

// --- Movimientos de una cuenta -----------------------------------------

test("movimientosDe: la cuenta de origen muestra los pagos a tarjeta y los abonos como salidas", () => {
  const categorias: Categoria[] = [];
  const pagos: PagoTarjeta[] = [{ id: "p1", cuentaId: "tc", cuentaOrigenId: "ahorro", monto: 200, fecha: "2026-10-10", createdAt: "a" }];
  const abonos: AbonoDeuda[] = [
    { id: "a1", deudaId: "d", cuentaId: "ahorro", monto: 50, fecha: "2026-10-11", createdAt: "b" },
    { id: "a2", deudaId: "d", monto: 30, fecha: "2026-10-11", createdAt: "c" },
  ];
  const ingresos: Ingreso[] = [{ id: "i1", monto: 1000, descripcion: "Sueldo", cuentaId: "ahorro", fecha: "2026-10-01", createdAt: "d" }];
  const gastos: Gasto[] = [];

  const ahorro = movimientosDe("ahorro", gastos, pagos, ingresos, categorias, abonos);
  assert.deepEqual(
    ahorro.map((m) => [m.tipo, m.sentido, m.monto]),
    [
      ["abono", "salida", 50],
      ["pago_enviado", "salida", 200],
      ["ingreso", "entrada", 1000],
    ]
  );

  const tarjeta = movimientosDe("tc", gastos, pagos, ingresos, categorias, abonos);
  assert.deepEqual(tarjeta.map((m) => [m.tipo, m.sentido]), [["pago", "entrada"]]);
  assert.equal(new Set([...ahorro, ...tarjeta].map((m) => m.id)).size, 4, "ids únicos para las listas");
});

test("etiquetaFecha: usa el día local (a las 21:00 en Ecuador, hoy sigue siendo hoy)", () => {
  const ahora = new Date(2026, 9, 15, 21, 0);
  assert.equal(etiquetaFecha("2026-10-15", ahora), "Hoy");
  assert.equal(etiquetaFecha("2026-10-14", ahora), "Ayer");
  assert.match(etiquetaFecha("2026-10-01", ahora), /octubre/);
});

// --- Fechas y recordatorios ---------------------------------------------

test("sumarMeses: si el día no existe, usa el último del mes (igual que la base)", () => {
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(sumarMeses("2028-01-31", 1), "2028-02-29");
  assert.equal(sumarMeses("2026-03-31", -1), "2026-02-28");
  assert.equal(sumarMeses("2026-08-31", 1), "2026-09-30");
});

test("siguienteFechaRecurrente: semanal, mensual y anual", () => {
  assert.equal(siguienteFechaRecurrente("2026-12-29", "semanal"), "2027-01-05");
  assert.equal(siguienteFechaRecurrente("2026-10-15", "mensual"), "2026-11-15");
  assert.equal(siguienteFechaRecurrente("2026-01-31", "mensual"), "2026-02-28");
  assert.equal(siguienteFechaRecurrente("2028-02-29", "anual"), "2029-02-28");
});

const filaRecordatorio = { id: "r", titulo: "Luz", tipo: "pago", monto: null, fecha: "2026-11-15", recurrente: true, frecuencia: "mensual", completado: false, deuda_id: null, created_at: "" };

test("completarRecordatorio: el recurrente pasa a la siguiente fecha; el único queda hecho", async () => {
  const base: Recordatorio = { id: "r", titulo: "Luz", tipo: "pago" as Recordatorio["tipo"], fecha: "2026-10-15", recurrente: true, frecuencia: "mensual", completado: false, createdAt: "" };

  const recurrente = clienteFalso(filaRecordatorio);
  await completarRecordatorio(base);
  assert.deepEqual(recurrente[0].datos, { fecha: "2026-11-15", completado: false });

  const unico = clienteFalso(filaRecordatorio);
  await completarRecordatorio({ ...base, recurrente: false, frecuencia: undefined });
  assert.deepEqual(unico[0].datos, { completado: true });
});

// --- Recomendaciones ------------------------------------------------------

test("generarRecomendaciones: con un solo mes de historial no inventa aumentos", () => {
  const categorias: Categoria[] = [{ id: "c", nombre: "Comida", color: "#000", tipo: "gasto" }];
  const g = (monto: number, fecha: string): Gasto => ({ id: `${fecha}${monto}`, monto, descripcion: "", categoriaId: "c", fecha, createdAt: "" });
  const base = {
    mes: "2026-10",
    ingresos: [{ id: "i", monto: 2000, descripcion: "", fecha: "2026-10-01", createdAt: "" }],
    categorias,
    cuentas: [],
    endeudamiento: calcularEndeudamiento([], 2000),
  };

  // Promedio real: 100 (un mes). Antes se dividía entre 3 → 33 y "260 % más".
  const parecido = generarRecomendaciones({ ...base, gastos: [g(100, "2026-09-10"), g(120, "2026-10-10")] });
  assert.equal(parecido.some((r) => r.mensaje.includes("Comida")), false);

  const subio = generarRecomendaciones({ ...base, gastos: [g(100, "2026-09-10"), g(140, "2026-10-10")] });
  assert.ok(subio.some((r) => r.mensaje.includes('40% más en "Comida"')));
});

// --- Timeouts ---------------------------------------------------------------

test("fetchConTimeout: el límite cubre también la descarga del cuerpo", async () => {
  const cuerpoColgado = { status: 200, statusText: "OK", headers: {}, arrayBuffer: () => new Promise(() => {}) };
  const fetchSeguro = crearFetchConTimeout({ ms: 50, fetchBase: async () => cuerpoColgado });
  await assert.rejects(fetchSeguro("https://api.ejemplo/rest/v1/gastos"), ErrorTiempoAgotado);
});

test("fetchConTimeout: entrega la respuesta completa cuando llega a tiempo", async () => {
  const fetchSeguro = crearFetchConTimeout({ ms: 500, fetchBase: async () => new Response('{"ok":true}', { status: 201 }) });
  const res = await fetchSeguro("https://api.ejemplo/rest/v1/gastos");
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });

  const sinCuerpo = crearFetchConTimeout({ ms: 500, fetchBase: async () => new Response(null, { status: 204 }) });
  assert.equal((await sinCuerpo("https://api.ejemplo/rest/v1/gastos", { method: "DELETE" })).status, 204);
});
