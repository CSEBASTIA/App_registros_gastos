# Documentación legal de fintrack

Estado al **16-oct-2026**. Todo es **borrador técnico**: sirve para tener la base lista y probada, pero **no sustituye la revisión de un abogado** (ver [Preguntas para el abogado](#preguntas-para-el-abogado)).

## Qué hay y en qué estado está

| Documento | Dónde | Quién lo ve | Estado |
|---|---|---|---|
| Términos y condiciones | [`apps/mobile/public/terminos.html`](../../apps/mobile/public/terminos.html) | Públicos (`/terminos.html`) | Borrador, versión `2026-10-16`. Faltan los datos del responsable |
| Política de privacidad | [`apps/mobile/public/privacidad.html`](../../apps/mobile/public/privacidad.html) | Públicos (`/privacidad.html`) | Borrador, versión `2026-10-18` (agrega Google Wallet, el registro automático de pagos, las transferencias y las notificaciones). Faltan los datos del responsable, la región de Supabase y los días de respaldos |
| Registro de tratamiento de datos | [`registro-tratamiento-datos.md`](registro-tratamiento-datos.md) | Interno | Completo. Una prueba exige que cada tabla de la base esté aquí |
| Procedimiento para atender derechos | [`procedimiento-derechos-titular.md`](procedimiento-derechos-titular.md) | Interno | Completo; la copia de datos está automatizada y probada |
| Plan de respuesta a incidentes | [`plan-incidentes-seguridad.md`](plan-incidentes-seguridad.md) | Interno | Completo; falta tu cuenta en el sistema de notificación de la Superintendencia |
| Constancia de aceptación | Base de datos (`aceptaciones_legales`) y core (`legal.ts`) | — | Lista y probada (27 pruebas de base y 19 de lógica). Las **pantallas están construidas pero apagadas**: se encienden con `EXPO_PUBLIC_EXIGIR_ACEPTACION=1` después de aplicar las migraciones (ver `contrato-logica-core.md`) |
| Copia de datos de una persona | Base de datos (`exportar_datos_persona`) | Solo administración | Lista y probada (11 pruebas), también con el rol `postgres` del SQL Editor |

## Lo que tienes que completar tú

1. **Responsable**: nombre completo o razón social, cédula o RUC y ciudad. Aparecen en las dos páginas públicas entre `[corchetes]`. Es dato personal tuyo: se escribe en las páginas, **no** en un archivo suelto del repositorio.
2. **Correo de contacto** para temas de privacidad. Conviene uno propio de la app (por ejemplo `privacidad@tu-dominio`), no tu correo personal.
3. **Fecha de publicación** (la de la puesta en línea).
4. **Región de Supabase**: *Project Settings → General*. Va en la sección 4 de la política.
5. **Días que el proveedor conserva los respaldos**: depende de tu plan de Supabase (el gratuito no tiene respaldos automáticos; el Pro guarda 7 días, a confirmar en tu panel).
6. **Variables de entorno**: `EXPO_PUBLIC_URL_PRIVACIDAD`, `EXPO_PUBLIC_URL_TERMINOS` y `EXPO_PUBLIC_CORREO_PRIVACIDAD` en `apps/mobile/.env.production`, en Vercel y en EAS (ver [`publicacion-produccion.md`](../publicacion-produccion.md)).
7. **Publicar y comprobar** que abren `https://<tu-app>.vercel.app/terminos.html` y `/privacidad.html`.

El verificador (`pnpm --filter mobile verificar:publicacion --produccion`, también dentro de `build:play` y `update:produccion`) **se niega a seguir** mientras quede un `[corchete]`, falte una variable o las páginas no coincidan con la versión de la app.

## Lo que decidí por ti (cámbialo si no te sirve)

- **Plazo de respuesta a derechos y eliminación por correo: 15 días**, contados desde que recibes la solicitud. Prometí el más exigente de los dos significados posibles (calendario, no hábiles): ver la pregunta 3.
- **Mayores de 18 años**, como ya decía el borrador.
- **Uso gratuito**, con la promesa de avisar antes de cobrar.
- **Transferencia internacional**: se apoya en el consentimiento expreso al aceptar la política (más las garantías de los proveedores).
- **No hay delegado de protección de datos designado** (pregunta 1).
- **Ley aplicable: Ecuador**, sin cláusula de arbitraje ni fuero especial: no quita derechos al consumidor.

## Preguntas para el abogado

Marcadas como "no confirmado": las consulté en fuentes secundarias (ver abajo), no en el texto oficial.

1. **Delegado de protección de datos**: ¿es obligatorio para una app de este tamaño y tipo de datos (financieros, ubicación)? El Reglamento lo exige según el tipo y la escala del tratamiento. *No confirmado.* Una fuente indica que hubo una ventana de registro presencial ante la Superintendencia entre el 1-nov y el 31-dic-2025.
2. **Transferencia internacional**: ¿basta el consentimiento expreso, o hacen falta cláusulas o un nivel adecuado de protección? Depende de la región de Supabase. Aplica la Norma General de Transferencias de la Superintendencia (Resolución SPDP-SPD-2026-0004-R, 28-ene-2026). *No confirmado.*
3. **Plazo de respuesta a derechos**: las fuentes dicen 15 días, pero unas hablan de hábiles y otras no. También: si puedes pedir aclaraciones y pausar el plazo. *No confirmado.*
4. **Notificación de vulneraciones**: la ley habla de 5 días y la norma técnica nueva (Resolución SPDP-SPD-2026-0040-R, Registro Oficial del 24-sep-2026) las manda por el sistema de la Superintendencia. ¿Los 5 días cuentan desde que ocurre o desde que lo conoces? *No confirmado.*
5. **Registro de actividades de tratamiento**: ¿te obliga a ti, tan pequeño? Si no, queda como buena práctica. El contenido mínimo que fija el Reglamento. *No confirmado.*
6. **Datos financieros y de ubicación**: ¿tienen un régimen especial (datos crediticios, datos sensibles)? Hoy se piden con consentimiento específico y opcional.
7. **Logotipos de bancos, tarjetas y casas comerciales** que muestra la app: ¿hace falta permiso, o basta el uso identificativo? Los términos dicen que no hay afiliación.
8. **Limitación de responsabilidad** (sección 10 de los términos) frente a la Ley Orgánica de Defensa del Consumidor (cláusulas abusivas), y el **foro** de reclamos (sección 13).
9. **Aceptación electrónica**: ¿basta la casilla más la constancia en la base (versión, fecha, plataforma) como prueba conforme a la Ley de Comercio Electrónico?
10. **Leer avisos bancarios del correo**: ¿cuenta como una actividad regulada (agregación de información financiera)? La app solo propone movimientos y el usuario confirma.
11. **Google**: la verificación de la app para pedir acceso a Gmail (permiso restringido) puede exigir una evaluación de seguridad. *Confirmarlo con Google antes de activar "Correo" a usuarios reales.*
12. **Si algún día cobras**: facturación y obligaciones tributarias (SRI), y qué cambia en los términos.
13. **Mapa de OpenStreetMap en el detalle de un pago** (desde el 16-oct): el teléfono pide las imágenes a `tile.openstreetmap.org`, que ve la IP y la zona aproximada (cuadros de unos 600 m), no el monto. La política lo informa (sección 4) y lo trata como servicio externo, no como encargado. ¿Basta informarlo, o es una transferencia internacional que pide consentimiento específico o garantías? Opción técnica para evitar la duda: cargar el mapa solo cuando la persona toque «Ver mapa». *No confirmado.*

## Cómo se mantiene

1. **Cambia el texto de una de las páginas públicas.** Si es de fondo (nuevo servicio, nuevo dato, nuevo proveedor, cambio de finalidad): cambia la etiqueta `version-legal` de esa página (una fecha) **y** `VERSION_LEGAL` en [`packages/core/src/lib/legal.ts`](../../packages/core/src/lib/legal.ts). La app vuelve a pedir la aceptación. Si es una errata, no cambies la versión. *Excepción única (16-oct):* se agregó el mapa de OpenStreetMap a la política sin cambiar la versión `2026-10-16`, porque **nadie había aceptado todavía esa versión** (el interruptor de aceptación está apagado y las migraciones no estaban aplicadas); la base rechaza versiones del futuro, así que no se podía subir a una fecha posterior el mismo día. Desde que alguien acepte, cualquier cambio de fondo sube la versión.
2. **Agregas una tabla con `usuario_id`.** Una prueba de base falla si no se borra en cascada con la cuenta o si falta en la copia de datos (`exportar_datos_persona`); una prueba de lógica falla si no está en el [registro de tratamiento](registro-tratamiento-datos.md). Actualiza los tres, y la política si cambia qué datos guardas.
3. **Agregas un proveedor o servicio que ve datos** (analítica, reportes de fallos, correo transaccional): primero la política y el registro, después el código.
4. Corre `pnpm --filter core test` y `bash supabase/tests/correr.sh`.

## Carpeta privada

`docs/legal/privado/` está en el `.gitignore`: ahí van las solicitudes de las personas, la correspondencia con el abogado y la evidencia de incidentes. **Contiene datos personales: nunca debe subirse a Git.**

## Fuentes consultadas (16-oct-2026, todas secundarias)

- [ECIJA: nueva norma técnica de notificación de vulneraciones](https://www.ecija.com/actualidad-insights/nueva-norma-tecnica-de-notificacion-de-vulneraciones-de-seguridad-de-datos-personales/)
- [NMS Law: la SPDP expide la norma técnica de notificación](https://nmslaw.com.ec/?p=16486)
- [EY: resumen de la ley de protección de datos](https://assets.ey.com/content/dam/ey-sites/ey-com/es_ec/topics/tax/ey-legal-alert-resumen-ley-proteccion-datos-personales.pdf)
- [EY: alerta sobre el Reglamento](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-ec/technical/tax/documents/ey-legal-alert-nov1-reglamento-lopdp.pdf)
- [LEXIS: norma general de transferencias](https://www.lexis.com.ec/noticias/registro-oficial-del-dia-superintendencia-expide-norma-general-sobre-transferencias-nacionales-e-internacionales-de-datos-personales)
- [LEXIS: derechos de los titulares, guía rápida](https://www.lexis.com.ec/blog/derechos-humanos/derechos-de-los-titulares-de-los-datos-personales-una-guia-rapida-para-su-ejercicio)
- [Derecho Ecuador: protección de datos, mito o realidad](https://derechoecuador.com/proteccion-de-datos-personales-en-ecuador-mito-o-realidad/)
- [PTKD: Google Play y la eliminación de cuentas](https://ptkd.com/journal/google-play-account-data-deletion-requirement)

Fuentes **primarias** (16-oct-2026), para lo del mapa:
- [OpenStreetMap: política de uso de teselas](https://operations.osmfoundation.org/policies/tiles/): atribución visible, `User-Agent` propio, sin precarga masiva, puede bloquear el uso intensivo sin aviso.
- [Fundación OpenStreetMap: política de privacidad](https://osmfoundation.org/wiki/Privacy_Policy): registra IP, navegador y hora de los accesos, usa una red de entrega de contenido y no indica por cuánto tiempo guarda esos registros.

Lo que se tomó de las secundarias: el consentimiento debe ser libre, específico, informado e inequívoco y se puede retirar (artículo 8); los derechos están en los artículos 12 al 20; la transferencia internacional, en los artículos 55 al 61; el plazo de 15 días; los 5 días para notificar una vulneración; y que Google Play exige borrar la cuenta desde la app **y** desde una dirección web. **Los números de artículo no se citan en las páginas públicas** porque no se verificaron en el texto oficial.
