/**
 * Página que corre dentro del WebView oculto de `components/LectorPdf.tsx`
 * (en la web, dentro de un iframe aislado: `LectorPdf.web.tsx`).
 * Recibe el código de pdf.js (empaquetado en la app, ver assets/pdfjs) y el
 * PDF en base64, y devuelve los fragmentos de texto de cada página con su
 * posición; core arma las líneas (`lineasDeTextoPdf`).
 *
 * Seguridad: la política de contenido no permite ninguna conexión de red
 * (`default-src 'none'`, sin `connect-src` a internet): el estado de cuenta
 * no puede salir del teléfono aunque pdf.js lo intentara. Tampoco se permite
 * `eval` (`isEvalSupported: false`).
 *
 * Mensajes (JSON):
 *   página → app: {tipo:"pagina"} al cargar; {tipo:"listo"} con pdf.js cargado;
 *                 {tipo:"resultado", id, paginas}; {tipo:"error", id, mensaje, clave?}
 *   app → página: {tipo:"codigo", pdf, worker}; {tipo:"leer", id, base64, clave?}
 */
export const SCRIPT_LECTOR_PDF = `
(function () {
  var listo = null;
  // En el teléfono responde al WebView; en la web, a la página que contiene el iframe.
  function enviar(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
    else if (window.parent !== window) window.parent.postMessage(JSON.stringify(m), "*");
  }
  function urlDeCodigo(codigo) {
    return URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
  }
  async function cargar(codigoPdf, codigoWorker) {
    // Primero el worker: define globalThis.pdfjsWorker y pdf.js trabaja en
    // este mismo hilo (sin crear un Worker aparte).
    await import(urlDeCodigo(codigoWorker));
    return import(urlDeCodigo(codigoPdf));
  }
  function bytesDeBase64(b64) {
    var binario = atob(b64);
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }
  async function leer(pdfjs, m) {
    var documento = await pdfjs.getDocument({
      data: bytesDeBase64(m.base64),
      password: m.clave || undefined,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0, // solo errores: sin avisos de fuentes que no hacen falta para leer texto
    }).promise;
    try {
      var paginas = [];
      for (var n = 1; n <= documento.numPages; n++) {
        var pagina = await documento.getPage(n);
        var contenido = await pagina.getTextContent();
        paginas.push(
          contenido.items
            .filter(function (it) { return typeof it.str === "string" && it.transform; })
            .map(function (it) { return { texto: it.str, x: it.transform[4], y: it.transform[5] }; })
        );
        pagina.cleanup();
      }
      return paginas;
    } finally {
      await documento.destroy();
    }
  }
  async function alMensaje(evento) {
    // En la web solo se aceptan mensajes de la página que contiene el iframe.
    if (evento.source && evento.source !== window.parent) return;
    var m;
    try { m = JSON.parse(evento.data); } catch (e) { return; }
    if (!m || typeof m !== "object") return;
    if (m.tipo === "codigo") {
      listo = cargar(m.pdf, m.worker);
      listo.then(
        function () { enviar({ tipo: "listo" }); },
        function (e) { enviar({ tipo: "error", id: null, mensaje: String((e && e.message) || e) }); }
      );
      return;
    }
    if (m.tipo === "leer") {
      try {
        if (!listo) throw new Error("El lector de PDF todavía no está listo.");
        var paginas = await leer(await listo, m);
        enviar({ tipo: "resultado", id: m.id, paginas: paginas });
      } catch (e) {
        var clave = e && e.name === "PasswordException" ? (e.code === 2 ? "incorrecta" : "necesaria") : undefined;
        enviar({ tipo: "error", id: m.id, mensaje: String((e && e.message) || e), clave: clave });
      }
    }
  }
  window.addEventListener("message", alMensaje);
  document.addEventListener("message", alMensaje);
  enviar({ tipo: "pagina" });
})();
`;

export const HTML_LECTOR_PDF = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src blob: data:; img-src blob: data:; style-src 'unsafe-inline'">
</head>
<body>
<script>${SCRIPT_LECTOR_PDF}</script>
</body>
</html>`;
