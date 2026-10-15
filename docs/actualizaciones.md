# App instalable con actualizaciones automáticas

La app de teléfono se instala **una vez** (EAS Build) y después recibe los cambios **sola** (EAS Update): al abrirla, descarga la versión nueva en segundo plano y la aplica la próxima vez que se abre. Funciona sin internet con la última versión descargada.

| Tipo de cambio | ¿Llega como actualización automática? |
|---|---|
| Pantallas, textos, lógica (`packages/core`), cálculos, imágenes | **Sí** → `pnpm update:prueba` / `update:produccion` |
| Librería nativa nueva, permisos, ícono, nombre, `app.json` nativo, actualizar Expo | **No** → subir `version` en `app.json` y compilar de nuevo |

## Lo que ya está configurado

- `apps/mobile/app.json`: identificador `com.csebastia.gastosapp` (se puede cambiar hasta publicar en Google Play; después es permanente), nombre "Gastos App", `runtimeVersion` = `version`, búsqueda de actualizaciones al abrir sin bloquear el arranque.
- `apps/mobile/eas.json`: perfil **preview** (APK para instalar directo, canal `preview`) y **production** (AAB para Google Play, canal `production`, número de versión automático).
- `expo-updates` 0.25.28 (la versión del SDK 51).
- `scripts/verificar-entorno-publicacion.mjs`: corre antes de cada compilación o actualización y la **frena** si la URL de Supabase es local o sin https, si la clave es la `service_role` (o cualquier clave secreta), o si quedó `EXPO_PUBLIC_SIN_LOGIN=1`.

## Configuración inicial (una sola vez, la haces tú)

Requiere Node, la cuenta de expo.dev y el Supabase en la nube (ver `docs/piloto.md`).

```bash
npm install -g eas-cli
cd apps/mobile
eas login                 # tu cuenta de expo.dev (la contraseña la escribes tú)
eas init                  # crea el proyecto en Expo y agrega su id a app.json
eas update:configure      # agrega la URL de actualizaciones a app.json
```

Variables de la app compilada (no van en git; la clave anon es pública por diseño, la `service_role` **nunca**):

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
# repetir con --environment production
```

Y el mismo par en `apps/mobile/.env.production` (ignorado por git), porque las **actualizaciones** se arman en tu computadora con ese archivo.

## Primera instalación

```bash
cd apps/mobile
pnpm build:apk            # verifica el entorno y compila el APK en los servidores de Expo
```

Al terminar, EAS da un enlace y un código QR: ábrelo en el celular, descarga el APK e instálalo (Android pedirá permitir "instalar apps de origen desconocido"). Si la compilación falla por la versión de Expo (SDK 51 es antiguo), avisar antes de seguir: puede requerir actualizar el SDK.

## Publicar un cambio

1. **Pruebas en verde**: `pnpm --filter core test`, `pnpm --filter desktop test`, `pnpm --filter mobile test` y `bash supabase/tests/correr.sh`.
2. **Primero la base**: si el cambio usa una migración nueva, aplicarla en el Supabase de la nube **antes** de publicar (`npx supabase db push`) y actualizar la tabla *Estado de despliegue* del README.
3. **Canal de prueba**: `pnpm update:prueba` → abrir la app instalada desde el APK de prueba, cerrarla y volver a abrirla.
4. **Producción**: si todo está bien, `pnpm update:produccion`.

### Si algo sale mal

```bash
eas update:list                      # ver las actualizaciones publicadas
eas update:republish --group <id>    # volver a publicar la versión anterior que funcionaba
```

## Reglas para no romper a nadie

- **Migraciones compatibles hacia atrás**: puede haber teléfonos con la versión anterior. Agregar columnas o funciones nuevas sí; renombrar o borrar lo que una versión vieja usa, no (hacerlo en dos pasos: primero la app deja de usarlo, después se borra).
- **Cambio nativo = nueva versión**: si se agrega una librería nativa o se toca la configuración nativa, subir `version` en `app.json` (por ejemplo 1.0.0 → 1.1.0) y compilar. Así las apps viejas no reciben código que no podrían ejecutar.
- **Nada secreto en la app**: todo lo que empieza con `EXPO_PUBLIC_` se puede leer descargando la app. La protección de los datos es RLS.
- **Firma de actualizaciones** (recomendada para producción): EAS Update permite firmar cada actualización con una clave que solo tú tienes, para que nadie pueda colar una versión alterada. Revisar si el plan de Expo que uses la incluye antes de activarla: si la app exige firma y el servidor no la envía, las actualizaciones se rechazan.

## Pendiente antes de Google Play

Ícono y pantalla de inicio propios (estilo Zallox, agente de base visual), política de privacidad, formulario de seguridad de datos de Play, opción de borrar la cuenta, y apuntar a la versión de Android que exija Play (con SDK 51 probablemente haga falta actualizar Expo).
