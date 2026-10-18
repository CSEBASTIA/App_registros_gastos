import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import { transferenciaSchema, avisoComoTransferenciaSchema } from "../src/schemas/transferencia.schema.ts";
import {
  confirmarAvisoComoTransferencia,
  listarTransferencias,
  registrarTransferencia,
  separarTransferencia,
} from "../src/repositories/transferencias.repo.ts";
import { guardarAjustes, obtenerAjustes } from "../src/repositories/ajustes.repo.ts";
import { avisosPresupuestoDe, revisarMisPresupuestos } from "../src/repositories/presupuestos.repo.ts";
import { insertarTransaccionesDetectadas } from "../src/repositories/transaccionesDetectadas.repo.ts";
import { movimientosDe } from "../src/lib/movimientosCuenta.ts";
import { parsearCorreoBancario } from "../src/lib/correoBancario.ts";
import { avisosDeCorreos } from "../src/lib/sincronizacionCorreo.ts";
import { faltaEnLaBase } from "../src/lib/mensajeError.ts";
import type { Transferencia } from "../src/types/domain.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

// --- Validación -------------------------------------------------------------

test("transferenciaSchema: dos cuentas distintas, monto en centavos y fecha real", () => {
  const ok = transferenciaSchema.parse({ cuentaOrigenId: A, cuentaDestinoId: B, monto: 10.005, fecha: "2026-10-18" });
  assert.equal(ok.monto, 10.01);
  const misma = transferenciaSchema.safeParse({ cuentaOrigenId: A, cuentaDestinoId: A, monto: 5, fecha: "2026-10-18" });
  assert.equal(misma.success, false);
  assert.match(misma.error!.issues[0].message, /distintas/);
  const sinDestino = transferenciaSchema.safeParse({ cuentaOrigenId: A, monto: 5, fecha: "2026-10-18" });
  assert.match(sinDestino.error!.issues[0].message, /destino/);
  assert.equal(transferenciaSchema.safeParse({ cuentaOrigenId: A, cuentaDestinoId: B, monto: 5, fecha: "2026-02-30" }).success, false);
  assert.equal(transferenciaSchema.safeParse({ cuentaOrigenId: A, cuentaDestinoId: B, monto: 0, fecha: "2026-10-18" }).success, false);
});

test("avisoComoTransferenciaSchema: la cuenta del aviso y la otra deben ser distintas", () => {
  assert.equal(avisoComoTransferenciaSchema.safeParse({ cuentaId: A, otraCuentaId: A }).success, false);
  assert.equal(avisoComoTransferenciaSchema.safeParse({ cuentaId: A, otraCuentaId: B }).success, true);
});

// --- Repositorio --------------------------------------------------------------

function clienteTransferencias(opciones: { errorLista?: unknown } = {}) {
  const llamadas: { accion: string; datos?: unknown; fn?: string; args?: unknown }[] = [];
  const fila = {
    id: C,
    usuario_id: "u",
    cuenta_origen_id: A,
    cuenta_destino_id: B,
    monto: "25.50",
    fecha: "2026-10-18",
    descripcion: null,
    origen: "manual",
    created_at: "2026-10-18T10:00:00Z",
  };
  setSupabaseClient({
    from: () => {
      const cadena: any = {
        select: () => cadena,
        gte: () => cadena,
        lte: () => cadena,
        eq: () => cadena,
        order: () => cadena,
        range: async () => (opciones.errorLista ? { data: null, error: opciones.errorLista } : { data: [fila], error: null }),
        single: async () => ({ data: fila, error: null }),
      };
      return {
        select: () => cadena,
        insert: (datos: unknown) => (llamadas.push({ accion: "insert", datos }), cadena),
        delete: () => (llamadas.push({ accion: "delete" }), cadena),
      };
    },
    rpc: async (fn: string, args: unknown) => {
      llamadas.push({ accion: "rpc", fn, args });
      return { data: fn === "separar_transferencia" ? 2 : C, error: null };
    },
  } as any);
  return llamadas;
}

test("registrarTransferencia: valida antes de ir a la red y envía las columnas de la base", async () => {
  const llamadas = clienteTransferencias();
  await assert.rejects(registrarTransferencia({ cuentaOrigenId: A, cuentaDestinoId: A, monto: 5, fecha: "2026-10-18" }));
  assert.equal(llamadas.length, 0);
  const t = await registrarTransferencia({ cuentaOrigenId: A, cuentaDestinoId: B, monto: 25.5, fecha: "2026-10-18", descripcion: "  " });
  assert.deepEqual(llamadas[0].datos, { cuenta_origen_id: A, cuenta_destino_id: B, monto: 25.5, fecha: "2026-10-18", descripcion: null });
  assert.equal(t.monto, 25.5);
  assert.equal(t.origen, "manual");
  assert.equal(t.descripcion, undefined);
});

