import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlATexto, parsearCorreoBancario } from "../src/lib/correoBancario.ts";

/**
 * Textos con la ESTRUCTURA de los avisos reales de Banco Guayaquil y Banco
 * Pichincha del 17-oct-2026; nombres, tarjetas y cuentas son inventados.
 */

const GUAYAQUIL = "BancoGuayaquil@bancoguayaquil.com";
const COMPROBANTES = "bancavirtual@bancoguayaquil.com";
const PICHINCHA = "banco@pichincha.com";

const consumoGuayaquil = `0024-Consumo-Local-TC
Consumo nacional con tu tarjeta AMEX

| |
| # Detalle de tu consumo ## $12.34 TIENDA PRUEBA S A |

| |
| AMEX – 123456-XXXXX-1111------------------------------Consumo nacional 2026/10/17 A LAS 12:34:56------------------------------Fecha de corte 2026-11-17 |

[ | Centro de Ayuda[](https://ayuda.bancoguayaquil.com) Encuentra soluciones a tus dudas | | ]
Seguridad Te recordamos que Banco Guayaquil nunca te solicitará datos confidenciales.`;

test("Guayaquil: un consumo con tarjeta se lee completo y con la fecha del consumo, no la del corte", () => {
  const p = parsearCorreoBancario(GUAYAQUIL, "Ana realizó un consumo por $ 12.34 en TIENDA PRUEBA S A", consumoGuayaquil);
  assert.equal(p.clase, "consumo");
  assert.equal(p.tipo, "gasto");
  assert.equal(p.monto, 12.34);
  assert.equal(p.comercio, "TIENDA PRUEBA S A");
  assert.equal(p.tarjetaFinal, "1111");
  assert.equal(p.banco, "banco_guayaquil");
  assert.equal(p.fecha, "2026-10-17", "«Fecha de corte 2026-11-17» no es la fecha del consumo");
  assert.equal(p.pagadoEn, "2026-10-17T12:34:56-05:00");
  assert.equal(p.esTransferencia, false);
});

test("Guayaquil: el mismo consumo leído de un correo en HTML (como lo entrega Gmail al teléfono)", () => {
  const html = `<html><body><table><tr><td>Consumo nacional con tu tarjeta AMEX</td></tr>
    <tr><td><h1>Detalle de tu consumo</h1><h2>$12.34 TIENDA PRUEBA S A</h2></td></tr>
    <tr><td>AMEX – 123456-XXXXX-1111<br>Consumo nacional 2026/10/17 A LAS 12:34:56<br>Fecha de corte 2026-11-17</td></tr></table></body></html>`;
  const p = parsearCorreoBancario(GUAYAQUIL, "Ana realizó un consumo por $ 12.34 en TIENDA PRUEBA S A", htmlATexto(html));
  assert.equal(p.clase, "consumo");
  assert.equal(p.monto, 12.34);
  assert.equal(p.tarjetaFinal, "1111");
  assert.equal(p.fecha, "2026-10-17");
});

test("Guayaquil: sin el asunto, el consumo se lee del cuerpo", () => {
  const p = parsearCorreoBancario(GUAYAQUIL, "Aviso de tu tarjeta", consumoGuayaquil);
  assert.equal(p.clase, "consumo");
  assert.equal(p.monto, 12.34);
  assert.equal(p.comercio, "TIENDA PRUEBA S A");
});

const debitoPichincha = `| PRUEBA LOPEZ ANA Tu CEDULA termina en: ******* 0000 | |
| TARJETAS DE DÉBITO |
| Pago exitoso |
| Hola ANA, |
| El día 17/10/2026 a la(s) 10:30 tu pago con tu Tarjeta de Débito fué realizado exitosamente. |
| Monto | $ 50.00 |
| Comercio | Supermaxi |
| Fecha | 17/10/2026 |
| Número de tarjeta | ************9876 |
| Gracias por utilizar nuestros servicios. |`;

test("Pichincha: un pago con tarjeta de débito trae comercio, monto, tarjeta y hora", () => {
  const p = parsearCorreoBancario(PICHINCHA, "NOTIFICACION BANCO PICHINCHA", debitoPichincha);
  assert.equal(p.clase, "consumo");
  assert.equal(p.tipo, "gasto");
  assert.equal(p.monto, 50);
  assert.equal(p.comercio, "Supermaxi");
  assert.equal(p.tarjetaFinal, "9876");
  assert.equal(p.banco, "pichincha");
  assert.equal(p.fecha, "2026-10-17");
  assert.equal(p.pagadoEn, "2026-10-17T10:30:00-05:00");
});

