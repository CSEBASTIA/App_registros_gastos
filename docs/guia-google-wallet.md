# Guía · Conectar Google Wallet (Android)

Cada pago con Google Wallet llega solo a la **bandeja** para que lo confirmes, como el atajo de Apple Pay en el iPhone.

## Cómo funciona

1. Al pagar, Google Wallet muestra una notificación (por ejemplo «SUPERMAXI · $12,50 con Visa •••• 1234»).
2. FinTrack lee **solo las notificaciones de Google Wallet** y envía su título y su texto a tu base, con una clave de captura de este teléfono.
3. La base (`registrar_aviso_billetera`) lee el monto, el comercio y los últimos dígitos, y deja el aviso en la bandeja. Si la tarjeta coincide con una de tus cuentas, el aviso ya viene con esa cuenta.

**Qué se ignora:**

- Las notificaciones de las demás apps: no se leen ni se guardan.
- Las de Google Wallet que no traen monto, como «tu tarjeta está lista».
- Los pagos rechazados y los reembolsos.

**Sin internet:** el aviso se guarda en el teléfono (hasta 20, durante 3 días) y se envía con la siguiente notificación o al abrir la pantalla. Llega con la fecha del pago, no con la del envío.

## Configurarlo en el teléfono

Necesitas la app **1.1.0 o más nueva** (el APK nuevo; la captura usa un módulo nativo).

1. FinTrack → **Más → Conectar Google Wallet → Conectar**. Se crea una clave solo para este teléfono; no hace falta copiarla.
2. **Abrir ajustes de Android** → activa «FinTrack: pagos con Google Wallet» en *Acceso a notificaciones*.
   - **Si dice «Ajuste restringido»** (Android 13 o más nuevo, con la app instalada desde un APK y no desde Play Store): Ajustes → Apps → FinTrack → menú ⋮ → **Permitir ajustes restringidos**, y vuelve a intentarlo.
3. Paga con Google Wallet. En la pantalla verás «Último aviso: llegó a la bandeja un pago de $12,50».

**Desconectar:** en la misma pantalla. Revoca la clave y borra del teléfono la clave y los avisos pendientes. También puedes quitar el permiso desde los ajustes de Android.

## Mientras no tengas el APK nuevo: MacroDroid o Tasker

La misma función de la base sirve para una automatización de Android:

- **Disparador:** notificación recibida de la app *Google Wallet*.
- **Acción:** solicitud HTTP **POST** a `https://<tu-proyecto>.supabase.co/rest/v1/rpc/registrar_aviso_billetera`.
- **Encabezados:** `apikey: <clave pública de Supabase>` y `Content-Type: application/json`.
- **Cuerpo:**

  ```json
  {"p_clave": "<clave de captura>", "p_titulo": "<título de la notificación>", "p_texto": "<texto de la notificación>"}
  ```

  En MacroDroid, el título y el texto se insertan con sus variables de notificación; el nombre exacto depende de la versión.
- **La clave de captura** se crea en *Más → Conectar Apple Pay → Crear una clave* (las claves sirven para los dos). Va en el cuerpo, nunca en la dirección.

## Si un pago no llega o llega mal

El formato de las notificaciones lo decide Google y puede cambiar. Como la lectura vive en la base, se corrige con una actualización de la base, **sin publicar otra versión de la app**. Para ajustarla, toma una captura de pantalla de la notificación (puedes tapar los dígitos de la tarjeta).

## Seguridad y privacidad

- **La clave de captura** solo sirve para dejar avisos en tu bandeja. Tiene límite de uso (30 por hora y 200 por día), se puede revocar, y la base guarda solo su huella.
  - En el teléfono se guarda en el almacenamiento privado de la app.
  - No sale de ahí: la pantalla solo muestra sus 6 primeros caracteres.
- **Solo se aceptan avisos de la app de Google Wallet** (`com.google.android.apps.walletnfcrel`).
- **Los textos se limpian y se acortan** en la base (500 caracteres como máximo). En la bandeja solo se guardan el monto, el comercio y los últimos dígitos, no la notificación completa.
- **Play Store:** el acceso a notificaciones se explica en la pantalla antes de pedirlo. En *Seguridad de los datos* corresponde declarar «Información financiera: historial de compras».
