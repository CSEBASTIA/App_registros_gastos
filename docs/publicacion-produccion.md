# Configuración para producción

Lo que se configura fuera del código: en los paneles de Supabase, Vercel y Google Play. En cada punto se dice por qué hace falta.

## 1. Supabase (panel web)

**Authentication → URL Configuration**
- Para la prueba actual solo con el APK: *Site URL* `gastosapp://confirmacion` y *Redirect URLs* `gastosapp://confirmacion`. Así los correos de registro vuelven al teléfono y no a `localhost`.
- Cuando la versión web esté lista para producción: *Site URL* `https://<tu-app>.vercel.app` y conserva `gastosapp://confirmacion` en *Redirect URLs*. El registro móvil envía esta dirección explícitamente.
- *Redirect URLs*: son las únicas direcciones a las que puede volver un enlace del correo. Sin ellas, "Olvidé mi contraseña" no funciona.
  - `gastosapp://**`: la app instalada.
  - `https://<tu-app>.vercel.app/**`: la versión web.
  - `exp://**`: solo mientras pruebas con Expo Go. **Quítala al publicar.**

**Authentication → Sign In / Providers → Email**
- *Minimum password length*: **8**.
- *Password requirements*: **letras y números**. Es la misma regla que valida la app (`validarContrasena`), así que no depende solo de ella.
- *Confirm email*: **activado** en producción. Para que los correos lleguen a cualquier persona hace falta un servicio de correo propio (ver abajo).

**Authentication → Emails → SMTP Settings**
- Configura un proveedor (Resend, Brevo, Amazon SES u otro). El servicio gratuito de Supabase solo envía a los miembros de tu equipo, y pocos por hora: los usuarios reales no recibirían el correo de confirmación ni el de recuperar la contraseña.

**SQL Editor**
- Aplica las migraciones de `supabase/para-supabase-web/` que falten. Cada una debe mostrar `aplicada = sí`.

**Plan**
- El plan gratis pausa el proyecto tras 7 días sin uso y no tiene respaldos automáticos. Para usuarios reales conviene el plan Pro.

## 2. Vercel (versión web)

- *Root Directory*: `apps/mobile`. El resto de la configuración está en `apps/mobile/vercel.json`:
  - arma con `npx expo export -p web` y publica `dist`;
  - manda todas las rutas a la app, para que el enlace `/restablecer?code=…` no dé "404";
  - agrega cabeceras básicas de seguridad.
- *Environment Variables*:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: la clave **publishable**, nunca la *secret*.
  - `EXPO_PUBLIC_URL_PRIVACIDAD`: `https://<tu-app>.vercel.app/privacidad.html`.
  - `EXPO_PUBLIC_URL_TERMINOS`: `https://<tu-app>.vercel.app/terminos.html`.
  - `EXPO_PUBLIC_CORREO_PRIVACIDAD`: el correo de contacto de las páginas legales.
  - `EXPO_PUBLIC_EXIGIR_ACEPTACION`: **déjala vacía hasta aplicar las migraciones de aceptación** (paso 5 de la sección 3) y completar las páginas legales; después, `1`. Con `1`, el registro pide la casilla y quien inicia sesión sin haber aceptado pasa por la pantalla «Revisa y acepta». Si la pones en `1` antes de las migraciones, esa pantalla bloquea a todos.
  - Las mismas tres (y las dos de Supabase) van también en las variables de **EAS** (entornos `preview` y `production`) o en `apps/mobile/.env.production`: el `.env` no se sube a Git ni a EAS.
- Comprueba que abran `https://<tu-app>.vercel.app/privacidad.html` y `https://<tu-app>.vercel.app/terminos.html`.

## 3. Documentos legales

`apps/mobile/public/terminos.html` y `privacidad.html` son **borradores**. Todo el detalle (qué completar, qué decidí, preguntas para el abogado, cómo se mantienen) está en [`docs/legal/README.md`](legal/README.md). Antes de publicarlos:
1. Completa todo lo que está entre [corchetes] **en las dos páginas**:
   - responsable (nombre o razón social, cédula o RUC, ciudad);
   - correo de contacto;
   - fecha de publicación;
   - región de Supabase (está en *Project Settings → General*);
   - días de respaldos del proveedor.
