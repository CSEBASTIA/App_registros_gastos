import { test } from "node:test";
import assert from "node:assert/strict";
import { bancoDeRemitente, parsearCorreoBancario } from "../src/lib/correoBancario.ts";

// Lista de ejemplo (la real está vacía hasta tener remitentes verificados).
const remitentes = {
  banco_guayaquil: ["bancoguayaquil.com"],
  pichincha: ["avisos@pichincha.com"],
};

test("bancoDeRemitente: acepta el dominio exacto, sus subdominios y la dirección exacta", () => {
  assert.equal(bancoDeRemitente("notificaciones@bancoguayaquil.com", remitentes), "banco_guayaquil");
  assert.equal(bancoDeRemitente("alertas@mail.bancoguayaquil.com", remitentes), "banco_guayaquil");
  assert.equal(bancoDeRemitente("Banco Guayaquil <Avisos@BancoGuayaquil.com>", remitentes), "banco_guayaquil");
  assert.equal(bancoDeRemitente("avisos@pichincha.com", remitentes), "pichincha");
});

test("bancoDeRemitente: rechaza remitentes que solo contienen el nombre del banco", () => {
  // Con el `includes` anterior, todos estos pasaban como banco.
  assert.equal(bancoDeRemitente("avisos@bancoguayaquil.com.estafa.net", remitentes), undefined);
  assert.equal(bancoDeRemitente("avisos@falso-bancoguayaquil.com", remitentes), undefined);
  assert.equal(bancoDeRemitente("otro@pichincha.com", remitentes), undefined); // dirección exacta exigida
  assert.equal(bancoDeRemitente("avisos@pichincha.com.evil.io", remitentes), undefined);
  // El nombre visible no cuenta: manda la dirección entre < >.
  assert.equal(bancoDeRemitente("avisos@pichincha.com <ladron@evil.io>", remitentes), undefined);
});

test("bancoDeRemitente: con la lista vacía no adivina nada", () => {
  assert.equal(bancoDeRemitente("notificaciones@bancoguayaquil.com", {}), undefined);
});

test("REMITENTES_BANCO: reconoce los avisos de movimientos de Pichincha, Guayaquil y Pacífico", () => {
  assert.equal(bancoDeRemitente("banco@pichincha.com"), "pichincha");
  assert.equal(bancoDeRemitente("BancoGuayaquil <BancoGuayaquil@bancoguayaquil.com>"), "banco_guayaquil");
  assert.equal(bancoDeRemitente("bancavirtual@bancoguayaquil.com"), "banco_guayaquil");
  assert.equal(bancoDeRemitente("intermail@bancopacifico.ec"), "banco_pacifico");
});

test("REMITENTES_BANCO: la publicidad, los ingresos a la banca y los falsos no cuentan como banco", () => {
  assert.equal(bancoDeRemitente("info@email.bancoguayaquil.com"), undefined); // publicidad del mismo dominio
  assert.equal(bancoDeRemitente("logininfo@pichincha.com"), undefined); // aviso de ingreso, no un movimiento
  assert.equal(bancoDeRemitente("comunicados@pichincha.com"), undefined);
  assert.equal(bancoDeRemitente("banco@pichincha.com.evil.io"), undefined);
  assert.equal(bancoDeRemitente("intermail@bancopacifico.ec.estafa.net"), undefined);
});

test("parsearCorreoBancario: los asuntos reales de Pacífico y Guayaquil se leen como ingreso, envío y pago de tarjeta", () => {
  // Montos y cuentas inventados: solo se prueba que el asunto real activa el tipo correcto.
  const recibido = parsearCorreoBancario("intermail@bancopacifico.ec", "Banca Móvil: has recibido dinero", "Monto: $10.00");
  assert.equal(recibido.tipo, "ingreso");
  assert.equal(recibido.banco, "banco_pacifico");
  assert.equal(recibido.monto, 10);

  const enviado = parsearCorreoBancario("intermail@bancopacifico.ec", "Banca Móvil: has realizado un envío de dinero", "Monto: $5.50");
  assert.equal(enviado.tipo, "gasto");

  const pagoTarjeta = parsearCorreoBancario("bancavirtual@bancoguayaquil.com", "PAGO TARJETA PROPIA", "Valor: $20.00");
  assert.equal(pagoTarjeta.tipo, "gasto");
  assert.equal(pagoTarjeta.banco, "banco_guayaquil");

  const consumo = parsearCorreoBancario("bancoguayaquil@bancoguayaquil.com", "Realizó un consumo por $7.25 en un comercio", "");
  assert.equal(consumo.tipo, "gasto");
  assert.equal(consumo.monto, 7.25);
});
