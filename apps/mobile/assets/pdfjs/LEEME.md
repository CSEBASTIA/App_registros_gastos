# pdf.js para el lector de estados de cuenta

Copia sin cambios de `pdfjs-dist@4.10.38` (versión «legacy», con compatibilidad para WebView antiguos), licencia Apache 2.0 (ver `LICENSE`).

- `pdf.min.pdfjs` = `legacy/build/pdf.min.mjs`
- `pdf.worker.min.pdfjs` = `legacy/build/pdf.worker.min.mjs`

La extensión `.pdfjs` hace que Metro los empaquete como archivos (ver `metro.config.js`) y no como código de la app. `components/LectorPdf.tsx` los carga dentro de un WebView sin acceso a internet: el PDF del estado de cuenta se lee en el teléfono y no sale de él.

Para actualizar: copiar los dos archivos de la nueva versión de `pdfjs-dist` con estos mismos nombres y la licencia, y probar la lectura (ver `docs/informe-importar-estado-cuenta.md`).
