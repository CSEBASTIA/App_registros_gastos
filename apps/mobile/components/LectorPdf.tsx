import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { HTML_LECTOR_PDF } from "../lib/lectorPdfPagina";
import { ClienteLectorPdf, type LectorPdfRef } from "../lib/lectorPdfCliente";
import { cargarCodigoPdfjs } from "../lib/archivosImportacion";

export { ErrorClavePdf, type LectorPdfRef } from "../lib/lectorPdfCliente";

/**
 * Lector de PDF invisible para el teléfono: pdf.js dentro de un WebView sin
 * acceso a internet (ver lib/lectorPdfPagina.ts). En la web se usa
 * `LectorPdf.web.tsx` (iframe). Se monta solo en la pantalla de importar.
 */
const LectorPdf = forwardRef<LectorPdfRef>(function LectorPdf(_props, ref) {
  const webview = useRef<WebView>(null);
  const cliente = useRef<ClienteLectorPdf>();
  cliente.current ??= new ClienteLectorPdf((m) => webview.current?.postMessage(m), cargarCodigoPdfjs);

  useEffect(() => () => cliente.current?.cerrar(), []);
  useImperativeHandle(ref, () => ({ leer: (base64, clave) => cliente.current!.leer(base64, clave) }));

  return (
    // 1×1 y transparente: un WebView de tamaño cero puede no ejecutar nada en Android.
    <View
      style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <WebView
        ref={webview}
        source={{ html: HTML_LECTOR_PDF }}
        originWhitelist={["*"]}
        // Nunca navega a ningún sitio: solo la página propia y los blob: que crea.
        onShouldStartLoadWithRequest={(r) => /^(about|data|blob):/.test(r.url)}
        onMessage={(e) => cliente.current?.recibir(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
});

export default LectorPdf;
