import { test } from "node:test";
import assert from "node:assert/strict";
import { esRemitenteUber, parsearCorreoBancario } from "../src/lib/correoBancario.ts";
import { avisosDeCorreos, tarjetaPorDigitos } from "../src/lib/sincronizacionCorreo.ts";
import { sugerirCategoria } from "../src/lib/textoFinanciero.ts";
import { cuentaDelEstado, propuestaCuentaDelEstado } from "../src/lib/lecturaPdf.ts";
import { cuentaSchema } from "../src/schemas/cuenta.schema.ts";
import type { Cuenta } from "../src/types/domain.ts";

function cuenta(id: string, extra: Partial<Cuenta>): Cuenta {
  return { id, nombre: id, tipo: "credito", banco: "pichincha", disponible: 100, createdAt: "", ...extra };
}

const visa = cuenta("visa", { identificador: "4242", cupoTotal: 500 });
const debito = cuenta("debito", { tipo: "debito", banco: "banco_guayaquil", identificador: "1111" });

const VIAJE = `Total $4,52
Viaje 4,52
Pagos
Visa ••••4242 $4,52
5 de noviembre de 2026`;

test("recibo de Uber: un viaje pagado con tarjeta es un consumo con sus últimos dígitos", () => {
  const p = parsearCorreoBancario("Uber Receipts <noreply@uber.com>", "Tu viaje del miércoles por la tarde con Uber", VIAJE);
  assert.equal(p.tipo, "gasto");
  assert.equal(p.clase, "consumo");
  assert.equal(p.monto, 4.52);
  assert.equal(p.comercio, "Uber");
  assert.equal(p.tarjetaFinal, "4242");
  assert.equal(p.banco, undefined);
  assert.equal(p.categoriaSugerida, "Transporte");
});

test("recibo de Uber: «esta es tu factura de tu viaje de hoy en la tarde» también cuenta", () => {
  const p = parsearCorreoBancario("noreply@uber.com", "Esta es tu factura de tu viaje de hoy en la tarde", "Total US$3.10 Mastercard •• 9876");
  assert.equal(p.monto, 3.1);
  assert.equal(p.tarjetaFinal, "9876");
});

test("recibo de Uber Eats: comida, no transporte", () => {
  const p = parsearCorreoBancario("noreply@uber.com", "Tu pedido de Uber Eats", "Gracias por pedir con Uber Eats. Total $12,30 Visa ••••4242");
  assert.equal(p.comercio, "Uber Eats");
  assert.equal(p.categoriaSugerida, "Comida");
});

test("recibo de Uber sin tarjeta: igual es consumo (la base usa la tarjeta que más usas ahí); en efectivo no", () => {
  const sinTarjeta = parsearCorreoBancario("noreply@uber.com", "Tu viaje con Uber", "Total $2.40");
  assert.equal(sinTarjeta.clase, "consumo");
  assert.equal(sinTarjeta.tarjetaFinal, undefined);
  const efectivo = parsearCorreoBancario("noreply@uber.com", "Tu viaje con Uber", "Total $2.40 Pagado en efectivo");
  assert.equal(efectivo.tipo, "gasto");
  assert.equal(efectivo.clase, undefined);
});

test("lo demás de Uber (promociones, reembolsos, Uber One) no es un movimiento", () => {
  for (const asunto of ["50% de descuento en tu próximo viaje", "Tu reembolso del viaje", "Tu membresía Uber One"]) {
    assert.equal(parsearCorreoBancario("noreply@uber.com", asunto, "Total $5.00").tipo, undefined, asunto);
  }
  // Un remitente que solo se parece a Uber no pasa.
  assert.equal(esRemitenteUber("recibos@uber.com.estafa.net"), false);
  assert.equal(esRemitenteUber("Uber <noreply@uber.com>"), true);
});

test("tarjetaPorDigitos: la única tarjeta de cualquier banco con esos dígitos; si hay dos, no adivina", () => {
  assert.equal(tarjetaPorDigitos([visa, debito], "4242"), "visa");
  assert.equal(tarjetaPorDigitos([visa, cuenta("otra", { banco: "produbanco", identificador: "4242" })], "4242"), undefined);
  assert.equal(tarjetaPorDigitos([visa], "99"), undefined);
});

test("avisosDeCorreos: el recibo de Uber llega con la tarjeta ya elegida", () => {
  const [aviso] = avisosDeCorreos(
    [{ mensajeId: "m1", remitente: "noreply@uber.com", asunto: "Tu viaje con Uber", cuerpoTexto: VIAJE, fecha: "2026-11-05" }],
    [visa, debito],
  );
  assert.equal(aviso.cuentaId, "visa");
  assert.equal(aviso.clase, "consumo");
  assert.equal(aviso.comercio, "Uber");
});

