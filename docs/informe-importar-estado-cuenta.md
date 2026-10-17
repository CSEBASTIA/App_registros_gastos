# Informe: importar el estado de cuenta al agregar una cuenta (17-oct-2026)

**Pedido:** que al agregar una cuenta se pueda subir su estado de cuenta y que la app genere los movimientos (compras, etc.).
**Decisiones del usuario:** en el teléfono y en la web; en el teléfono el PDF se lee en el propio teléfono, no en un servidor.

## 1. Qué hace ahora

- **Al crear** una cuenta (ahorro o débito) o una tarjeta de crédito hay un botón nuevo: **«Agregar e importar estado de cuenta»**. Crea la cuenta y abre la importación para esa cuenta.
- **Para las que ya existen**: botón **«Importar estado de cuenta»** en el detalle de cada cuenta y tarjeta.
- Dónde: en el teléfono (Android), en la versión web que se publica en Vercel (sale del mismo código, `apps/mobile`) y en la app de escritorio (`apps/desktop`). En «Efectivo» no se ofrece.
- Pasos: elegir el archivo → (si el PDF tiene clave, escribirla) → revisar la lista → «Importar N movimientos».

**Qué propone la app** (todo se puede marcar o desmarcar antes de guardar):

| Caso | Qué hace |
|---|---|
| Consumos (compras, débitos) | Se proponen como **gastos**, marcados. Categoría sugerida (Ocio, Salud) u «Otros»; se cambia después en cada movimiento (en escritorio, también en la tabla). |
| Pagos a una tarjeta de crédito | **Se omiten** y se avisa cuántos: se registran con «Pagar tarjeta», que además descuenta de la cuenta de origen. |
| Abonos/depósitos en ahorro o débito | Se proponen como **ingresos**, pero **sin marcar**: el lector se pensó para tarjetas y en una cuenta de ahorro «pago realizado» puede ser una salida. |
| Ya registrado (misma fecha y monto, en cualquier cuenta) | Sale **sin marcar** como «posible duplicado». Cada movimiento ya registrado cubre una sola fila (dos cafés iguales y uno registrado → solo uno es duplicado). |
| Saldo | Muestra el saldo (o cupo disponible) **antes → después** de importar. La base resta cada gasto y suma cada ingreso, como al registrar a mano. |
| Supera el cupo de la tarjeta | Avisa y **no deja importar** hasta desmarcar consumos (ver §5). |
| Más de 300 filas | Toma las primeras 300 y lo avisa (no parece un estado de cuenta). |

**Formatos:** PDF original de la banca en línea (con texto; también con clave) y CSV/TXT. Un PDF **escaneado** (solo imagen) no se puede leer en el teléfono ni en la web de Vercel: la app lo dice y sugiere descargar el PDF original o un CSV. La app de escritorio sí lo lee (OCR, como antes).

**Guardado:** se valida todo antes de enviar (si una fila está mal, no se guarda nada) y los gastos van en **una sola escritura**: se guardan todos o ninguno. Antes la web de escritorio los mandaba de a uno (si fallaba el quinto, quedaban cuatro); ahora también la importación desde «Gastos» va en una sola escritura.

## 2. Cómo está hecho

**Core** (`packages/core`, compartido):
- `lib/importacionEstadoCuenta.ts`: `prepararFilasImportacion`, `resumenImportacion`, `movimientosParaGuardar`, `cupoInsuficiente`, `rangoDeFilas`, `textoResultadoImportacion`, `TOPE_FILAS_IMPORTACION`.
- `usecases/importarEstadoCuenta.ts`: `movimientosDelPeriodo` (lo ya registrado en el periodo, para duplicados), `importarMovimientos` (valida, revisa el cupo con datos recién leídos y guarda en lote), `ErrorImportacionParcial`.
- `repositories/gastos.repo.ts` / `ingresos.repo.ts`: `crearGastosEnLote`, `crearIngresosEnLote`.
- `lib/estadoCuenta.ts`: `lineasDeTextoPdf` y `paginaSinTexto` (antes vivían solo en la web de escritorio).

**Teléfono y web de Vercel** (`apps/mobile`):
- `app/importar-estado.tsx`: la pantalla (parámetro `cuentaId`).
- Lector de PDF: **pdf.js 4.10.38 empaquetado dentro de la app** (`assets/pdfjs/`, extensión `.pdfjs` registrada en `metro.config.js`), ejecutado en un **WebView** invisible en el teléfono (`components/LectorPdf.tsx`) y en un **iframe aislado** en la web (`LectorPdf.web.tsx`). La página del lector (`lib/lectorPdfPagina.ts`) y el protocolo (`lib/lectorPdfCliente.ts`) son los mismos en los dos.
- Archivos: `lib/archivosImportacion.ts` (leer el archivo elegido, borrar la copia temporal, cargar pdf.js).
- Dependencias nuevas (versiones del SDK 51): `expo-document-picker`, `expo-file-system`, `react-native-webview`. Son **módulos nativos**: la versión de la app sube a **1.3.0** (ver §6).

