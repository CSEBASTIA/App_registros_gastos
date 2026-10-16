# Guía: registrar los pagos de Apple Pay con un atajo del iPhone

Cada vez que pagas con Apple Pay, el iPhone envía el pago a la **bandeja** de FinTrack. Ahí lo revisas y lo confirmas con un toque. **Nada se guarda como gasto sin tu confirmación.**

**Necesitas:**

- Un iPhone con **iOS 17 o más nuevo**.
- Una tarjeta en Wallet. En Ecuador, Apple Pay funciona con Produbanco, Banco Guayaquil y Bolivariano.
- Tu **clave de captura**, que se crea en la app en *Más → Conectar Apple Pay* y empieza con `ft_`.

No necesitas una app de FinTrack para iPhone: el atajo habla directo con el servidor, y la bandeja la revisas desde la versión web o desde Android.

## 1. Crea la clave en la app

1. En *Más → Conectar Apple Pay*, toca **Crear clave** y ponle un nombre, por ejemplo «Mi iPhone».
2. **Cópiala ahora**: solo se muestra una vez. Si la pierdes, revócala y crea otra.
3. Anota también los dos datos que muestra esa pantalla:
   - la **dirección**, que termina en `/rest/v1/rpc/registrar_pago_billetera`;
   - la **clave pública**, que empieza con `sb_publishable_`.

## 2. Crea la automatización en Atajos

Los nombres pueden variar un poco según la versión de iOS. Entre paréntesis va el nombre en inglés.

1. Abre **Atajos**, pestaña **Automatización** y toca **+** → **Nueva automatización**.
2. Elige **Transacción** (*Transaction*), en la sección Wallet.
3. Marca las tarjetas que quieras registrar. Deja las categorías como están.
4. Elige **Ejecutar inmediatamente** (*Run Immediately*) y desactiva «Notificar al ejecutar» si no quieres el aviso. Toca **Siguiente** → **Nuevo atajo en blanco**.
5. Agrega la acción **Obtener ubicación actual** (*Get Current Location*). Es opcional: sin ella, el pago llega sin lugar.
6. Agrega la acción **Obtener contenido de URL** (*Get Contents of URL*) y configúrala así:
   - **URL**: la dirección del paso 1.
   - **Método**: `POST`.
   - **Encabezados**: `apikey` con la clave pública, y `Content-Type` con `application/json`.
   - **Cuerpo de la solicitud**: JSON, con estos campos:

| Campo | Tipo | Valor |
|---|---|---|
| `p_clave` | Texto | Tu clave `ft_…` |
| `p_monto` | Texto | Variable **Entrada del atajo → Importe** (*Amount*) |
| `p_comercio` | Texto | Variable **Entrada del atajo → Comerciante** (*Merchant*) |
| `p_tarjeta` | Texto | Variable **Entrada del atajo → Tarjeta o pase** (*Card or Pass*) |
| `p_latitud` | Número | Variable **Ubicación actual → Latitud** |
| `p_longitud` | Número | Variable **Ubicación actual → Longitud** |

7. (Opcional) Agrega **Mostrar notificación** con el resultado de la URL para ver «recibido» después de cada pago.
8. Toca **OK**. La primera vez, iOS puede pedir permiso para que Atajos use tu ubicación y se conecte al servidor: acepta.

## 3. Pruébalo

Haz una compra pequeña con Apple Pay. En unos segundos debe aparecer en la **bandeja** con el comercio, el monto y, si diste la ubicación, el lugar.

**Si la tarjeta tiene el nombre del banco** (por ejemplo «Produbanco Visa»), la app la reconoce sola. Si tienes varias tarjetas de ese banco, pon sus últimos 4 dígitos en *Cuentas → editar → Identificador*. Si no la reconoce, la eliges al confirmar.

## Si algo falla

| Lo que responde | Qué significa | Qué hacer |
|---|---|---|
| `"estado": "recibido"` | Llegó bien | Revísalo en la bandeja |
| `"estado": "repetido"` | El atajo se ejecutó dos veces por el mismo pago | Nada: quedó un solo aviso |
| `Clave no válida` (403) | La clave está mal copiada o fue revocada | Copia la clave de nuevo o crea otra |
| `Monto no válido` (400) | El iPhone envió el monto en un formato desconocido (por ejemplo, otra moneda) | Envía una captura del mensaje para ajustar el lector |
| `Demasiados avisos` (429) | Más de 30 avisos en una hora o 200 en un día con esa clave | Espera; si no fuiste tú, revoca la clave |

**Importante:**

- El atajo se ejecuta al acercar el iPhone, **aunque después el pago sea rechazado**. Por eso todo llega a la bandeja para que lo revises.
- Las fuentes que confirman qué bancos aceptan Apple Pay son de 2024. Revisa la página de Apple si tu banco no aparece.

## Seguridad

- **Trata la clave como una contraseña.** La base guarda solo su huella: ni nosotros podemos leerla. Con ella solo se pueden dejar avisos pendientes; no se pueden leer tus datos ni crear gastos.
- **La clave va en el cuerpo, nunca en la URL.** Las URLs quedan en los registros de los servidores; si la pones ahí, el servidor rechaza la petición.
- **Revoca la clave si pierdes el iPhone** o si ves avisos que no reconoces, en *Más → Conectar Apple Pay*. Puedes tener hasta 5, una por dispositivo.
- **Si compartes el atajo, no incluyas tu clave.** Usa «Preguntas de importación» (*Import Questions*) en el campo `p_clave`, para que cada persona ponga la suya al instalarlo.
- **La clave pública que va en el encabezado `apikey` es pública por diseño**: está dentro de la app. Lo que autoriza el registro es la clave de captura.
