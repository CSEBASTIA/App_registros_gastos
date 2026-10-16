# Informe · Fase 4 de billeteras: captura de Google Wallet

16 de octubre de 2026 · plan: `docs/plan-billeteras-y-ubicacion.docx` · guía: `docs/guia-google-wallet.md` · no se subió nada a GitHub

**Resultado: hecho y probado, salvo el módulo nativo de Android, que no se pudo compilar aquí**: esta máquina no tiene el SDK de Android. Se comprueba en el próximo APK (ver «Lo que falta»).

## Qué hace

En Android, cada pago con Google Wallet llega solo a la bandeja, como el atajo de Apple Pay en el iPhone:

1. Al pagar, Google Wallet muestra su notificación.
2. FinTrack lee **solo las notificaciones de Google Wallet** (las demás se ignoran sin leerlas) y envía su título y su texto con una clave de captura de este teléfono.
3. La base lee el monto, el comercio y los últimos dígitos, reconoce la tarjeta si coincide con una de tus cuentas, y deja el aviso en la bandeja para que lo confirmes.

**Decisión de diseño:** la lectura de la notificación vive en la base, no en el teléfono. Si Google cambia el formato, se corrige con una actualización de la base, **sin publicar otro APK**. Por la misma razón, también sirve para MacroDroid o Tasker mientras no tengas el APK nuevo (ver la guía).

**Detalles:**

- **Formatos que entiende:** «$12,50», «US$ 1.250,00», «USD 3.20» y «12,50 USD». El comercio sale del título, o del texto («Pagaste $8.75 en Farmacias Fybeca con…») si el título es genérico. La tarjeta, de «•••• 1234», «terminada en 1234» o «ending in 1234».
- **Se ignoran** los pagos rechazados, los reembolsos y los avisos sin monto («tu tarjeta está lista»).
- **Sin internet:** el aviso se guarda en el teléfono (hasta 20, durante 3 días) y se envía después, **con la fecha del pago**.
- **Repetidos:** si Android publica la misma notificación dos veces, queda un solo aviso.

**Pantalla «Conectar Google Wallet»** (Más → Conectar Google Wallet):

1. **Conectar:** crea una clave solo para este teléfono. Se guarda directo en el almacenamiento privado de la app, sin que tengas que copiarla.
2. **Permitir leer las notificaciones:** abre el ajuste de Android. Explica qué hacer si Android dice «Ajuste restringido», algo que pasa en Android 13 o más nuevo con apps instaladas desde un APK.
3. **Último aviso:** «Llegó a la bandeja un pago de $12.50 · hace 3 min», los pendientes y un botón para reintentar.
4. **Desconectar:** revoca la clave y la borra del teléfono.

En el iPhone, la pantalla lleva a Apple Pay. En la web, dice que es solo para el teléfono Android.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (32 migraciones desde cero) | **260 de 260** (19 nuevas, `supabase/tests/captura_google_wallet.sql`) |
| Pruebas de lógica | **155 de 155** (1 nueva en `clavesCaptura.test.ts`) |
| Pruebas del teléfono | 13 de 13 |
| TypeScript en core y teléfono | Sin errores |
| Enlazado automático de Expo | Encuentra el módulo `captura-billetera` y su clase `CapturaBilleteraModule` |
| Paquete de JavaScript para Android | Compila (3,78 MB) e incluye el módulo |
| Navegador | La entrada aparece en «Más». En la web, la pantalla muestra «Solo en el teléfono Android». |
| **Código nativo (Kotlin)** | **No compilado**: no hay SDK de Android en esta máquina |

**Las pruebas de base cubren:**

- **Lectura de la notificación:** comercio en el título; título genérico con el comercio en el texto; miles con punto; un comercio llamado «Guayaquil» que no se confunde con el banco; rechazado; sin monto; caracteres raros.
- **Llegada a la bandeja:** origen, monto, comercio, tarjeta y cuenta reconocidas, y fecha de hoy en Ecuador. La misma notificación dos veces deja un aviso; un rechazo no llega.
- **Fechas:** un aviso de hace 2 días queda con la fecha del pago; una hora de hace 20 días, o ilegible, se descarta.
- **Rechazos:** clave inventada, notificación de otra app, la función interna llamada desde afuera, y llamada con sesión de usuario (solo se acepta la clave pública).
- **search_path fijo** en las funciones nuevas.

## Lo que falta o no está comprobado

- **Compilar y probar en un teléfono:** el próximo APK (`build:apk`, que usa tus compilaciones de EAS) es la primera compilación del código Kotlin. Si falla, me pasas el error y lo corrijo. La versión sigue en 1.1.0, porque el APK 1.1.0 todavía no se había generado.
- **El formato real de tus notificaciones:** las pruebas usan formatos razonables, no capturas reales. Mándame 2 o 3 capturas de notificaciones de Google Wallet (puedes tapar los dígitos) y ajusto la lectura. Es solo una actualización de la base.
- **Google Wallet en Ecuador:** confirma que tus tarjetas se pueden agregar a Google Wallet. Si tu banco no lo admite, no habrá notificaciones que leer.
- **Ubicación:** estos avisos llegan sin ubicación, porque leerla con la app cerrada exigiría el permiso de ubicación en segundo plano, que la app bloquea a propósito.

## Actualización de la base para pegar en el SQL Editor

Carpeta `supabase/para-supabase-web/16-10-2026 5AM/`, archivo `5 - transacciones_detectadas, claves_captura (captura de Google Wallet).sql`. Va **después** del 4, y necesita los archivos de `16-10-2026 4AM/` (sobre todo el 3, el de Apple Pay). Debe terminar con `aplicada = sí`.

## Seguridad y privacidad

- **Solo Google Wallet:** el servicio de Android ignora el resto de las notificaciones sin leerlas, y la base rechaza cualquier otra app.
- **Clave de captura:**
  - Va en el cuerpo, nunca en la dirección.
  - En el teléfono vive en el almacenamiento privado de la app y nunca vuelve a JavaScript: la pantalla solo ve sus 6 primeros caracteres.
  - Tiene los mismos límites que la de Apple Pay (30 avisos por hora y 200 por día), se puede revocar, y la base guarda solo su huella.
- **Textos de terceros:** se limpian y se acortan a 500 caracteres. En la bandeja se guardan solo el monto, el comercio y los últimos dígitos, no la notificación completa.
- **Permisos:**
  - La función nueva solo la puede usar `anon`, como el atajo.
  - La función que lee el texto no se puede llamar desde afuera.
  - El servicio de Android solo acepta conexiones del sistema (`BIND_NOTIFICATION_LISTENER_SERVICE`).
- **Play Store:** el acceso a notificaciones se explica en la pantalla antes de pedirlo. En *Seguridad de los datos*, declarar «Información financiera: historial de compras». No lo agregué a `docs/publicacion-produccion.md`, porque esa parte la estaba editando la otra sesión.
- **Sin SQL dinámico.**
