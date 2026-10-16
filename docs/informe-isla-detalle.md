# Informe · Isla de detalle, mapa, hora del pago y semana de hoy

16 de octubre de 2026 · no se subió nada a GitHub (estos cambios no están en el commit de las 15:40)

**Resultado: hecho y probado** en el teléfono y en su versión web. La hora del pago necesita aplicar una actualización de la base (ver abajo).

## Qué hace

### Isla de detalle

Al tocar una transacción se abre una **isla**: una tarjeta oscura que flota sobre la pantalla, como la isla dinámica del iPhone.

| Dónde | Cómo se abre | Qué muestra |
|---|---|---|
| **Gastos** | Tocar un gasto | Mapa, ID, fecha, **hora del pago**, hora en que se registró, lugar, ubicación, categoría, método con la billetera («Crédito con Apple Pay»), cuenta, diferido y factura |
| **Ingresos** | Tocar un ingreso | ID, fecha, hora en que se registró, fuente y cuenta |
| **Bandeja** | Botón «Ver detalles (id, hora, lugar)» | Mapa, ID del aviso, quién lo detectó, hora del pago, fecha, comercio, banco, tarjeta (•••• 4321), cuenta y asunto del correo |

- Solo aparecen los datos que la transacción tiene.
- **Acciones:** Copiar ID, Ver lugar, Eliminar y Cerrar. También se cierra tocando afuera o con el botón atrás de Android.
- Mantener presionado un gasto o ingreso sigue sirviendo para eliminarlo, y ahora la confirmación también funciona en la versión web.

### Mapa de dónde se pagó

- Arriba de la isla aparece un mapa con un **alfiler en el punto del pago** y un círculo azul con la precisión del GPS. Tocarlo abre la app de Mapas.
- Si el gasto no tiene ubicación pero sí un lugar elegido, el mapa muestra ese lugar.
- **Google Wallet no tiene mapa:** la isla dice «Los pagos con Google Wallet llegan sin ubicación: con la app cerrada, el teléfono no puede leerla».
- Usa imágenes de **OpenStreetMap** (con su atribución, que es obligatoria). No necesita nada nativo: funciona en el APK actual y en la web.

### Hora real del pago

- Al confirmar en la bandeja un aviso de **Apple Pay o Google Wallet**, el gasto guarda la hora en que pagaste, no la hora en que lo confirmaste. La isla la muestra como «Hora del pago», arriba de «Registrado».
- Si el teléfono envió el aviso de Google Wallet tarde (sin internet), se usa la hora de la notificación.
- Los gastos del correo o anotados a mano no tienen hora del pago: muestran solo «Registrado».
- Los gastos que confirmaste antes de esta actualización no se pueden completar, porque el aviso no guardaba a qué gasto dio origen.

### Gastos abre en la semana de hoy

- Al entrar en Gastos, la semana se elige sola. Hoy, 16, es la **semana 3** (15–21); desde el 22, la **4**. Del 1 al 7 es la 1 y del 8 al 14, la 2.
- Al cambiar de mes: el mes actual abre en la semana de hoy y los demás, en la 1.
- Si la app queda abierta y cambia el día, al volver a Gastos salta al mes y la semana de ese día.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (todas las migraciones desde cero) | **266 de 266** (6 nuevas, `supabase/tests/hora_del_pago.sql`) |
| Pruebas de lógica | **169 de 169** (13 nuevas: `detalleTransaccion.test.ts` y `mapaEstatico.test.ts`) |
| Pruebas del teléfono | 14 de 14 |
| TypeScript en core, teléfono y web | Sin errores |
| Navegador (sin login, con datos simulados; en escritorio y a 375 px) | Gastos abrió solo en «Semana 3 (15–21)» con el gasto del 16, y ocultó el del día 3. La isla mostró el mapa (las 9 imágenes cargaron, con el alfiler y el círculo), «Hora del pago: 16 oct 2026, 12:05» y «Registrado: 14:32». El ingreso y el aviso de la bandeja también se abren. Sin errores en la consola. |

**Las pruebas de base cubren:**

- Google Wallet guarda en el aviso la hora de la notificación (de hace 2 días).
- Al confirmar, con Apple Pay el gasto lleva la hora en que llegó el aviso, no la de confirmación. Con Google Wallet atrasado, la de la notificación y su fecha; sin hora de notificación, la de llegada.
- Correo y gastos a mano quedan sin hora del pago.
- Una hora absurda (1990) se rechaza.

**Las pruebas de lógica cubren:** las fechas en español, la hora de Ecuador, las filas que se ocultan, la hora del pago antes de «Registrado», el cálculo de las semanas, las imágenes correctas alrededor de Quito, el punto en el centro, el círculo de precisión y el mapa que da la vuelta en 180°.

## Lo que hay que saber

- **Copiar en el navegador del panel de pruebas** no está permitido, y ahí se vio el aviso «No se pudo copiar». En un navegador normal y en el teléfono sí copia.
- **La web de escritorio** (`apps/desktop`) no tiene la isla.
- **OpenStreetMap** permite este uso para apps con poco tráfico. Si la app crece mucho, conviene cambiar a un proveedor de mapas con plan; se cambia en una sola línea (`PLANTILLA_TESELAS`).

## Actualización de la base para pegar en el SQL Editor

Carpeta `supabase/para-supabase-web/16-10-2026 4PM/`, archivo `1 - gastos, transacciones_detectadas (hora del pago).sql` (Migración de hora del pago). Va **después** de todos los de `16-10-2026 4AM/` y `16-10-2026 5AM/`, y debe terminar con `aplicada = sí`.

Sin esta actualización la app funciona igual, solo que sin «Hora del pago».

## Seguridad y privacidad

- **Mapa:** al abrir el detalle de una transacción con ubicación, el teléfono le pide las imágenes a OpenStreetMap. Ese servidor ve la zona aproximada (unos 600 m) y la IP del teléfono, pero no el monto ni quién eres. Las imágenes solo se piden al abrir el detalle, nunca en segundo plano. **Conviene mencionarlo en la política de privacidad.**
- **Hora del pago:** se escribe solo dentro de la función que confirma el aviso, con las reglas de acceso de siempre. La base rechaza horas fuera de 2000–2100.
- **La isla** no hace consultas nuevas: muestra datos que la pantalla ya había cargado.
- **Sin SQL dinámico.**
