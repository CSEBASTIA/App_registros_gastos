# Cómo atender los derechos de las personas

Cuando alguien escribe pidiendo **ver, corregir, llevarse o borrar sus datos** (o retirar su consentimiento), esta es la ruta. La ley de protección de datos de Ecuador te da **15 días** para responder (la política promete 15 días desde que recibes la solicitud). Responder y ejercer estos derechos **no se cobra**.

> Los plazos exactos (calendario u hábiles, y si el plazo se pausa al pedir una aclaración) están como pregunta para el abogado en [`README.md`](README.md). Mientras tanto, cuenta 15 días corridos.

## 1. Cuando llega la solicitud

1. **Anota la fecha de recepción.** Crea `docs/legal/privado/solicitudes/AAAA-MM-DD-<alias>.md` (esa carpeta no se sube a Git) con: fecha, canal, derecho pedido, qué hiciste y fecha de respuesta.
2. **Comprueba que es la persona.** La solicitud debe llegar **desde el correo de la cuenta**.
   - Si llega desde otro correo, **no entregues nada**: responde al correo de la cuenta pidiendo que confirme.
   - No pidas cédula ni documentos de más: el correo de la cuenta basta. Pídelos solo si tienes una duda seria.
3. **Ejecuta según el derecho** (siguiente tabla) y **responde dentro del plazo**.

## 2. Qué hacer según lo que pide

| Pide | Qué haces |
|---|---|
| **Información** (qué datos tienen y para qué) | Respóndele con la política de privacidad y el [registro de tratamiento](registro-tratamiento-datos.md), adaptado a su caso |
| **Acceso o portabilidad** (una copia de todo) | Sección 3: la copia sale en un JSON |
| **Rectificación** | Casi siempre puede hacerlo él en la app. Si no puede, pídele qué dato y corrígelo desde el SQL Editor, anotándolo en la solicitud |
| **Eliminación** | Si todavía tiene la app: *Más → Eliminar mi cuenta*. Si no: sección 4 |
| **Oposición o suspensión del tratamiento** | Las funciones opcionales (ubicación, correo, Apple Pay) las apaga él en la app; **no existe una pausa general de la cuenta**: ofrécele una copia y la eliminación (pregunta 3 para el abogado) |
| **Retirar el consentimiento** | De las funciones opcionales: se apagan en la app. Del uso del servicio: equivale a eliminar la cuenta |
| **Reclamo por una respuesta** | Dile que puede acudir a la Superintendencia de Protección de Datos Personales |

## 3. Sacar la copia de datos (acceso y portabilidad)

En el **SQL Editor** de Supabase (corre como administrador):

```sql
select public.exportar_datos_persona('correo.de.la.persona@ejemplo.com');
```

- Distingue mayúsculas y espacios del correo. Si no existe, dice «No existe una cuenta con ese correo.».
- Devuelve **un solo JSON** con la cuenta y todo lo suyo: cuentas, categorías propias, gastos, ingresos, deudas, abonos, pagos de tarjeta, presupuestos, recordatorios, avisos detectados, lugares, claves de captura (**sin la huella**, que es un secreto), las **aceptaciones legales** y la lista de nombres de sus facturas.
- Copia el resultado de esa celda a un archivo `exportacion-datos-<alias>.json`, **guárdalo en `docs/legal/privado/`** (o en una carpeta fuera del repositorio; `exportacion-datos-*.json` está ignorado en cualquier lado).
- **Las facturas** (los archivos) no van en el JSON: en *Storage → facturas → carpeta con el `id` de la persona* (el `id` está en `cuenta.id` del JSON) bájalas.
- **Entrégalo por un canal seguro**: archivo comprimido con contraseña por correo, y la contraseña **por otro canal** (por ejemplo, un mensaje de texto), o un enlace temporal. Nunca en claro por un chat abierto.
- Esta función **solo la puede correr la administración**: la app y la API no tienen permiso (está probado).

## 4. Eliminar a una persona que ya no tiene la app

El orden importa: Supabase no borra archivos con SQL y el panel de usuarios no borra los archivos de Storage.

1. **Saca una copia antes** si te la pide (sección 3) o si hay duda: lo que se borra no vuelve.
2. **Storage → facturas → carpeta con el `id` de la persona**: borra los archivos.
3. **Authentication → Users → la persona → Delete user.** Sus datos de todas las tablas se borran en cascada (incluida la constancia de aceptación): una prueba de base garantiza que **toda** tabla con `usuario_id` se borra así.
4. **Comprueba**: `select public.exportar_datos_persona('el.correo@ejemplo.com');` debe responder «No existe una cuenta con ese correo.».
5. **Responde** confirmando la eliminación y aclarando que las copias de respaldo del proveedor desaparecen solas en [número] días (el mismo plazo de la política).
6. Anota todo en la solicitud (sin copiar los datos borrados).

## 5. Plantillas de respuesta

**Recibido** (dentro de los 2 días):
> Hola. Recibimos tu solicitud del [fecha] para [ejercer tu derecho de …]. La atenderemos como máximo el [fecha + 15 días]. Si necesitamos confirmar algo, te escribiremos a este mismo correo.

**Entrega de la copia:**
> Hola. Adjuntamos la copia de tus datos en formato JSON, protegida con contraseña (te la enviamos por [otro canal]). Incluye tu cuenta, tus movimientos, tus preferencias y la constancia de lo que aceptaste. Tus facturas van en un segundo archivo. Si no estás conforme con esta respuesta, puedes acudir a la Superintendencia de Protección de Datos Personales.

**Eliminación confirmada:**
> Hola. Eliminamos tu cuenta y todos tus datos y facturas el [fecha]. Las copias de respaldo de nuestro proveedor desaparecen solas en un máximo de [número] días. No podemos recuperar nada de lo borrado.

## 6. Qué no hacer

- No entregues datos a un correo distinto del de la cuenta, ni a un tercero «de parte» de la persona sin una autorización clara (consúltalo con el abogado).
- No pidas más datos de los necesarios para comprobar quién es.
- No cobres ni condiciones la respuesta.
- No guardes la copia entregada más tiempo del necesario: bórrala cuando confirme que la recibió.
- No subas nada de `docs/legal/privado/` a Git (está ignorado; no lo fuerces con `git add -f`).
