import { test } from "node:test";
import assert from "node:assert/strict";
import { bancoDeRemitente } from "../src/lib/correoBancario.ts";

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
  assert.equal(bancoDeRemitente("notificaciones@bancoguayaquil.com"), undefined);
});