2. Haz que los revise un abogado. Aplica la Ley Orgánica de Protección de Datos Personales de Ecuador, y los términos, la de Defensa del Consumidor.
3. Si la app empieza a usar otro servicio (reportes de fallos, analítica), agrégalo a la política y al [registro de tratamiento](legal/registro-tratamiento-datos.md) **antes** de activarlo, y sube la versión de la página (`version-legal` y `VERSION_LEGAL`).
4. `pnpm --filter mobile verificar:publicacion --produccion` debe terminar en ✔: **se niega a seguir** mientras quede un [dato por completar] o falte una de las tres variables. `build:play` y `update:produccion` ya lo corren.
5. **Aplica en Supabase las migraciones de aceptación y de exportación** (`para-supabase-web/16-10-2026 5AM/2 …` y `3 …`): sin ellas la app no puede guardar que la persona aceptó. Cada una debe mostrar `aplicada = sí`.
6. **Enciende la aceptación**: con las migraciones aplicadas y las páginas completas, pon `EXPO_PUBLIC_EXIGIR_ACEPTACION=1` (en Vercel, en EAS y en `.env.production`). Las pantallas ya están construidas y vienen **apagadas**: mientras la variable no sea `1`, la app no pide ni guarda la aceptación y no cambia nada para nadie. `build:play` y `update:produccion` se niegan a seguir si no es `1`. Ver «Documentos legales y aceptación» en `contrato-logica-core.md`.

## 4. Google Play Console

- **Política de privacidad**: `https://<tu-app>.vercel.app/privacidad.html`. Los términos no se piden en el formulario, pero la ficha de la tienda puede enlazarlos: `https://<tu-app>.vercel.app/terminos.html`.
- **Eliminación de la cuenta**:
  - Dentro de la app: *Más → Eliminar mi cuenta*. La pantalla está pendiente para el agente de interfaz; la lógica ya está.
  - Dirección web: `https://<tu-app>.vercel.app/privacidad.html#eliminar-cuenta`.
- **Acceso a la app**: como la app pide iniciar sesión, Google necesita una cuenta de prueba para revisarla. Crea una sin datos reales y pon sus credenciales en *Contenido de la app → Acceso a la app*.
- **Versión de Android**: Google Play exige apuntar a Android 15 o más reciente. Con Expo SDK 51 el armado se rechaza (es la fase 3).

### Seguridad de los datos (formulario de Google Play)

| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos? | Recopila. **No comparte**: Supabase, Vercel y Expo procesan los datos por encargo, y Google no cuenta eso como compartir |
| ¿Cifrado en tránsito? | Sí (HTTPS) |
| ¿Se puede pedir que se eliminen? | Sí: desde la app y en la dirección web de arriba |

| Tipo de dato | ¿Obligatorio? | Para qué |
|---|---|---|
| Información personal → Dirección de correo electrónico | Sí | Funcionalidad de la app, administración de la cuenta |
| Información financiera → Otra información financiera (gastos, ingresos, saldos, deudas) | Sí | Funcionalidad de la app |
| Fotos y videos / Archivos y documentos (facturas) | No | Funcionalidad de la app |
| Correos electrónicos (asunto, monto, fecha y banco de los avisos bancarios) | No | Funcionalidad de la app. **Solo si "Correo" está activo en producción**; mientras no tenga la verificación de Google, conviene ocultarlo y no declararlo |
| Ubicación → Ubicación precisa (desde la versión 1.1.0) | No | Funcionalidad de la app: el lugar de cada pago y el resumen por lugar. Solo si el usuario activa «Guardar la ubicación de mis pagos», solo con la app abierta (el permiso en segundo plano está bloqueado), redondeada a unos 11 m y borrable. Google la cuenta como "precisa" porque es más fina que 3 km² |

La app no recopila contactos, identificadores del dispositivo ni datos de uso, y no usa analítica ni publicidad. La ubicación solo se recopila si el usuario la activa (fila anterior). Si eso cambia, hay que actualizar este formulario y la política de privacidad.

**Una salvedad (16-oct):** la política de privacidad ahora dice, con honestidad, que el proveedor de inicio de sesión (Supabase) registra la dirección IP, el tipo de dispositivo o navegador y las fechas de sesión por seguridad. Eso lo hace Supabase, no código nuestro, pero **confirma en la ayuda de Google Play si debes declararlo** (por ejemplo, como «Identificadores de dispositivo u otros») para que el formulario y la política digan lo mismo. Además, la constancia de aceptación (documento, versión, plataforma y fecha, ligada a la cuenta) cuenta como «administración de la cuenta»: no es un tipo de dato nuevo.

**Otra salvedad (16-oct, mapa):** al abrir el detalle de un pago con ubicación, el teléfono pide las imágenes del mapa a los servidores de OpenStreetMap, que ven la dirección IP y la zona aproximada (cuadros de unos 600 m), pero no el monto. Google puede considerar eso «compartir» ubicación aproximada con un tercero (OpenStreetMap no actúa por encargo nuestro). **Confirma en la ayuda de Google Play cómo declararlo** antes de enviar el formulario: la fila de ubicación y la respuesta «No comparte» de arriba dependen de eso. La política ya lo dice en la sección 4. Alternativa que evita la duda: cargar el mapa solo cuando la persona toque «Ver mapa».