test("sugerirCategoria: «UBER *EATS» es Comida; «UBER *TRIP» y DiDi, Transporte", () => {
  assert.equal(sugerirCategoria("UBER *EATS PENDING"), "Comida");
  assert.equal(sugerirCategoria("UBER *TRIP HELP.UBER.COM"), "Transporte");
  assert.equal(sugerirCategoria("DIDI RIDES"), "Transporte");
});

const ESTADO_TARJETA = `BANCO PICHINCHA C.A.
ESTADO DE CUENTA TARJETA DE CRÉDITO
Tarjeta XXXX-XXXX-XXXX-4242
CUPO TOTAL 2.500,00
SALDO ANTERIOR 300,00
Pago mínimo 25,00`;

test("propuestaCuentaDelEstado: una tarjeta nueva sale con banco, dígitos, cupo y cupo disponible al inicio", () => {
  const detectada = cuentaDelEstado(ESTADO_TARJETA, []);
  const p = propuestaCuentaDelEstado(ESTADO_TARJETA, detectada, 300);
  assert.deepEqual(p, {
    nombre: "Banco Pichincha 4242",
    tipo: "credito",
    banco: "pichincha",
    identificador: "4242",
    cupoTotal: 2500,
    disponible: 2200,
  });
});

test("propuestaCuentaDelEstado: una cuenta de ahorro empieza con el saldo anterior (nunca negativo)", () => {
  const texto = "Banco de Guayaquil\nEstado de cuenta\nCuenta No. 0012345678\nSALDO ANTERIOR 150,25";
  const detectada = cuentaDelEstado(texto, []);
  assert.deepEqual(propuestaCuentaDelEstado(texto, detectada, 150.25), {
    nombre: "Banco Guayaquil 5678",
    tipo: "ahorro",
    banco: "banco_guayaquil",
    identificador: "5678",
    disponible: 150.25,
  });
  assert.equal(propuestaCuentaDelEstado(texto, detectada, -20).disponible, undefined);
});

test("cuentaSchema: una cuenta no empieza en negativo; una tarjeta sí puede", () => {
  const base = { nombre: "Ahorro", banco: "pichincha" };
  assert.equal(cuentaSchema.safeParse({ ...base, tipo: "ahorro", disponible: -1 }).success, false);
  assert.equal(cuentaSchema.safeParse({ ...base, tipo: "ahorro", disponible: 0 }).success, true);
  assert.equal(cuentaSchema.safeParse({ ...base, tipo: "credito", disponible: -50, cupoTotal: 100 }).success, true);
});

// Textos tal como llegan (capturas del 5 y el 30 de noviembre/octubre de 2026).
const AVISO_GUAYAQUIL_UBER = `Banco Guayaquil
Detalle de tu consumo
$2.90
UBER BV USDNUSD ECUADOR
AMEX – 376653-XXXXX-1618
Consumo internacional 2026/11/05 A LAS 20:05:36`;

const RECIBO_UBER_REAL = `Uber 30/10/2026 4:44 p.m.
Uber One
Gracias por usar Uber, sebastian
Esperamos que hayas disfrutado tu viaje de esta tarde.
Total $2.10
$0.11 Créditos Uber One obtenidos
Tarifa del viaje $2.20
Créditos Uber One -$0.10
Pagos
Visa ••••8803 (Fiorella mendoza) $2.10
30/10/26 4:55 p.m.
¿Quieres cambiar el método de pago? Cambiar`;

test("aviso real del Banco Guayaquil por un viaje de Uber: AMEX 1618, Transporte, con hora", () => {
  const p = parsearCorreoBancario("Banco Guayaquil <bancavirtual@bancoguayaquil.com>", "Detalle de tu consumo", AVISO_GUAYAQUIL_UBER);
  assert.equal(p.clase, "consumo");
  assert.equal(p.monto, 2.9);
  assert.equal(p.comercio, "UBER BV USDNUSD ECUADOR");
  assert.equal(p.tarjetaFinal, "1618");
  assert.equal(p.fecha, "2026-11-05");
  assert.equal(p.pagadoEn, "2026-11-05T20:05:36-05:00");
  assert.equal(p.categoriaSugerida, "Transporte");
});

test("recibo real de Uber: el total (no la tarifa), la tarjeta 8803 y la hora del cobro (no la del correo)", () => {
  // El asunto no dice «viaje»: se reconoce por el cuerpo.
  const p = parsearCorreoBancario("Uber Receipts <noreply@uber.com>", "Tu recibo de Uber", RECIBO_UBER_REAL);
  assert.equal(p.clase, "consumo");
  assert.equal(p.monto, 2.1);
  assert.equal(p.tarjetaFinal, "8803");
  assert.equal(p.fecha, "2026-10-30");
  assert.equal(p.pagadoEn, "2026-10-30T16:55:00-05:00");
  assert.equal(p.comercio, "Uber");
});