test("listarTransferencias: lee los montos como número y tolera una base sin la tabla", async () => {
  clienteTransferencias();
  const [t] = await listarTransferencias({ desde: "2026-10-01", hasta: "2026-10-31" });
  assert.equal(t.monto, 25.5);
  clienteTransferencias({ errorLista: { code: "PGRST205", message: "no existe" } });
  assert.deepEqual(await listarTransferencias(), []);
  clienteTransferencias({ errorLista: { code: "57014", message: "timeout" } });
  await assert.rejects(listarTransferencias());
});

test("confirmarAvisoComoTransferencia y separarTransferencia llaman a sus funciones de la base", async () => {
  const llamadas = clienteTransferencias();
  assert.equal(await confirmarAvisoComoTransferencia("aviso-1", { cuentaId: A, otraCuentaId: B }), C);
  assert.deepEqual(llamadas[0], {
    accion: "rpc",
    fn: "confirmar_aviso_como_transferencia",
    args: { p_id: "aviso-1", p_cuenta: A, p_otra_cuenta: B, p_monto: null, p_descripcion: null },
  });
  await assert.rejects(confirmarAvisoComoTransferencia("aviso-1", { cuentaId: A, otraCuentaId: A }));
  assert.equal(await separarTransferencia(C), 2);
  assert.equal(llamadas.at(-1)!.fn, "separar_transferencia");
});

test("faltaEnLaBase reconoce tablas, columnas y funciones que aún no existen", () => {
  assert.equal(faltaEnLaBase({ code: "PGRST205" }), true);
  assert.equal(faltaEnLaBase({ code: "PGRST202" }), true);
  assert.equal(faltaEnLaBase({ code: "42P01" }), true);
  assert.equal(faltaEnLaBase({ code: "23505" }), false);
  assert.equal(faltaEnLaBase(null), false);
});

// --- Línea de tiempo de una cuenta ---------------------------------------------

test("movimientosDe: una transferencia sale de una cuenta y entra en la otra, con el nombre de la otra", () => {
  const transferencias: Transferencia[] = [
    { id: "t1", cuentaOrigenId: A, cuentaDestinoId: B, monto: 40, fecha: "2026-10-18", origen: "manual", createdAt: "2026-10-18T10:00:00Z" },
    { id: "t2", cuentaOrigenId: undefined, cuentaDestinoId: A, monto: 5, fecha: "2026-10-17", origen: "correo", createdAt: "2026-10-17T10:00:00Z", descripcion: "Del ahorro" },
  ];
  const cuentas = [{ id: A, nombre: "Ahorro" }, { id: B, nombre: "Efectivo" }];
  const ahorro = movimientosDe(A, [], [], [], [], [], transferencias, cuentas);
  assert.deepEqual(
    ahorro.map((m) => [m.tipo, m.sentido, m.subtitulo, m.monto]),
    [
      ["transferencia_enviada", "salida", "A Efectivo", 40],
      ["transferencia_recibida", "entrada", "Desde otra cuenta", 5],
    ]
  );
  const efectivo = movimientosDe(B, [], [], [], [], [], transferencias, cuentas);
  assert.deepEqual(efectivo.map((m) => [m.tipo, m.subtitulo, m.descripcion]), [["transferencia_recibida", "Desde Ahorro", "Transferencia"]]);
  assert.deepEqual(movimientosDe(C, [], [], [], [], [], transferencias, cuentas), []);
});

// --- Correo -----------------------------------------------------------------

test("parsearCorreoBancario: marca las transferencias, pero no los pagos a la tarjeta ni las compras", () => {
  const banco = "Banco Pichincha <banco@pichincha.com>";
  assert.equal(parsearCorreoBancario(banco, "Transferencia enviada", "Valor $50.00 desde tu cuenta ****1111").esTransferencia, true);
  assert.equal(parsearCorreoBancario(banco, "Notificación", "Has recibido dinero: $20.00 en tu cuenta 2222").esTransferencia, true);
  assert.equal(parsearCorreoBancario(banco, "Compra aprobada", "Consumo de $12.50 en SUPERMAXI").esTransferencia, false);
  assert.equal(parsearCorreoBancario(banco, "Transferencia: pago a tu tarjeta", "Abono a tu tarjeta $80.00").esTransferencia, false);
});

