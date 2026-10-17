// Protocolo entre la app y la página del lector de PDF (WebView en el
// teléfono, iframe en la web). La página real se probó en un navegador con
// pdf.js (ver docs/informe-importar-estado-cuenta.md); aquí se simula.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ClienteLectorPdf, ErrorClavePdf } from "../lib/lectorPdfCliente.ts";

/** Página falsa: responde como lib/lectorPdfPagina.ts. */
function montar(responder) {
  const enviados = [];
  let cargas = 0;
  const cliente = new ClienteLectorPdf(
    (texto) => {
      const m = JSON.parse(texto);
      enviados.push(m.tipo);
      setTimeout(() => {
        if (m.tipo === "codigo") cliente.recibir(JSON.stringify({ tipo: "listo" }));
        else {
          const r = responder(m);
          if (r) cliente.recibir(JSON.stringify(r));
        }
      }, 1);
    },
    async () => {
      cargas++;
      return { pdf: "PDF", worker: "WORKER" };
    }
  );
  cliente.recibir(JSON.stringify({ tipo: "pagina" }));
  return { cliente, enviados, cargas: () => cargas };
}

test("lee: entrega pdf.js al cargar la página (una vez) y empareja cada respuesta por id", async () => {
  const { cliente, enviados, cargas } = montar((m) => ({
    tipo: "resultado",
    id: m.id,
    paginas: [[{ texto: "HOLA " + m.base64, x: 1, y: 2 }]],
  }));
  const [p1, p2] = await Promise.all([cliente.leer("AAA"), cliente.leer("BBB")]);
  assert.equal(p1[0][0].texto, "HOLA AAA");
  assert.equal(p2[0][0].texto, "HOLA BBB");
  assert.deepEqual(enviados, ["codigo", "leer", "leer"]);
  assert.equal(cargas(), 1);
});

test("clave necesaria o incorrecta → ErrorClavePdf; otro error → mensaje claro", async () => {
  const { cliente } = montar((m) =>
    m.clave === "1234"
      ? { tipo: "resultado", id: m.id, paginas: [] }
      : { tipo: "error", id: m.id, mensaje: "PasswordException", clave: m.clave ? "incorrecta" : "necesaria" }
  );
  await assert.rejects(cliente.leer("X"), (e) => e instanceof ErrorClavePdf && e.motivo === "necesaria");
  await assert.rejects(cliente.leer("X", "mala"), (e) => e instanceof ErrorClavePdf && e.motivo === "incorrecta");
  assert.deepEqual(await cliente.leer("X", "1234"), []);

  const { cliente: otro } = montar((m) => ({ tipo: "error", id: m.id, mensaje: "Invalid PDF structure" }));
  await assert.rejects(otro.leer("X"), /No se pudo leer el PDF/);
});

test("si pdf.js no carga, leer falla con un mensaje y no se queda colgado", async () => {
  const cliente = new ClienteLectorPdf(
    () => {},
    async () => {
      throw new Error("sin asset");
    }
  );
  cliente.recibir(JSON.stringify({ tipo: "pagina" }));
  await assert.rejects(cliente.leer("X"), /No se pudo cargar el lector de PDF/);
});

test("cerrar rechaza las lecturas pendientes; los mensajes basura se ignoran", async () => {
  const { cliente } = montar(() => undefined); // nunca responde
  cliente.recibir("no es json");
  cliente.recibir(42);
  cliente.recibir(JSON.stringify({ tipo: "resultado", id: 999, paginas: [] })); // id desconocido
  const pendiente = cliente.leer("X");
  await new Promise((r) => setTimeout(r, 20));
  cliente.cerrar();
  await assert.rejects(pendiente, /Se cerró la pantalla/);
});
