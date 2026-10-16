import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import { cambiosGastoSchema, gastoSchema } from "../src/schemas/gasto.schema.ts";
import { ubicacionSchema, ubicacionSegura } from "../src/schemas/ubicacion.schema.ts";
import { filaDeUbicacion, ubicacionDeFila } from "../src/lib/ubicacion.ts";
import { actualizarGasto, crearGasto } from "../src/repositories/gastos.repo.ts";
import {
  insertarTransaccionesDetectadas,
  listarTransaccionesPendientes,
  type TransaccionDetectadaInsert,
} from "../src/repositories/transaccionesDetectadas.repo.ts";
import { eliminarTodosLosDatos } from "../src/usecases/eliminarTodosLosDatos.ts";

const UUID = "11111111-1111-4111-8111-111111111111";
const gastoValido = { monto: 12.5, descripcion: "Supermaxi", categoriaId: UUID, fecha: "2026-10-16" };

/** Cliente falso: anota lo que se envía a cada tabla y responde con la fila recibida. */
function clienteQueAnota(respuesta: Record<string, unknown> = {}) {
  const enviado: { tabla: string; accion: string; datos: any }[] = [];
  setSupabaseClient({
    from: (tabla: string) => {
      const fila = () => ({ id: UUID, monto: 1, descripcion: "x", categoria_id: UUID, fecha: "2026-10-16", created_at: "", ...respuesta });
      const cadena: any = {
        select: () => cadena,
        eq: () => cadena,
        order: () => cadena,
        not: () => cadena,
        single: async () => ({ data: fila(), error: null }),
        then: (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) =>
          Promise.resolve({ data: [fila()], error: null }).then(ok, mal),
      };
      return {
        insert: (datos: unknown) => (enviado.push({ tabla, accion: "insert", datos }), cadena),
        update: (datos: unknown) => (enviado.push({ tabla, accion: "update", datos }), cadena),
        upsert: async (datos: unknown) => (enviado.push({ tabla, accion: "upsert", datos }), { error: null }),
        delete: () => (enviado.push({ tabla, accion: "delete", datos: null }), cadena),
        select: () => cadena,
      };
    },
  } as any);
  return enviado;
}

test("gastoSchema: Apple Pay solo con débito, crédito, diferido o sin método", () => {
  const efectivo = gastoSchema.safeParse({ ...gastoValido, metodoPago: "efectivo", billetera: "apple_pay" });
  assert.equal(efectivo.success, false);
  assert.match(efectivo.error!.issues[0].message, /pagan con tarjeta/);
  assert.equal(gastoSchema.safeParse({ ...gastoValido, metodoPago: "transferencia", billetera: "google_wallet" }).success, false);
  assert.equal(gastoSchema.safeParse({ ...gastoValido, metodoPago: "credito", billetera: "apple_pay" }).success, true);
  assert.equal(gastoSchema.safeParse({ ...gastoValido, billetera: "google_wallet" }).success, true);
  assert.equal(gastoSchema.safeParse({ ...gastoValido, billetera: "paypal" }).success, false);
});

test("ubicacionSchema: redondea a 4 decimales y rechaza coordenadas imposibles", () => {
  assert.deepEqual(ubicacionSchema.parse({ latitud: -0.180749, longitud: -78.467851, precisionM: 12.6 }), {
    latitud: -0.1807,
    longitud: -78.4679,
    precisionM: 13,
  });
  for (const malo of [
    { latitud: 91, longitud: 0 },
    { latitud: 0, longitud: -181 },
    { latitud: NaN, longitud: 0 },
    { latitud: 0, longitud: Infinity },
    { latitud: "0", longitud: 0 },
    { latitud: 0, longitud: 0, precisionM: -1 },
    { latitud: 0, longitud: 0, precisionM: 60000 },
    { latitud: 0 },
  ]) {
    assert.equal(ubicacionSchema.safeParse(malo).success, false, JSON.stringify(malo));
  }
  assert.equal(ubicacionSegura({ latitud: 200, longitud: 0 }), undefined);
  assert.deepEqual(ubicacionSegura({ latitud: 1, longitud: 2 }), { latitud: 1, longitud: 2 });
});

test("gastoSchema: la ubicación del gasto se valida y se redondea", () => {
  const r = gastoSchema.parse({ ...gastoValido, ubicacion: { latitud: -2.170998, longitud: -79.922359 } });
  assert.deepEqual(r.ubicacion, { latitud: -2.171, longitud: -79.9224 });
  assert.equal(gastoSchema.safeParse({ ...gastoValido, ubicacion: { latitud: -95, longitud: 0 } }).success, false);
  assert.equal(gastoSchema.safeParse({ ...gastoValido, lugarId: "no-es-uuid" }).success, false);
});

test("cambiosGastoSchema: null quita la ubicación y '' quita billetera o lugar", () => {
  assert.equal(cambiosGastoSchema.safeParse({ ubicacion: null, billetera: "", lugarId: "" }).success, true);
  assert.equal(cambiosGastoSchema.safeParse({ billetera: "apple_pay", metodoPago: "efectivo" }).success, false);
  assert.equal(cambiosGastoSchema.safeParse({ billetera: "apple_pay" }).success, true);
});

test("ubicacionDeFila / filaDeUbicacion: convierten entre la base y el dominio", () => {
  assert.deepEqual(ubicacionDeFila({ latitud: "-0.1807", longitud: "-78.4678", precision_m: 15 }), {
    latitud: -0.1807,
    longitud: -78.4678,
    precisionM: 15,
  });
  assert.deepEqual(ubicacionDeFila({ latitud: -0.1807, longitud: -78.4678, precision_m: null }), { latitud: -0.1807, longitud: -78.4678 });
  assert.equal(ubicacionDeFila({}), undefined); // base sin la migración
  assert.equal(ubicacionDeFila({ latitud: null, longitud: null }), undefined);
  assert.deepEqual(filaDeUbicacion(null), { latitud: null, longitud: null, precision_m: null });
});