test("avisosDeCorreos y la bandeja: la marca de transferencia viaja solo si algún aviso la lleva", async () => {
  const correos = [
    { mensajeId: "1", remitente: "banco@pichincha.com", asunto: "Transferencia enviada", cuerpoTexto: "Valor $50.00 cuenta 1111", fecha: "2026-10-18" },
    { mensajeId: "2", remitente: "banco@pichincha.com", asunto: "Compra aprobada", cuerpoTexto: "Consumo $9.99", fecha: "2026-10-18" },
  ];
  const avisos = avisosDeCorreos(correos, []);
  assert.equal(avisos[0].esTransferencia, true);
  assert.equal("esTransferencia" in avisos[1], false);

  const enviados: any[] = [];
  setSupabaseClient({
    from: () => ({ upsert: async (filas: unknown[]) => (enviados.push(filas), { error: null }) }),
  } as any);
  await insertarTransaccionesDetectadas(avisos);
  assert.deepEqual(enviados[0].map((f: any) => f.es_transferencia), [true, false]);
  await insertarTransaccionesDetectadas([avisos[1]]);
  assert.equal("es_transferencia" in enviados[1][0], false);

  // Base sin la migración: la columna no existe y se reintenta sin ella.
  const intentos: any[] = [];
  setSupabaseClient({
    from: () => ({
      upsert: async (filas: any[]) => {
        intentos.push(filas);
        return { error: "es_transferencia" in filas[0] ? { code: "PGRST204", message: "no existe la columna" } : null };
      },
    }),
  } as any);
  assert.deepEqual(await insertarTransaccionesDetectadas(avisos), { enviados: 2, descartados: 0 });
  assert.equal(intentos.length, 2);
  assert.equal("es_transferencia" in intentos[1][0], false);
});

// --- Ajustes ------------------------------------------------------------------

test("obtenerAjustes: sin fila (o sin la tabla) el registro automático está encendido; guardar hace upsert", async () => {
  let fila: { registro_automatico: boolean } | null = null;
  let errorLectura: unknown = null;
  const upserts: any[] = [];
  setSupabaseClient({
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: fila, error: errorLectura }) }),
      upsert: (datos: any, opciones: any) => {
        upserts.push({ datos, opciones });
        fila = { registro_automatico: datos.registro_automatico };
        return { select: () => ({ single: async () => ({ data: fila, error: null }) }) };
      },
    }),
  } as any);
  assert.deepEqual(await obtenerAjustes(), { registroAutomatico: true });
  assert.deepEqual(await guardarAjustes({ registroAutomatico: false }), { registroAutomatico: false });
  assert.equal(upserts[0].opciones.onConflict, "usuario_id");
  assert.equal("usuario_id" in upserts[0].datos, false);
  assert.deepEqual(await obtenerAjustes(), { registroAutomatico: false });
  errorLectura = { code: "PGRST205", message: "no existe" };
  assert.deepEqual(await obtenerAjustes(), { registroAutomatico: true });
});

// --- Presupuestos ---------------------------------------------------------------

test("revisarMisPresupuestos: valida el mes, lee los niveles y tolera una base sin la función", async () => {
  let respuesta: { data: unknown; error: unknown } = {
    data: [
      { presupuesto_id: A, categoria: "Comida", nivel: 101, porcentaje: "132.50", gastado: "26.50", limite: "20.00" },
      { presupuesto_id: B, categoria: "", nivel: 80 },
    ],
    error: null,
  };
  const pedidos: unknown[] = [];
  setSupabaseClient({ rpc: async (_fn: string, args: unknown) => (pedidos.push(args), respuesta) } as any);
  await assert.rejects(revisarMisPresupuestos("2026-13"));
  assert.equal(pedidos.length, 0);
  assert.deepEqual(await revisarMisPresupuestos("2026-10"), [
    { presupuestoId: A, categoria: "Comida", nivel: 101, porcentaje: 132.5, gastado: 26.5, limite: 20 },
  ]);
  respuesta = { data: null, error: { code: "PGRST202", message: "no existe" } };
  assert.deepEqual(await revisarMisPresupuestos("2026-10"), []);
  assert.deepEqual(avisosPresupuestoDe({ no: "lista" }), []);
});