const transferenciaExitosaPichincha = `| PRUEBA LOPEZ ANA Tu cédula termina en: ******* 0000 |
| ¡Transferencia exitosa! |
| Hola, ANA, |
| Realizaste una transferencia. |
| Detalle de la transacción Monto: Concepto |
| 5.00 |
| Cuenta de origen Número de cuenta: |
| ******5555 |
| Cuenta destino Nombre: Número de cuenta: |
| PEREZ GOMEZ JUAN ******4444 |
| Documento: Fecha: |
| 11112222 17/10/2026 |`;

test("Pichincha: «¡Transferencia exitosa!» (dentro del mismo banco) se lee con origen, destino y fecha", () => {
  const p = parsearCorreoBancario(PICHINCHA, "NOTIFICACION BANCO PICHINCHA", transferenciaExitosaPichincha);
  assert.equal(p.clase, "transferencia");
  assert.equal(p.esTransferencia, true);
  assert.equal(p.monto, 5);
  assert.equal(p.tarjetaFinal, "5555");
  assert.equal(p.contraparteFinal, "4444");
  assert.equal(p.contraparteBanco, "pichincha");
  assert.equal(p.fecha, "2026-10-17");
});

const transferenciaOtroBanco = `| Ana Prueba Tu cédula termina en: ******* 0000 |
| TRANSFERENCIA |
| Pago realizado correctamente |
| Detalle |
| Cuenta de origen: | ******5555 |
| Banco destino: | DE UNA |
| Cuenta acreditada: | ******9999 |
| Fecha: | 17/10/2026 |
| Nombre del beneficiario: | Juan Perez |
| Identificación beneficiario: | 1300000000 |
| Monto: | USD 7.5 |
| Número de documento: | 33334444 |`;

test("Pichincha: una transferencia a otro banco con «USD 7.5» (un solo decimal) se lee", () => {
  const p = parsearCorreoBancario(PICHINCHA, "NOTIFICACION BANCO PICHINCHA", transferenciaOtroBanco);
  assert.equal(p.clase, "transferencia");
  assert.equal(p.monto, 7.5);
  assert.equal(p.tarjetaFinal, "5555");
  assert.equal(p.contraparteFinal, "9999");
  assert.equal(p.contraparteBanco, undefined, "«DE UNA» no es un banco de la app");
  assert.equal(p.fecha, "2026-10-17");
});

test("Pichincha: el aviso previo «será debitada…» no se registra (el definitivo llega después)", () => {
  const previo = `TRANSFERENCIA La transferencia solicitada será debitada de su cuenta, y acreditada en la cuenta destino en 1 hora.
Detalle Cuenta de origen: | ******5555 | Cuenta destino: | ******9999 | Monto: | USD 5.00`;
  const p = parsearCorreoBancario(PICHINCHA, "NOTIFICACION BANCO PICHINCHA", previo);
  assert.equal(p.clase, undefined);
});

const pagoTarjetaGuayaquil = `0020_0021_Pago de tarjeta de crédito con débito a cuenta corriente o ahorro
El pago con débito a tu cuenta se realizó correctamente
| # Gracias por tu pago Hola, ANA Agradecemos el pago de tu tarjeta de crédito. Conoce los detalles de tu pago: |
| #### Pago realizado $50.00 #### Tarjeta de crédito AMEX #### Número 123456-XXXXX-2222 #### Pago con débito en AHO #### Número 0000-XXXX-21 #### Valor pendiente del mínimo a pagar $0.00 #### Fecha de débito 2026/10/17 13:45:00 |`;

test("Guayaquil: «Gracias por el pago de tu tarjeta» es un pago de tarjeta con su cuenta de origen", () => {
  const p = parsearCorreoBancario(GUAYAQUIL, "Gracias por el pago de tu tarjeta", pagoTarjetaGuayaquil);
  assert.equal(p.clase, "pago_tarjeta");
  assert.equal(p.tipo, "gasto");
  assert.equal(p.monto, 50);
  assert.equal(p.tarjetaFinal, "2222");
  assert.equal(p.contraparteFinal, "21");
  assert.equal(p.pagadoEn, "2026-10-17T13:45:00-05:00");
  assert.equal(p.esTransferencia, false, "un pago de tarjeta no es una transferencia entre cuentas");
});