test("crearGasto: sin billetera ni ubicación no envía las columnas nuevas (base sin migrar)", async () => {
  const enviado = clienteQueAnota();
  await crearGasto({ ...gastoValido });
  const datos = enviado[0].datos;
  for (const columna of ["billetera", "latitud", "longitud", "precision_m", "lugar_id"]) {
    assert.equal(columna in datos, false, columna);
  }
});

test("crearGasto: envía billetera y ubicación, y las lee de vuelta", async () => {
  const enviado = clienteQueAnota({ billetera: "apple_pay", latitud: "-0.1807", longitud: "-78.4678", precision_m: 10, lugar_id: UUID });
  const g = await crearGasto({ ...gastoValido, billetera: "apple_pay", ubicacion: { latitud: -0.1807, longitud: -78.4678, precisionM: 10 } });
  assert.deepEqual(
    { b: enviado[0].datos.billetera, lat: enviado[0].datos.latitud, lon: enviado[0].datos.longitud, p: enviado[0].datos.precision_m },
    { b: "apple_pay", lat: -0.1807, lon: -78.4678, p: 10 }
  );
  assert.equal(g.billetera, "apple_pay");
  assert.deepEqual(g.ubicacion, { latitud: -0.1807, longitud: -78.4678, precisionM: 10 });
  assert.equal(g.lugarId, UUID);
});

test("actualizarGasto: pasar a efectivo quita la billetera; ubicacion null vacía las columnas", async () => {
  const enviado = clienteQueAnota();
  await actualizarGasto(UUID, { metodoPago: "efectivo" });
  assert.equal(enviado[0].datos.billetera, null);

  await actualizarGasto(UUID, { metodoPago: "credito" });
  assert.equal("billetera" in enviado[1].datos, false);

  await actualizarGasto(UUID, { ubicacion: null });
  assert.deepEqual(enviado[2].datos, { latitud: null, longitud: null, precision_m: null });

  await actualizarGasto(UUID, { billetera: "", lugarId: "" });
  assert.deepEqual(enviado[3].datos, { billetera: null, lugar_id: null });
});

const avisoCorreo: TransaccionDetectadaInsert = {
  mensajeId: "msg-1", tipo: "gasto", monto: 10, descripcion: "Consumo", fecha: "2026-10-16", correoAsunto: "Consumo",
};

test("insertarTransaccionesDetectadas: un lote solo de correo no envía las columnas nuevas", async () => {
  const enviado = clienteQueAnota();
  await insertarTransaccionesDetectadas([avisoCorreo]);
  assert.equal("origen" in enviado[0].datos[0], false);
  assert.equal("latitud" in enviado[0].datos[0], false);
});

test("insertarTransaccionesDetectadas: con un aviso de billetera, todas las filas llevan origen", async () => {
  const enviado = clienteQueAnota();
  const r = await insertarTransaccionesDetectadas([
    avisoCorreo,
    {
      mensajeId: "applepay:1", tipo: "gasto", monto: 25, descripcion: "Supermaxi", fecha: "2026-10-16",
      origen: "apple_pay", comercio: "  SUPERMAXI  ", ubicacion: { latitud: -0.18072, longitud: -78.46781 }, tarjetaFinal: "1234",
    },
    // Ubicación y tarjeta imposibles: el aviso se guarda igual, sin ellas.
    {
      mensajeId: "googlewallet:1", tipo: "gasto", monto: 8, descripcion: "Kiosko", fecha: "2026-10-16",
      origen: "google_wallet", ubicacion: { latitud: 500, longitud: 0 }, tarjetaFinal: "12ab",
    },
    // Una billetera no registra ingresos: se descarta.
    { mensajeId: "applepay:2", tipo: "ingreso", monto: 5, descripcion: "x", fecha: "2026-10-16", origen: "apple_pay" },
  ]);
  assert.deepEqual(r, { enviados: 3, descartados: 1 });
  const [correo, apple, google] = enviado[0].datos;
  assert.equal(correo.origen, "correo");
  assert.equal(correo.latitud, null);
  assert.deepEqual(
    { o: apple.origen, c: apple.comercio, lat: apple.latitud, t: apple.tarjeta_final },
    { o: "apple_pay", c: "SUPERMAXI", lat: -0.1807, t: "1234" }
  );
  assert.deepEqual({ lat: google.latitud, lon: google.longitud, t: google.tarjeta_final }, { lat: null, lon: null, t: null });
});

test("listarTransaccionesPendientes: una fila sin origen (base sin migrar) es del correo", async () => {
  clienteQueAnota({ mensaje_id: "m", tipo: "gasto", estado: "pendiente", banco: null, cuenta_id: null, correo_asunto: null });
  const [t] = await listarTransaccionesPendientes();
  assert.equal(t.origen, "correo");
  assert.equal(t.ubicacion, undefined);
});

test("eliminarTodosLosDatos: borra los lugares y tolera una base sin esa tabla", async () => {
  const enviado = clienteQueAnota();
  await eliminarTodosLosDatos();
  assert.equal(enviado.at(-1)!.tabla, "lugares");

  setSupabaseClient({
    from: (tabla: string) => ({
      delete: () => ({
        not: async () => ({ error: tabla === "lugares" ? { code: "PGRST205", message: "no existe" } : null }),
      }),
    }),
  } as any);
  await eliminarTodosLosDatos(); // no lanza
});
