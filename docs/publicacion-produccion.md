# Configuración para producción

Lo que se configura fuera del código: en los paneles de Supabase, Vercel y Google Play. En cada punto se dice por qué hace falta.

## 1. Supabase (panel web)

**Authentication → URL Configuration**
- *Site URL*: `https://<tu-app>.vercel.app`.
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
- Comprueba que abra `https://<tu-app>.vercel.app/privacidad.html`.

## 3. Política de privacidad

`apps/mobile/public/privacidad.html` es un **borrador**. Antes de publicarla:
1. Completa todo lo que está entre [corchetes]:
   - responsable;
   - correo de contacto;
   - región de Supabase (está en *Project Settings → General*);
   - plazos.
2. Haz que la revise un abogado. Aplica la Ley Orgánica de Protección de Datos Personales de Ecuador.
3. Si la app empieza a usar otro servicio (reportes de fallos, analítica), agrégalo a la política **antes** de activarlo.

## 4. Google Play Console

- **Política de privacidad**: `https://<tu-app>.vercel.app/privacidad.html`.
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

La app no recopila ubicación, contactos, identificadores del dispositivo ni datos de uso, y no usa analítica ni publicidad. Si eso cambia, hay que actualizar este formulario y la política de privacidad.
