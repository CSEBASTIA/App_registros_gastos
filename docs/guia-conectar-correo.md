# Guía: conectar Gmail y Outlook (16-oct-2026)

Lo que la app ya hace, lo que te toca crear en Microsoft y en Google (no se puede hacer desde el código) y cómo comprobar en un teléfono que funciona. Función **opcional y en beta**: sin estos pasos la app se usa completa; solo los botones «Conectar» quedan inactivos y dicen «(aún no disponible)».

## 1. Estado

| Pieza | Estado |
|---|---|
| Flujo de Outlook (OAuth con PKCE, Microsoft Graph, paginación, renovación del permiso, desconexión) | Hecho |
| Flujo de Gmail (OAuth con PKCE, Gmail API, paginación, renovación, revocación ante Google) | Hecho; **cambiado hoy a cliente de tipo Android** (ver §2) |
| Bandeja de revisión, confirmación atómica, borrado al desconectar, olvido al cerrar sesión | Hecho (15-oct) |
| Crear los identificadores (Client ID) en Azure y en Google Cloud | **Te toca a ti** (§3 y §4) |
| Probar con una cuenta real en un teléfono | **Pendiente** hasta tener los Client ID (§6) |
| Lista de remitentes de bancos (`REMITENTES_BANCO`) | **Hecha para Pichincha, Banco Guayaquil y Banco del Pacífico**, con direcciones exactas vistas en una bandeja real (16-oct; solo remitente y asunto, sin montos ni datos personales). Faltan Produbanco, Diners Club y Banco del Austro: no hubo avisos de ellos; su banco se elige a mano en la Bandeja |
| Lectura del cuerpo de los avisos reales (monto, tipo, últimos dígitos) | **Sin comprobar**: solo se miraron remitentes y asuntos. Con un aviso real de cada banco (datos tachados) se ajusta el lector |
| Verificación de Google para `gmail.readonly` | Pendiente; necesaria antes de abrir la función al público (§7) |

## 2. Qué cambió en el código hoy

- **Gmail usaba un cliente «Web», que no funciona en un teléfono.** Google exige un secreto para ese tipo (no puede ir dentro de la app) y no admite la vuelta a la app. Ahora se usa un cliente de tipo **Android**: sin secreto, ligado al paquete `com.csebastia.gastosapp` y a la huella SHA-1 de la firma. La app vuelve por `com.csebastia.gastosapp:/oauthredirect`; ese esquema ya está en el manifiesto que genera Expo (no hace falta compilar de nuevo por esto).
- **Variable nueva:** `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (reemplaza a `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, que nunca llegó a funcionar).
- **Gmail solo en Android** por ahora. En iOS y web el botón queda inactivo.
- **Gmail lee menos:** la búsqueda deja fuera las pestañas Promociones, Social y Foros (`consultaGmail` en core, con prueba).
- **Outlook pregunta con qué cuenta entrar** (`prompt=select_account`); antes reusaba en silencio la que estuviera abierta en el navegador del teléfono.
- Mensajes de error de «falta configurar» más claros; la guía y el README apuntan aquí.

## 3. Outlook (Microsoft Entra ID)