**Escritorio** (`apps/desktop`): `components/ImportarEstadoCuenta.tsx` acepta `cuentaFija` (usa la lógica de core: duplicados, ingresos, saldo, cupo y guardado en lote) y se abre desde «Nueva cuenta», «Nueva tarjeta» y el detalle de cada una.

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Pruebas de core (todas) | **199/199**. Nuevas: 20 en `importacionEstadoCuenta.test.ts` (filas, duplicados, ingresos, tope, saldo sin errores de coma flotante, categorías, guardado en una sola escritura, nada se guarda si una fila es inválida o si se pasa el cupo, error parcial, armado de líneas del PDF) |
| Pruebas del teléfono (JS) | **18/18**. Nuevas: 4 del protocolo del lector (respuesta por id, clave necesaria/incorrecta, pdf.js que no carga, cierre de pantalla) |
| Tipos (`tsc`) | Sin errores en core, teléfono y escritorio |
| Compilación | `expo export` Android y web (lo que corre Vercel): compilan y llevan `pdf.min.pdfjs` (398 kB) y `pdf.worker.min.pdfjs` (1,42 MB). `vite build` de escritorio: compila |
| Lector real en un navegador | La página del lector, con pdf.js empaquetado y la misma política de seguridad, leyó un PDF de prueba de 2 páginas (datos inventados): primero como en el WebView y después dentro de un iframe `sandbox`. Core sacó 3 consumos ($1.292,36 = el «Total a pagar» del PDF) y omitió el pago |
| Red bloqueada en el lector | Dentro de la página del lector, `fetch` y una imagen externa quedaron **bloqueados** por la política de contenido |
| Flujo completo en la web (Expo web, con una base falsa en el navegador: nada llegó a Supabase) | Ahorro: «Agregar e importar» → elegir PDF → 3 gastos marcados y el pago como ingreso sin marcar → «Importar» → **una** escritura con 3 gastos, categorías Otros/Ocio/Salud. Tarjeta con cupo $1.000: pago omitido, aviso de cupo y botón desactivado; al desmarcar FYBECA → una escritura con 2 gastos, método «crédito» |
| **No probado** | En un teléfono Android real (necesita compilar el APK 1.3.0); con estados de cuenta reales de tus bancos; PDF con clave real (el caso se probó con la página simulada); contra la base real |

## 4. Seguridad y privacidad

- **El estado de cuenta no sale del dispositivo.** Se lee en el teléfono (WebView) o en el navegador (iframe). pdf.js va dentro de la app (sin CDN). La página del lector tiene `default-src 'none'` y sin `connect-src` hacia afuera: aunque algo intentara enviar el PDF, el navegador lo bloquea (comprobado). El WebView no navega a ningún sitio (`onShouldStartLoadWithRequest`), no usa almacenamiento ni caché y no accede a archivos. El iframe de la web es `sandbox="allow-scripts"`: sin acceso a la sesión ni a la app; solo se aceptan mensajes de él y él solo acepta los de la app.
- **La copia del archivo se borra** de la caché del teléfono apenas se lee (también si falla). No se guarda el archivo, ni el texto, ni el nombre del archivo.
- **La clave del PDF** solo vive en memoria mientras se abre el archivo; no se guarda ni se envía.
- **Solo se guardan los movimientos que confirmas**, con los mismos datos que al registrarlos a mano (monto, descripción, fecha, categoría, cuenta). Pasan por la misma validación (zod) y por las mismas reglas de la base (RLS, disparadores de saldo).
- **Integridad:** validación completa antes de escribir; una sola escritura por tabla (todo o nada); revisión del cupo con datos recién leídos.
- **Política de privacidad:** no hay datos nuevos que se guarden ni terceros nuevos. Aun así, conviene mencionar que el estado de cuenta se lee en el dispositivo y no se guarda. Es un cambio de texto legal: hay que subir `version-legal` (ver la memoria del proyecto y `docs/legal/README.md`). No lo cambié.

## 5. Hallazgo en la base: el cupo y las escrituras en lote

La base valida el cupo **antes** de insertar cada gasto (`trg_03_validar_cupo_gasto`), pero descuenta el cupo **después** (`trg_aplicar_gasto_a_cuenta`, `after insert`). En una escritura de varias filas, Postgres ejecuta los «after» al final, así que **cada fila ve el cupo inicial**: varias filas juntas pueden pasar el cupo sin que la base lo frene. La app ahora lo revisa antes de guardar (`cupoInsuficiente`), pero cualquiera con su sesión podría mandar un lote directo a la API. Arreglo propuesto (migración aparte): una validación por sentencia (`after insert ... for each statement`, con la tabla de filas nuevas) que rechace si una tarjeta queda con cupo negativo, con su prueba en `supabase/tests`.

## 6. Lo que te toca

1. **Compilar un APK/AAB nuevo** con EAS (`pnpm build:apk` o `build:play`): la versión subió a **1.3.0** porque hay módulos nativos nuevos. Una actualización OTA (`eas update`) **no** sirve para esto, y gracias al cambio de versión no le llegará a los APK 1.2.0 (que no tienen esos módulos).
2. **Probar con estados de cuenta reales** de tus bancos (PDF con y sin clave, y CSV si el banco lo ofrece). El lector es genérico: si algún banco sale mal, pásame un estado con los datos tachados y lo ajusto.
3. La web de Vercel toma el cambio en el próximo despliegue de `main`; la app de escritorio, en su próxima compilación.
4. Decidir si se agrega la mención en la política de privacidad (§4) y si se hace la migración del cupo (§5).
