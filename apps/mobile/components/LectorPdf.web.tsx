import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { HTML_LECTOR_PDF } from "../lib/lectorPdfPagina";
import { ClienteLectorPdf, type LectorPdfRef } from "../lib/lectorPdfCliente";
import { cargarCodigoPdfjs } from "../lib/archivosImportacion";

export { ErrorClavePdf, type LectorPdfRef } from "../lib/lectorPdfCliente";

/**
 * Versión web del lector: la misma página que en el teléfono, dentro de un
 * iframe `sandbox` (sin acceso a la sesión ni al resto de la app) y con la
 * misma política que no deja conectarse a internet. El PDF se lee en el
 * navegador; no se sube a ningún servidor.
 */
const LectorPdf = forwardRef<LectorPdfRef>(function LectorPdf(_props, ref) {
  const marco = useRef<HTMLIFrameElement>(null);
  const cliente = useRef<ClienteLectorPdf>();
  cliente.current ??= new ClienteLectorPdf(
    (m) => marco.current?.contentWindow?.postMessage(m, "*"),
    cargarCodigoPdfjs
  );

  // useLayoutEffect: escucha antes de que el iframe alcance a cargar y avisar «pagina».
  useLayoutEffect(() => {
    const alMensaje = (e: MessageEvent) => {
      if (e.source && e.source === marco.current?.contentWindow) cliente.current?.recibir(e.data);
    };
    window.addEventListener("message", alMensaje);
    return () => {
      window.removeEventListener("message", alMensaje);
      cliente.current?.cerrar();
    };
  }, []);
  useImperativeHandle(ref, () => ({ leer: (base64, clave) => cliente.current!.leer(base64, clave) }));

  return (
    <iframe
      ref={marco}
      title="Lector de PDF"
      aria-hidden
      tabIndex={-1}
      sandbox="allow-scripts"
      srcDoc={HTML_LECTOR_PDF}
      style={{ position: "absolute", width: 1, height: 1, opacity: 0, border: 0, pointerEvents: "none" }}
    />
  );
});

export default LectorPdf;