1. Entra a [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Nombre: `FinTrack`. Tipos de cuenta: **«Accounts in any organizational directory and personal Microsoft accounts»** (si eliges menos, las cuentas @outlook.com / @hotmail.com no podrán entrar).
3. **Redirect URI**: plataforma **«Public client / native (mobile & desktop)»**, valor exacto `gastosapp://redirect`.
4. En **Authentication → Advanced settings**: **Allow public client flows → Yes**.
5. En **API permissions → Add a permission → Microsoft Graph → Delegated**: `Mail.Read` (los demás —`openid`, `profile`, `offline_access`— la app los pide sola).
6. **No crees ningún «client secret».** Copia el **Application (client) ID** y úsalo como `EXPO_PUBLIC_MS_CLIENT_ID`.

Notas: con cuentas de empresa o colegio, el administrador del dominio puede bloquear el permiso (`AADSTS65001`). Microsoft muestra «aplicación no verificada» hasta que verifiques el editor; para tus pruebas es normal.

## 4. Gmail (Google Cloud)

1. En [console.cloud.google.com](https://console.cloud.google.com) crea el proyecto `FinTrack`.
2. **APIs y servicios → Biblioteca → Gmail API → Habilitar.**
3. **Pantalla de consentimiento OAuth** (Google Auth Platform): tipo **Externo**, nombre de la app, correo de soporte, y agrega el permiso `https://www.googleapis.com/auth/gmail.readonly`. Déjala en **Prueba** y agrega en **Usuarios de prueba** las cuentas de Gmail que van a probar (máximo 100). *En modo de prueba el permiso de cada persona caduca a los 7 días: hay que reconectar.*
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Tipo: Android.**
   - Nombre del paquete: `com.csebastia.gastosapp`.
   - **Huella SHA-1 del certificado de firma:** sácala con `eas credentials` (Android → el perfil que vas a instalar). Un cliente Android admite **una sola** huella, así que necesitas **un cliente por firma**: uno para el APK de prueba (perfil `preview`) y otro para la versión de Google Play (huella de «Firma de la app» en Play Console → Integridad de la app).
5. Abre el cliente → **Configuración avanzada** → habilita **«Esquema de URI personalizado»**. Google lo trae apagado para clientes Android nuevos y sin él da «invalid request». Puede tardar de 5 minutos a unas horas en aplicarse.
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) como `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

## 5. Poner los identificadores en la app

Son identificadores **públicos** (quedan dentro de la app, igual que la clave `anon` de Supabase); nunca pongas un secreto.

- En desarrollo: `apps/mobile/.env` (copia las dos líneas de `.env.example`).
- Para las compilaciones y actualizaciones: variables de EAS, una por entorno (`preview` y `production`, que son los de `eas.json`), con el cliente de Google que corresponda a la firma de cada entorno:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_MS_CLIENT_ID --value <id-de-azure> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value <id-de-google-preview> --visibility plaintext
```

Estos cambios son solo de JavaScript: se pueden publicar con `pnpm update:prueba` sobre el APK ya instalado (misma versión de la app), siempre que ese APK esté firmado con la huella que registraste en Google.

## 6. Prueba en un teléfono (checklist)

En *Más → Correo (beta)*:

1. **Outlook:** «Conectar Outlook» → elige la cuenta → acepta → debe decir «Outlook conectado». Envíate un correo con asunto «Compra tarjeta terminada en 1234» y cuerpo «Consumo por $12.50 el 16/10/2026» → «Buscar ahora» → aparece 1 movimiento en la Bandeja. Vuelve a buscar: no se duplica.
2. **Gmail:** lo mismo con «Conectar Gmail» (la cuenta debe estar en usuarios de prueba).
3. **Desconectar:** cada una debe borrar los avisos leídos. Comprueba que el permiso desapareció: Google en [myaccount.google.com/permissions](https://myaccount.google.com/permissions), Microsoft en [account.live.com/consent/Manage](https://account.live.com/consent/Manage).
4. **Cerrar sesión** y entrar con otra cuenta de FinTrack: el correo no debe seguir conectado.
5. **Retirar el permiso desde la cuenta de Google/Microsoft** y pulsar «Buscar ahora»: debe decir que el permiso venció y volver a «sin conectar».

| Si ves… | Causa probable |
|---|---|
| Google: «Acceso bloqueado» / `invalid_request` | Falta habilitar el esquema de URI personalizado (§4.5) o aún no se aplicó |
| Google: `access_denied` | La cuenta no está en usuarios de prueba |
| Google: `redirect_uri_mismatch` o «client not found» | El paquete o la huella SHA-1 del cliente no son los de la app instalada |
| Microsoft: `AADSTS50011` | El redirect registrado no es exactamente `gastosapp://redirect` |
| Microsoft: `AADSTS700016` | `EXPO_PUBLIC_MS_CLIENT_ID` equivocado o tipo de cuenta demasiado restringido |
| El botón dice «(aún no disponible)» | La app se compiló sin el Client ID (§5) o es iOS/web (Gmail) |

## 7. Seguridad y privacidad

- **Sin secretos en la app:** PKCE y clientes públicos (Android en Google; «cliente público» en Microsoft). Los Client ID son públicos por diseño.
- **Tokens** solo en `expo-secure-store` del teléfono, nunca en Supabase; se borran al desconectar y al cerrar sesión, y la conexión queda ligada a quien la hizo.
- **Permisos de solo lectura** (`gmail.readonly`, `Mail.Read`). Ninguno de los dos proveedores ofrece un permiso «solo avisos del banco»: técnicamente permiten leer toda la bandeja. Lo que hace la app para limitarlo: busca solo al pulsar «Buscar ahora», solo desde la última búsqueda (14 días la primera vez), deja fuera Promociones/Social/Foros en Gmail, analiza el texto en el teléfono y guarda solo monto, fecha, banco y asunto de los avisos reconocidos. Nada se vuelve gasto sin confirmarlo.
- **Remitentes:** se reconocen por dirección exacta (nunca por dominio completo, porque el mismo dominio manda publicidad y avisos de ingreso). Un correo de otro remitente con monto y palabras de gasto/ingreso igual llega a la Bandeja, sin banco asignado, para revisión humana; no se verifica DKIM/SPF.
- **Cómo se obtuvo la lista:** con tu permiso, una búsqueda de solo lectura en tu Gmail de remitentes y asuntos de avisos bancarios. No se copió ningún monto, nombre ni cuerpo de correo al proyecto, y se borraron los resultados temporales de la búsqueda.
- **Antes de abrirlo al público:** `gmail.readonly` es un permiso *restringido*. Google exige verificar la app y, con permisos restringidos, una evaluación de seguridad anual por un tercero (CASA) además de cumplir su política de «uso limitado» de datos (sin anuncios, sin entregar los datos a terceros, solo para la función visible). Hasta entonces, déjala en modo de prueba y no la promociones. La política de privacidad ya describe el correo (sección 3 de `privacidad.html`); confirma allí el texto final antes de la revisión.
- La función «Correo» no debe declararse en Google Play como recopilada mientras esté apagada para el público (ver `docs/publicacion-produccion.md`).

## 8. Verificación de este cambio

| Comprobación | Resultado |
|---|---|
| Pruebas de core (todas) | 179/179. Las de correo pasaron de 11 a 15: `consultaGmail`, la lista de remitentes (reconoce, rechaza publicidad/ingresos a la banca/falsos) y los asuntos de Pacífico y Guayaquil (con montos inventados) |
| Tipos del teléfono (`tsc --noEmit`) | Sin errores, antes y después |
| Compilación del paquete Android (`expo export`) con dos Client ID de ejemplo | Compila (exit 0); el paquete lleva el Client ID de ejemplo y la redirección `<paquete>:/oauthredirect` |
| Ingreso con una cuenta real de Gmail y de Outlook, revocación ante Google | **No probado**: requiere los Client ID reales y un teléfono (§6) |

## 9. Fuentes consultadas

- Google: [restricciones del esquema de URI personalizado](https://developers.googleblog.com/en/improving-user-safety-in-oauth-flows-through-new-oauth-custom-uri-scheme-restrictions/) (los clientes Android nuevos lo traen apagado y se habilita en «Configuración avanzada»).
- Microsoft: [redirect URIs y clientes públicos](https://learn.microsoft.com/entra/identity-platform/reply-url) (plataforma «Mobile and desktop applications» y «Allow public client flows»).
