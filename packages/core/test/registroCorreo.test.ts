import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import { avisosDeCorreos, cuentaPorDigitos, resumenSincronizacion, type CorreoRecibido } from "../src/lib/sincronizacionCorreo.ts";
import {
  insertarTransaccionesDetectadas,
  registrarAvisosDelCorreo,
} from "../src/repositories/transaccionesDetectadas.repo.ts";
import type { Cuenta } from "../src/types/domain.ts";

const cuenta = (id: string, tipo: Cuenta["tipo"], banco: Cuenta["banco"], identificador?: string): Cuenta =>
  ({ id, nombre: id, tipo, banco, identificador, disponible: 100 }) as Cuenta;

test("cuentaPorDigitos: los dígitos mandan; 3 dígitos del banco coinciden con 4 anotados", () => {
  const cuentas = [
    cuenta("amex-1", "credito", "banco_guayaquil", "5678"),
    cuenta("amex-2", "credito", "banco_guayaquil", "1234"),
    cuenta("ahorro-gye", "ahorro", "banco_guayaquil", "4321"),
  ];
  assert.equal(cuentaPorDigitos(cuentas, "banco_guayaquil", "1234", ["credito"]), "amex-2");
  assert.equal(cuentaPorDigitos(cuentas, "banco_guayaquil", "678", ["credito"]), "amex-1", "el comprobante muestra 3 dígitos");
  assert.equal(cuentaPorDigitos(cuentas, "banco_guayaquil", "21", ["ahorro", "debito"]), "ahorro-gye", "«0000-XXXX-21»");
  assert.equal(cuentaPorDigitos(cuentas, "banco_guayaquil", "9999", ["credito"]), undefined, "una tarjeta no registrada no se adivina");
  assert.equal(cuentaPorDigitos(cuentas, "banco_guayaquil", undefined, ["credito"]), undefined, "dos tarjetas y sin dígitos: ambiguo");
  assert.equal(cuentaPorDigitos(cuentas, undefined, "1234", ["credito"]), undefined, "sin banco no se registra solo");
});

test("cuentaPorDigitos: si ninguna lleva esos dígitos, la única que todavía no tiene dígitos anotados", () => {
  const cuentas = [cuenta("debito", "debito", "pichincha", "1111"), cuenta("ahorro", "ahorro", "pichincha")];
  assert.equal(cuentaPorDigitos(cuentas, "pichincha", "8765", ["ahorro", "debito"]), "ahorro");
  const dosSinDigitos = [cuenta("a", "ahorro", "pichincha"), cuenta("b", "ahorro", "pichincha")];
  assert.equal(cuentaPorDigitos(dosSinDigitos, "pichincha", "8765", ["ahorro"]), undefined);
});

const consumo: CorreoRecibido = {
  mensajeId: "m1",
  remitente: "BancoGuayaquil@bancoguayaquil.com",
  asunto: "Ana realizó un consumo por $ 12.34 en TIENDA PRUEBA S A",
  cuerpoTexto: "Consumo nacional con tu tarjeta AMEX Detalle de tu consumo $12.34 TIENDA PRUEBA S A AMEX – 123456-XXXXX-1234 Consumo nacional 2026/10/17 A LAS 12:34:56 Fecha de corte 2026-11-17",
  fecha: "2026-10-18",
};

const transferencia: CorreoRecibido = {
  mensajeId: "m2",
  remitente: "bancavirtual@bancoguayaquil.com",
  asunto: "TRANSFERENCIAS INTERBANCARIAS",
  cuerpoTexto:
    "Comprobante de Transferencia Interbancaria Datos del Ordenante No. de Cuenta: 000XXX4321 Datos del Beneficiario No. de Cuenta: 000XXX8765 Banco de la Cuenta: BANCO PICHINCHA Valor Transferido: $ 10.00 Valor Comisión: $ 0.50 Total Debitado: $ 10.50 Concepto: TRANSFERENCIA 19/10/2026 09:00:00 SEC 1",
  fecha: "2026-10-19",
};

test("avisosDeCorreos: un consumo reconocido lleva clase, comercio, tarjeta, hora y la cuenta por dígitos", () => {
  const cuentas = [cuenta("amex-1", "credito", "banco_guayaquil", "5678"), cuenta("amex-2", "credito", "banco_guayaquil", "1234")];
  const [a] = avisosDeCorreos([consumo], cuentas);
  assert.equal(a.clase, "consumo");
  assert.equal(a.cuentaId, "amex-2");
  assert.equal(a.comercio, "TIENDA PRUEBA S A");
  assert.equal(a.tarjetaFinal, "1234");
  assert.equal(a.fecha, "2026-10-17", "la del consumo, no la de recepción ni la de corte");
  assert.equal(a.pagadoEn, "2026-10-17T12:34:56-05:00");
});

