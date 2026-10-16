# Informe: términos, privacidad y documentación legal (16-oct-2026)

Todo es **borrador técnico**. Nada está revisado por un abogado ni verificado en el texto oficial de la ley (ver [Qué NO está verificado](#qué-no-está-verificado)).

## Qué se construyó

| Pieza | Dónde |
|---|---|
| **Términos y condiciones** (no existían): 14 secciones, en español de Ecuador | `apps/mobile/public/terminos.html` |
| **Política de privacidad** ampliada: aceptación guardada, atajo de Apple Pay, IP y dispositivo que registra Supabase, almacenamiento web, derechos explícitos (copia de datos), transferencia internacional con consentimiento, aviso de brechas, plazo de 15 días | `apps/mobile/public/privacidad.html` |
| Documentos internos: índice con lo que debes completar y 12 preguntas para el abogado; registro de tratamiento de datos; procedimiento de derechos; plan de incidentes | `docs/legal/` |
| **Constancia de aceptación** en la base (tabla de solo lectura, función, disparador en el registro) | `20261016210000_aceptaciones_legales.sql` |
| **Copia de datos de una persona** (acceso y portabilidad), solo administración | `20261016211000_exportar_datos_persona.sql` |
| Core: versiones, pendientes, repositorio de aceptaciones | `packages/core/src/lib/legal.ts`, `repositories/legal.repo.ts` |
| Entorno: `EXPO_PUBLIC_URL_TERMINOS`, `EXPO_PUBLIC_CORREO_PRIVACIDAD`; el verificador exige las tres variables y frena con datos `[por completar]` | `.env`, `.env.example`, `scripts/entornoPublicacion.mjs` |
| `.gitignore`: todas las variantes de `.env`, credenciales de servicios, carpeta privada de datos personales, copias de datos y volcados | `.gitignore` |
| Regla nueva del usuario: toda actualización de la base lleva **hora y qué es** | `preparar-migracion-web.sh`, carpeta `para-supabase-web/16-10-2026 5AM/` (archivos 2 y 3) |
| Contrato para las pantallas | `docs/contrato-logica-core.md` («Documentos legales y aceptación») |

Etiquetas de las dos migraciones (se pegan en orden, después del `1 - cuentas.sql`):
- **gastos-app — Migración de aceptación de términos y privacidad · 16-10-2026 5AM**
- **gastos-app — Migración de exportación de datos personales · 16-10-2026 5AM**

## Cómo se verificó

| Qué | Resultado |
|---|---|
| Batería completa de base (`bash supabase/tests/correr.sh`, Postgres desechable con las 31 migraciones) | **240 PASS, 0 FAIL** |
| Pruebas nuevas de base: `aceptaciones_legales.sql` / `exportar_datos_persona.sql` | **27/27** y **11/11** |
| Core (`node --test`) | **154/154** (15 nuevas) |
| Teléfono (`apps/mobile`) | **13/13** (7 nuevas o ampliadas del verificador) |
| Tipos (`tsc --noEmit`) en core y teléfono | **0 errores** |
| Verificador real (`pnpm --filter mobile verificar:publicacion --produccion`) | Frena con código 1 y lista las 3 variables y los 7 datos pendientes |
| `.gitignore` con `git check-ignore` sobre 19 rutas; y `git ls-files -ci` | Los `.env.example` siguen versionados; ningún archivo versionado quedó oculto |
| Vista de las dos páginas en el navegador, a 375 px y modo oscuro | Sin desbordes, versión visible, ancla `#eliminar-cuenta` funciona |
| Pruebas «mutantes» de las que atan texto y código (4 roturas provocadas) | Las 4 se detectan; los archivos quedaron idénticos al respaldo |

Lo que garantizan las pruebas de base: la aceptación se anota con la hora del servidor en el registro y por función; **no se puede insertar, modificar ni borrar a mano**; cada persona ve solo la suya; versiones inventadas o del futuro se rechazan; hay un tope de 50 por persona; **toda tabla con `usuario_id` se borra en cascada al eliminar la cuenta** (si alguien agrega una sin cascada, falla); la copia de datos incluye **todas** esas tablas, sin la huella de las claves de captura, y funciona con el rol `postgres` del SQL Editor.

## Errores que encontré en mi propio trabajo

1. **Choque de versión de migración**: otra sesión creó `20261016170000_recordatorios_diferidos.sql` mientras yo tenía otra con el mismo número. Renombré las mías a `…210000` y `…211000`, limpié la entrada vieja del índice de Git y avisé a esa sesión.
2. **Una prueba hueca**: `X10` terminaba en `rollback` y su resultado se descartaba (decía 9 pruebas, había escrito 10). Ahora usa `commit` y se ejecuta de verdad.
3. **Dos aserciones débiles** (`L13`, `L24`) corregidas.
4. **Hueco del verificador**: aceptaba `https://127.0.0.1/…` como dirección pública. Ahora rechaza direcciones locales (misma lista que la URL de Supabase).
5. **Un supuesto sin probar**: que la copia de datos sale completa desde el SQL Editor (rol `postgres`, no superusuario). Agregué `X11`.
6. **Contradicción documental**: la política ahora admite que Supabase registra IP y tipo de dispositivo; la guía de Google Play decía que no se recopilan identificadores. Quedó anotada la salvedad para confirmarla con Google.

## Qué NO está verificado

- **Validez legal.** Las fuentes fueron secundarias (EY, ECIJA, LEXIS, Derecho Ecuador…). No se verificó el texto oficial: por eso las páginas públicas no citan números de artículo. El plazo de 15 días (calendario u hábiles), si hace falta un delegado de protección de datos, el mecanismo para la transferencia internacional y desde cuándo corren los 5 días de una brecha están como **preguntas para el abogado**.
- **Las migraciones no se aplicaron en tu Supabase web.** Solo corrieron en el Postgres desechable. El disparador sobre `auth.users` se probó en la imagen de Supabase, no en tu proyecto.
- **Las pantallas están construidas pero apagadas** (adenda abajo): hasta que `EXPO_PUBLIC_EXIGIR_ACEPTACION=1`, la app **no pide ni guarda** la aceptación. El flujo completo con sesión real (registro, aceptación guardada, pantalla de aceptar, resumen) **no se probó**: hace falta una cuenta de prueba y las migraciones aplicadas en tu Supabase.
- **Los datos del responsable** (nombre, cédula o RUC, ciudad, correo, fecha, región, días de respaldos) siguen entre `[corchetes]`: no los tengo, y el verificador impide publicar así.
- La suite de base solo imprime conteos para los archivos cuyo formato lo permite; `diferidos_cupo_interes.sql` no muestra su cifra (formato anterior), pero no tiene ningún FAIL.

## Seguridad

- **Evidencia no manipulable**: la fecha de aceptación la pone el servidor; la tabla no tiene permisos de escritura para la API; las funciones con permisos elevados fijan `search_path`, validan entradas (documento, versión, plataforma; un texto con comillas se rechaza) y niegan a `anon`.
- **Datos personales fuera de Git**: `docs/legal/privado/` y `exportacion-datos-*.json` ignorados; `.env.*`, claves privadas, credenciales de Google y volcados de la base también. Comprobado que ningún archivo versionado se vio afectado.
- **Copia de datos**: solo administración (permiso revocado a `anon` y `authenticated`, y una segunda barrera dentro de la función si alguien lo concediera por error); no devuelve la huella de las claves; el procedimiento exige verificar el correo de la cuenta y entregar por canal seguro.
- **Variables públicas**: todo `EXPO_PUBLIC_*` queda dentro de la app; solo se agregaron direcciones y un correo de contacto, ya públicos. La cédula no va en ninguna variable.
- **Sin SQL dinámico** en las funciones nuevas; sin tiempos de espera nuevos que añadir (no hay llamadas de red en la lógica nueva salvo las de Supabase ya cubiertas por el cliente).

## Qué necesitas hacer tú

1. Completar los datos del responsable en las dos páginas (lista en [`docs/legal/README.md`](legal/README.md)).
2. Pegar en el SQL Editor, en orden, los archivos `2` y `3` de `supabase/para-supabase-web/16-10-2026 5AM/` (cada uno debe terminar con `aplicada = sí`).
3. Llevar los borradores a un abogado con la lista de preguntas.
4. Decidir quién construye las pantallas de aceptación (la lógica y el contrato están listos).

## Adenda: pantallas de aceptación (16-oct, a pedido del usuario)

Construidas según el contrato, **detrás del interruptor `EXPO_PUBLIC_EXIGIR_ACEPTACION=1`, apagado por defecto**. El motivo: `main` se despliega a producción en Vercel y la base de producción todavía no tiene las migraciones de aceptación; si la pantalla de aceptación estuviera siempre activa, bloquearía a todos. Con el interruptor apagado la app es **idéntica** a antes.

| Pieza | Archivo |
|---|---|
| Casilla en el registro (y los datos de aceptación en `signUp`) | `app/(auth)/registro.tsx`, `components/Casilla.tsx`, `components/EnlaceLegal.tsx` |
| Pantalla «Revisa y acepta para continuar» | `app/aceptar-terminos.tsx`, `components/PantallaAceptacion.tsx` |
| Guarda de rutas y velo mientras se comprueba | `app/_layout.tsx` |
| Filas «Términos y condiciones» y «Política de privacidad» | `app/(tabs)/mas.tsx` |
| Configuración y contexto | `lib/legal.ts` |
| Decisión de la guarda (lógica pura, probada) | `packages/core/src/lib/legal.ts` (`destinoPorAceptacion`) |
| El verificador exige el interruptor en `1` para publicar | `scripts/entornoPublicacion.mjs` |

**Verificado:** tipos sin errores en core y teléfono; core 159/159 (19 de legal); teléfono 14/14. En el navegador (móvil, 375 px): la casilla alterna `aria-checked` `false → true → false` y habilita o deshabilita «Crear cuenta»; la pantalla de aceptación se ve en sus 4 estados (pendiente con 2 documentos, con 1, error al guardar, error al comprobar con «Reintentar», verificando); las dos filas salen en Más; y **con el interruptor apagado el registro queda sin casilla y con el botón habilitado**, y `/aceptar-terminos` sin sesión cae en `/login`. No envié el formulario de registro: habría creado una cuenta real en tu Supabase.

**Errores que corregí por el camino:** `aria-checked` no llegaba al DOM en web (solo `accessibilityState`); y una carrera en la guarda: si otra persona iniciaba sesión en el mismo teléfono, el "al día" de la anterior seguía vigente un instante. Ahora el resultado va atado al id de usuario.

**Pendiente:** la fila «Eliminar mi cuenta» de Más (fase 1 del contrato) sigue sin construirse, y la política de privacidad dice que existe. Antes de publicar en tienda hay que hacerla.

## Adenda 2: mapa de OpenStreetMap (16-oct)

La sesión de Wallet agregó un mapa en el detalle de un pago con ubicación: el teléfono pide 9 imágenes (teselas, zoom 16) a `tile.openstreetmap.org`. Eso es un servicio externo que ve la **IP y la zona aproximada** (no el monto), así que la política y el registro tenían que decirlo **antes** de que el código salga.

- **Política** (`privacidad.html`, secciones 2 y 4): párrafo nuevo, con el enlace a la política de la Fundación OpenStreetMap. Lo trata como servicio externo, no como encargado, y dice qué ve y qué no.
- **Registro de tratamiento**: fila nueva de proveedor, nota de sus condiciones de uso y una línea en «Lo que NO se hace».
- **README legal**: pregunta 13 para el abogado, y fuentes primarias (política de uso de teselas y de privacidad de la Fundación, leídas el 16-oct).
- **Google Play** (`publicacion-produccion.md`): salvedad sobre si cuenta como «compartir» ubicación aproximada.
- **Versión sin cambio** (`2026-10-16`): nadie la había aceptado todavía y la base rechaza fechas futuras. Desde la primera aceptación, un cambio así sube la versión.
- **Para el código de Wallet** (no lo toqué): la política de uso pide la atribución «© OpenStreetMap contributors» (la app muestra «© OpenStreetMap»), y recomienda no depender de ese servidor si la app crece. Y la opción más respetuosa con la privacidad es cargar el mapa solo cuando la persona toque «Ver mapa».