const comprobanteTarjetaPropia = `Banco Guayaquil - Banca Virtual - Comprobante Transferencia
| Comprobante de PAGO TARJETA PROPIA Banca Móvil Personas Comprobante No.0001234 |
| Datos del Ordenante | |
| Titular Cuenta: | ANA PRUEBA. |
| No. de Cuenta: | XXXXXXX321 |
| Tipo de Cuenta: | AHORROS |
| Datos del Beneficiario | |
| Titular Tarjeta: | ANA PRUEBA. |
| No. de Tarjeta: | 3766XXXXXXXXX678 |
| Marca de Tarjeta: | AMERICAN EXPRESS |
| Valor Pagado: | $ 50.00 |
| Total Debitado | $ 50.00 |
| Concepto: | PAGO TARJETA PROPIA |
| Banca Móvil Personas 01H5 17/10/2026 13:45:00 SEC 0001234 Transacción exitosa |`;

test("Guayaquil: el comprobante «PAGO TARJETA PROPIA» es el mismo pago, con la tarjeta en 3 dígitos", () => {
  const p = parsearCorreoBancario(COMPROBANTES, "PAGO TARJETA PROPIA", comprobanteTarjetaPropia);
  assert.equal(p.clase, "pago_tarjeta");
  assert.equal(p.monto, 50);
  assert.equal(p.tarjetaFinal, "678");
  assert.equal(p.contraparteFinal, "321");
  assert.equal(p.pagadoEn, "2026-10-17T13:45:00-05:00");
});

const comprobanteInterbancario = `Comprobante de Transferencia Interbancaria Banca Móvil Personas Comprobante No.0000099999
| Datos del Ordenante | |
| Titular Cuenta: | ANA PRUEBA. |
| No. de Cuenta: | 000XXX4321 |
| Tipo de Cuenta: | AHORROS |
| Datos del Beneficiario | |
| Titular Cuenta: | ANA PRUEBA |
| No. de Cuenta: | 000XXX8765 |
| Tipo de Cuenta: | AHORROS |
| Banco de la Cuenta: | BANCO PICHINCHA |
| Valor Transferido: | $ 10.00 |
| Valor Comisión: | $ 0.50 |
| Total Debitado: | $ 10.50 |
| Concepto: | TRANSFERENCIA A OTRAS INSTITUCIONES FINANCIERAS |
| Banca Móvil Personas 01H5 19/10/2026 09:00:00 SEC 0000099999 Transacción exitosa |`;

test("Guayaquil: la transferencia interbancaria separa el valor transferido de la comisión", () => {
  const p = parsearCorreoBancario(COMPROBANTES, "TRANSFERENCIAS INTERBANCARIAS", comprobanteInterbancario);
  assert.equal(p.clase, "transferencia");
  assert.equal(p.esTransferencia, true);
  assert.equal(p.monto, 10, "el valor transferido, sin la comisión");
  assert.equal(p.comision, 0.5);
  assert.equal(p.tarjetaFinal, "4321");
  assert.equal(p.contraparteFinal, "8765");
  assert.equal(p.contraparteBanco, "pichincha");
  assert.equal(p.fecha, "2026-10-19");
});

test("un remitente que no es de un banco conocido no usa plantillas: no se registra solo", () => {
  const p = parsearCorreoBancario("avisos@banco-falso.net", "Ana realizó un consumo por $ 12.34 en TIENDA PRUEBA S A", consumoGuayaquil);
  assert.equal(p.clase, undefined);
  assert.equal(p.banco, undefined);
});

test("la fecha de un aviso genérico nunca es la de corte o vencimiento", () => {
  const p = parsearCorreoBancario(
    "intermail@bancopacifico.ec",
    "Banca Móvil: has realizado un envío de dinero",
    "Fecha de corte 2026-11-17. Fecha límite de pago 30/11/2026. Realizado el 16/10/2026. Monto: $5.50"
  );
  assert.equal(p.fecha, "2026-10-16");
  assert.equal(p.monto, 5.5);
});

test("sin fechas utilizables no inventa una: usa la de recepción (la pone quien llama)", () => {
  const p = parsearCorreoBancario(GUAYAQUIL, "Tu consumo", "Fecha de corte 2026-11-17 consumo $5.00");
  assert.equal(p.fecha, undefined);
});