test("avisosDeCorreos: una transferencia entre cuentas propias lleva las dos cuentas y la comisión", () => {
  const cuentas = [cuenta("ahorro-gye", "ahorro", "banco_guayaquil", "4321"), cuenta("ahorro-pich", "ahorro", "pichincha", "8765")];
  const [a] = avisosDeCorreos([transferencia], cuentas);
  assert.equal(a.clase, "transferencia");
  assert.equal(a.cuentaId, "ahorro-gye");
  assert.equal(a.contraparteCuentaId, "ahorro-pich");
  assert.equal(a.monto, 10);
  assert.equal(a.comision, 0.5);
  assert.equal(a.esTransferencia, true);
});

test("insertarTransaccionesDetectadas: lo reconocido viaja en columnas propias; sin la migración se reintenta sin ellas", async () => {
  const cuentas = [cuenta("11111111-1111-4111-8111-111111111111", "credito", "banco_guayaquil", "1234")];
  const avisos = avisosDeCorreos([consumo], cuentas);
  const intentos: any[] = [];
  setSupabaseClient({
    from: () => ({
      upsert: async (filas: any[]) => {
        intentos.push(filas);
        return { error: "clase" in filas[0] ? { code: "PGRST204", message: "Could not find the 'clase' column" } : null };
      },
    }),
  } as any);
  assert.deepEqual(await insertarTransaccionesDetectadas(avisos), { enviados: 1, descartados: 0 });
  assert.equal(intentos.length, 2);
  assert.equal(intentos[0][0].clase, "consumo");
  assert.equal(intentos[0][0].pagado_en, "2026-10-17T12:34:56-05:00");
  assert.equal(intentos[0][0].comercio, "TIENDA PRUEBA S A");
  assert.equal("clase" in intentos[1][0], false);
});

test("registrarAvisosDelCorreo: lee la respuesta de la base y tolera una base sin la migración", async () => {
  setSupabaseClient({
    rpc: async () => ({
      data: [
        { aviso: "a1", resultado: "registrado", clase: "consumo", gasto_id: "g1", monto: "12.34", comercio: "TIENDA PRUEBA S A", tarjeta: "1234", sin_lugar: true },
        { aviso: "a2", resultado: "ya_registrado", clase: "pago_tarjeta" },
        { aviso: "a3", resultado: "otra cosa", clase: "consumo" },
      ],
      error: null,
    }),
  } as any);
  const r = await registrarAvisosDelCorreo();
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].monto, r[0].comercio, r[0].sinLugar, r[0].gastoId], [12.34, "TIENDA PRUEBA S A", true, "g1"]);
  assert.equal(r[1].resultado, "ya_registrado");

  setSupabaseClient({ rpc: async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }) } as any);
  assert.deepEqual(await registrarAvisosDelCorreo(), []);
});

test("resumenSincronizacion: dice qué se registró solo y cuánto queda por revisar", () => {
  const base = { revisados: 10, enviados: 3, descartados: 0, truncado: false, fallidos: 0 };
  const texto = resumenSincronizacion({
    ...base,
    registrados: [
      { avisoId: "1", resultado: "registrado", clase: "consumo" },
      { avisoId: "2", resultado: "registrado", clase: "consumo" },
      { avisoId: "3", resultado: "registrado", clase: "pago_tarjeta" },
      { avisoId: "4", resultado: "ya_registrado", clase: "consumo" },
    ],
    porRevisar: 1,
  });
  assert.match(texto, /Registré 2 consumos con tarjeta y 1 pago de tarjeta\./);
  assert.match(texto, /1 movimiento\(s\) esperan tu revisión en la Bandeja/);
  assert.equal(resumenSincronizacion({ ...base, registrados: [], porRevisar: 0 }), "No encontré movimientos nuevos que reconocer.");
});

test("textoNotificacionRegistrado: consumo, pago de tarjeta y transferencia", async () => {
  const { textoNotificacionRegistrado } = await import("../src/lib/sincronizacionCorreo.ts");
  const consumo = textoNotificacionRegistrado({ avisoId: "1", resultado: "registrado", clase: "consumo", monto: 12.34, comercio: "TIENDA PRUEBA S A", tarjeta: "1234", categoria: "Comida" });
  assert.equal(consumo.titulo, "Registré $12.34 en TIENDA PRUEBA S A");
  assert.equal(consumo.cuerpo, "Con tu tarjeta •••• 1234 · Comida");
  assert.equal(consumo.ruta, "/gastos");
  const pago = textoNotificacionRegistrado({ avisoId: "2", resultado: "registrado", clase: "pago_tarjeta", monto: 50, cuenta: "AMEX", otraCuenta: "Ahorro" });
  assert.equal(pago.titulo, "Registré el pago de $50.00 a AMEX");
  assert.match(pago.cuerpo, /Pagado desde Ahorro/);
  const t = textoNotificacionRegistrado({ avisoId: "3", resultado: "registrado", clase: "transferencia", monto: 10, cuenta: "Ahorro GYE", otraCuenta: "Ahorro Pichincha", comision: 0.5 });
  assert.equal(t.cuerpo, "Ahorro GYE → Ahorro Pichincha · comisión $0.50");
});
