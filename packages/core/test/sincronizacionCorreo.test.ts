import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisosDeCorreos,
  consultaGmail,
  cuentaParaAviso,
  desdeParaSincronizar,
  enLotes,
  esPermisoRetirado,
  juntarPaginas,
  resumenSincronizacion,
  TOPE_CORREOS,
  type CorreoRecibido,
} from "../src/lib/sincronizacionCorreo.ts";
import type { Cuenta } from "../src/types/domain.ts";

test("juntarPaginas: sigue las páginas hasta el final", async () => {
  const paginas: Record<string, { items: number[]; siguiente?: string }> = {
    inicio: { items: [1, 2], siguiente: "b" },
    b: { items: [3, 4], siguiente: "c" },
    c: { items: [5] },
  };
  const r = await juntarPaginas(async (token) => paginas[token ?? "inicio"], 100);
  assert.deepEqual(r, { items: [1, 2, 3, 4, 5], truncado: false });
});

test("juntarPaginas: se detiene en el tope y avisa que quedó incompleto", async () => {
  let pedidas = 0;
  const r = await juntarPaginas(async () => {
    pedidas += 1;
    return { items: [1, 2, 3], siguiente: "otra" };
  }, 7);
  assert.equal(r.items.length, 7);
  assert.equal(r.truncado, true);
  assert.equal(pedidas, 3, "no pide páginas de más");

  const justo = await juntarPaginas(async () => ({ items: [1, 2, 3] }), 3);
  assert.equal(justo.truncado, false, "exactamente el tope sin más páginas no es truncado");
});

test("enLotes: un fallo no tumba a los demás y respeta la simultaneidad", async () => {
  let enCurso = 0;
  let maximo = 0;
  const r = await enLotes([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    enCurso += 1;
    maximo = Math.max(maximo, enCurso);
    await new Promise((ok) => setTimeout(ok, 5));
    enCurso -= 1;
    if (n === 4) throw new Error("correo ilegible");
    return n * 10;
  });
  assert.deepEqual(r.resultados, [10, 20, 30, 50, 60, 70]);
  assert.equal(r.fallidos, 1);
  assert.equal((r.primerError as Error).message, "correo ilegible");
  assert.ok(maximo <= 3);
});

test("desdeParaSincronizar: primera vez 14 días; después, la marca con 10 min de solape", () => {
  const ahora = new Date("2026-10-15T20:00:00Z");
  assert.equal(desdeParaSincronizar(null, ahora).toISOString(), "2026-10-01T20:00:00.000Z");
  assert.equal(desdeParaSincronizar("2026-10-15T18:00:00.000Z", ahora).toISOString(), "2026-10-15T17:50:00.000Z");
  // Una marca dañada o en el futuro no deja la búsqueda en blanco para siempre.
  assert.equal(desdeParaSincronizar("basura", ahora).toISOString(), "2026-10-01T20:00:00.000Z");
  assert.equal(desdeParaSincronizar("2030-01-01T00:00:00.000Z", ahora).toISOString(), "2026-10-01T20:00:00.000Z");
});

test("consultaGmail: filtra por fecha en segundos y deja fuera las pestañas de publicidad", () => {
  const q = consultaGmail(new Date("2026-10-15T18:00:00.000Z"));
  assert.equal(q, "after:1792087200 -category:promotions -category:social -category:forums");
  // Los milisegundos se descartan (Gmail solo entiende segundos).
  assert.equal(consultaGmail(new Date(1_792_087_200_999)), q);
});

test("esPermisoRetirado: reconoce invalid_grant en sus distintas formas", () => {
  assert.equal(esPermisoRetirado({ code: "invalid_grant" }), true);
  assert.equal(esPermisoRetirado({ error: "invalid_grant" }), true);
  assert.equal(esPermisoRetirado(new Error("TokenError: invalid_grant: Token has been expired or revoked.")), true);
  assert.equal(esPermisoRetirado(new Error("Network request failed")), false);
  assert.equal(esPermisoRetirado(undefined), false);
});

const cuenta = (id: string, banco: Cuenta["banco"], identificador?: string): Cuenta =>
  ({ id, nombre: id, tipo: "ahorro", banco, identificador, disponible: 0 }) as Cuenta;

test("cuentaParaAviso: única del banco, por últimos dígitos, o a mano si es ambiguo", () => {
  const cuentas = [cuenta("a", "pichincha"), cuenta("b", "banco_guayaquil", "1234"), cuenta("c", "banco_guayaquil", "9999")];
  assert.equal(cuentaParaAviso(cuentas, "pichincha", undefined), "a");
  assert.equal(cuentaParaAviso(cuentas, "banco_guayaquil", "9999"), "c");
  assert.equal(cuentaParaAviso(cuentas, "banco_guayaquil", undefined), undefined);
  assert.equal(cuentaParaAviso(cuentas, undefined, "1234"), undefined);
});

test("avisosDeCorreos: arma los avisos y omite correos sin monto o sin tipo", () => {
  const correos: CorreoRecibido[] = [
    { mensajeId: "1", remitente: "x@y.com", asunto: "Consumo con tu tarjeta", cuerpoTexto: "Valor $12,50 el 14/10/2026", fecha: "2026-10-15" },
    { mensajeId: "2", remitente: "x@y.com", asunto: "Boletín de noticias", cuerpoTexto: "Hola", fecha: "2026-10-15" },
    { mensajeId: "3", remitente: "x@y.com", asunto: "Depósito recibido", cuerpoTexto: "sin monto", fecha: "2026-10-15" },
    { mensajeId: "4", remitente: "x@y.com", asunto: "Transferencia recibida", cuerpoTexto: "Valor $100.00", fecha: "2026-10-15" },
  ];
  const avisos = avisosDeCorreos(correos, []);
  assert.deepEqual(
    avisos.map((a) => [a.mensajeId, a.tipo, a.monto, a.fecha]),
    [
      ["1", "gasto", 12.5, "2026-10-14"],
      ["4", "ingreso", 100, "2026-10-15"], // sin fecha en el texto: la de recepción
    ]
  );
});

test("resumenSincronizacion: cuenta lo enviado y avisa de lo omitido, truncado o fallido", () => {
  assert.equal(
    resumenSincronizacion({ revisados: 3, enviados: 0, descartados: 0, truncado: false, fallidos: 0 }),
    "No encontré movimientos nuevos que reconocer."
  );
  const completo = resumenSincronizacion({ revisados: 600, enviados: 4, descartados: 1, truncado: true, fallidos: 2 });
  assert.match(completo, /Encontré 4 movimiento/);
  assert.match(completo, /1 aviso\(s\) tenían datos imposibles/);
  assert.match(completo, new RegExp(`más de ${TOPE_CORREOS} correos`));
  assert.match(completo, /No se pudieron leer 2 correo/);
});
