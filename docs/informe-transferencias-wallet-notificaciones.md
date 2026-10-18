# Informe: transferencias, tarjeta de Google Wallet, notificaciones y ubicación (18-oct-2026)

**Pedido:** revisar la ubicación; que las transferencias se agreguen solas; que Google Wallet detecte la tarjeta con la que se compró para descontarla sola; y notificaciones para el usuario.
**Decisiones del usuario:** transferencias entre cuentas propias, que se junten solas cuando llegan por correo; con la tarjeta reconocida, registrar solo y avisar (se puede apagar); notificaciones de pagos registrados, de la bandeja, de recordatorios y cuotas, y de presupuestos; revisar toda la ubicación, dar lugar a los pagos de Google Wallet y no tomar la ubicación en gastos anotados después.

## 1. Qué hace ahora

### Transferencias entre tus cuentas

- **Nueva:** *Más → Transferencias* (o *Cuentas → Transferir*, o «Transferir a otra cuenta mía» en el detalle de una cuenta). Eliges desde y hacia, el monto y la fecha; la pantalla muestra cómo quedan los dos saldos.
- **No es gasto ni ingreso:** no cuenta en el balance del mes ni en los presupuestos. Aparece en el historial de las dos cuentas («A Efectivo», «Desde Ahorro»).
- **Desde una tarjeta** es un avance de efectivo: usa cupo, y no deja pasar del cupo. **Hacia una tarjeta** no se puede: eso es «Pagar tarjeta» (la app lo explica).
- **Solas desde el correo:** si llega «Transferencia enviada» desde una cuenta tuya y «Transferencia recibida» en otra cuenta tuya, por el mismo monto y con hasta 2 días de diferencia, la base las junta en **una** transferencia (antes eran un gasto y un ingreso que inflaban los dos). Si hay dos candidatas posibles no adivina: quedan en la bandeja.
- **En la bandeja:** un aviso del correo se puede confirmar con **«Fue entre mis cuentas (transferencia)»** eligiendo la otra cuenta; si la otra mitad también está en la bandeja, se resuelve junto. Si el aviso habla de una transferencia, la bandeja lo sugiere.
- **Si se juntaron por error:** en *Transferencias*, «No era entre mis cuentas» la quita y devuelve los dos avisos a la bandeja.
- **Importar estado de cuenta:** una transferencia ya registrada cuenta como «posible duplicado» en las dos cuentas.

### Google Wallet reconoce la tarjeta y la descuenta sola

- La base reconoce la tarjeta del pago **por sus últimos 4 dígitos** (exactamente una cuenta tuya con esos dígitos, y del mismo banco si la notificación lo nombra). Con el **registro automático** encendido (viene encendido), guarda el gasto sola: descuenta del cupo (crédito) o del saldo (débito/ahorro), con la hora real del pago, «Pagado con Google Wallet», y te llega la notificación **«Registré $12.50 en SUPERMAXI · Con tu tarjeta •••• 4321 · Comida»**. Tocarla abre el gasto para corregirlo o eliminarlo.
- **Va a la bandeja** (como antes) si la tarjeta no se reconoce por los dígitos, si hay dos cuentas con los mismos dígitos, si el pago supera el cupo o si apagaste el registro automático. Llega la notificación «Pago de $12.50 por confirmar».
- **Categoría:** la de tu último gasto en ese mismo comercio; si no hay, por palabras clave (Supermaxi → Comida, Fybeca → Salud…); si no, «Otros» con el comercio como detalle. En la bandeja ya viene preseleccionada.
- **Dígitos de las tarjetas que ya tenías:** antes solo se podían poner al crear la cuenta. Ahora el detalle de cada cuenta y tarjeta tiene **«Últimos dígitos → Agregar/Cambiar»**.
- **Corrección:** antes, si tenías una sola tarjeta de un banco, un pago con **otra** tarjeta de ese banco (con otros dígitos) quedaba cargado a la tuya. Ahora mandan los dígitos.
- El interruptor está en *Conectar Google Wallet* y en *Conectar Apple Pay*. Con Apple Pay funciona igual si el atajo manda los últimos dígitos en `p_tarjeta` (por ejemplo «Visa 1234»).

### Notificaciones

*Más → Notificaciones*: un interruptor por tipo y el permiso del teléfono.

| Aviso | Cuándo | Quién lo arma |
|---|---|---|
| Pago registrado solo | Al registrarse un pago de Google Wallet (aunque la app esté cerrada) | Módulo nativo de Android |
| Pago por confirmar | Al llegar un pago de Google Wallet a la bandeja; y a las 19:00 si quedan movimientos sin confirmar | Módulo nativo / la app |
| Recordatorios y cuotas | El mismo día, 1 o 3 días antes del vencimiento, a la hora elegida (7, 9, 12, 18 o 20 h). De un diferido, solo la cuota que toca | La app (programadas en el teléfono) |
| Presupuestos | Al llegar al 75 %, al 100 % y al pasarte, **una vez por nivel y por mes** (la base anota lo avisado, así no se repite aunque el gasto venga de Google Wallet o de la app) | La base decide; el teléfono avisa |

- Son **locales**: ningún servidor de avisos ve tus montos. En la pantalla bloqueada, Android oculta el texto si así lo elegiste («Ocultar contenido sensible»).
- Se reprograman al abrir la app y al salir de *Recordatorios* o de la *Bandeja*; **al cerrar sesión se cancelan** (no suenan para quien entre después).
- Tocar una notificación abre su pantalla (el gasto, la bandeja, los presupuestos o los recordatorios).

### Ubicación (revisión)

| Hallazgo | Corrección |
|---|---|
| Un gasto anotado después (con fecha de otro día) guardaba la ubicación de donde estabas al anotarlo, y quedaba en el lugar equivocado | El formulario muestra **«Guardar dónde estoy ahora»**: encendido si el gasto es de hoy, **apagado si es de otro día** (con la razón). La persona puede cambiarlo |
| El GPS se pedía recién al tocar «Agregar» (hasta 8 s de espera, y la posición de unos segundos después) | Se empieza a buscar **al abrir el formulario**; al guardar se usa esa, salvo que haya fallado (GPS frío: se reintenta) o tenga más de 10 minutos |
| Los pagos de Google Wallet llegan sin ubicación (con la app cerrada, Android no la da sin permiso en segundo plano, que la app bloquea a propósito) | Si ya tienes un **lugar con el nombre del comercio**, el gasto se asigna a ese lugar (al registrarse solo y al confirmar en la bandeja). Con varias sucursales del mismo nombre, a la más usada. La isla de detalle muestra el mapa de ese lugar |
| Sin más hallazgos | Se revisaron el permiso (solo «mientras usas la app»), la preferencia por persona, el tiempo máximo, el redondeo a ~11 m, la asignación de lugares (precisión > 200 m no asigna) y «Borrar mis ubicaciones» |

## 2. Cómo está hecho

**Base** (dos migraciones nuevas):
- `20261018120000_ajustes_y_transferencias`: tabla `ajustes_usuario` (`registro_automatico`, encendido por defecto); tabla `transferencias` con disparadores que validan (cuentas propias y distintas, destino no crédito, cupo del origen si es tarjeta, bloqueo de las dos cuentas en orden) y mueven los saldos al crear y al borrar; una transferencia no se edita salvo descripción y fecha. En `transacciones_detectadas`: `es_transferencia` y `transferencia_id`, el disparador que junta las dos mitades, y las funciones `confirmar_aviso_como_transferencia` y `separar_transferencia`.
- `20261018130000_registro_automatico_billetera`: `registrar_pago_con_clave` (interna, común a Apple Pay y Google Wallet) reconoce la tarjeta por dígitos y, si corresponde, crea el gasto y deja el aviso confirmado con `gasto_id`. `categoria_sugerida` y `lugar_por_comercio`. Tabla `avisos_presupuesto` y funciones `revisar_presupuestos` (interna) y `revisar_mis_presupuestos(mes)` (para la app). `confirmar_transaccion_detectada` asigna el lugar por comercio y guarda `gasto_id`. La exportación de datos personales incluye las tablas nuevas.
- Las firmas públicas de `registrar_pago_billetera` (atajo) y `registrar_aviso_billetera` (Android) **no cambian**: el APK y los atajos que ya existen siguen funcionando.

**Core:** `Transferencia`, `AjustesUsuario`, `AvisoPresupuesto`; `transferenciaSchema`; `listarTransferencias`, `registrarTransferencia`, `eliminarTransferencia`, `separarTransferencia`, `confirmarAvisoComoTransferencia`; `obtenerAjustes`, `guardarAjustes`; `revisarMisPresupuestos`; `actualizarIdentificadorCuenta`; `lib/notificaciones.ts` (preferencias, `recordatoriosAProgramar`, `avisoBandeja`, `textoAvisoPresupuesto`); `guardarUbicacionDeAhora` y `ubicacionAnticipada`; `movimientosDe` con transferencias; el lector de correos marca `esTransferencia`; `faltaEnLaBase(err)` para que lo nuevo no rompa nada en una base sin la migración.

**Teléfono:** pantallas `transferencias`, `transferencia/nueva` y `notificaciones`; componentes `DigitosCuenta` y `RegistroAutomatico`; bandeja, Google Wallet, Apple Pay, cuenta, tarjeta, nuevo y editar gasto, recordatorios y *Más*. `lib/notificaciones.ts` con `expo-notifications` (~0.28.19, la del SDK 51) y el ícono blanco `assets/brand/fintrack-notificacion.png`. En el módulo de Android: `Notificaciones.kt` (canales, textos, versión sin montos para la pantalla bloqueada, enlaces `gastosapp://`), preferencias en `Ajustes.kt`, `ajustarAvisos` en el módulo y el permiso `POST_NOTIFICATIONS`. **Versión de la app: 1.4.0** (librería nativa nueva).

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Pruebas de base de datos (36 migraciones desde cero) | **328/328** (55 nuevas: `transferencias.sql` 29 y `registro_automatico.sql` 26) |
| Archivos para Supabase web, sobre una base con las 34 migraciones anteriores | Los dos terminan en «aplicada = sí» y pasan las pruebas nuevas, la de exportación de datos y la de borrado en cascada |
| `base-completa.sql` en una base vacía | «migraciones_registradas = 36» y las mismas pruebas en verde |
| Pruebas de core | **218/218** (19 nuevas: `transferencias.test.ts`, `notificaciones.test.ts` y ubicación) |
| Pruebas del teléfono (JS) | 18/18 |
| Tipos (`tsc`) | Sin errores en core, teléfono y escritorio |
| Código Kotlin del módulo | **Compila** con Kotlin 1.9.24 contra Android 34 (con unos stubs mínimos de la API de Expo para el archivo del módulo). Es la primera vez que se compila aquí: el informe de la fase 4 lo dejaba pendiente |
| `expo export` Android y web | Compilan (Android: 4,23 MB) |
| Pantallas en el navegador (web exportada, sesión y base simuladas, nada llegó a Supabase) | Transferencias, nueva transferencia con el resumen de saldos, bandeja en modo transferencia, detalle de cuenta y tarjeta con los dígitos y las transferencias en el historial, *Más*, y «Nuevo gasto» con la ubicación encendida (hoy) y apagada (otro mes). Sin errores en la consola |
| **No probado** | En un teléfono Android real (hay que compilar el APK 1.4.0): las notificaciones nativas, el permiso de Android 13 y el enlace al tocarlas; con notificaciones reales de Google Wallet de tus bancos; con correos reales de transferencias (los formatos de los bancos no están comprobados: ver «Limitaciones actuales» del correo en el README) |

## 4. Seguridad y privacidad

- **Transferencias:** RLS por persona en la tabla y en las funciones; las dos cuentas se validan en la base (una cuenta ajena se rechaza aunque alguien llame a la API directamente). Los saldos los mueven disparadores, nunca la app. Sin SQL dinámico; `search_path` fijo en todas las funciones (lo comprueba una prueba).
- **Registro automático:** solo con la tarjeta reconocida por sus dígitos; la clave de captura sigue sirviendo solo para dejar pagos (con los mismos límites por hora y por día). Al teléfono que tiene la clave ahora vuelven, además del monto, el id del gasto creado, la categoría y, si cruzó un nivel, el del presupuesto. Las funciones internas (`registrar_pago_con_clave`, `categoria_sugerida`, `revisar_presupuestos`) no se pueden llamar desde afuera (probado). `lugar_por_comercio` es *security invoker*: con sesión, RLS solo deja ver lugares propios (probado con otra persona).
- **Avisos de presupuesto:** la app solo los lee; los anota la base.
- **Notificaciones:** locales, sin servidor de avisos ni tokens. Versión pública sin montos para la pantalla bloqueada. Se cancelan al cerrar sesión. Las preferencias son por persona.
- **Ubicación:** sin cambios en el permiso (solo con la app abierta, nunca en segundo plano). Se pide al abrir el formulario de un gasto, solo si la persona activó la preferencia.
- **Documentos:** `docs/legal/registro-tratamiento-datos.md` incluye las tablas nuevas, el registro automático y las notificaciones (una prueba exige que cada tabla aparezca ahí). Conviene sumar a la política de privacidad, en la revisión con el abogado, el registro automático y las notificaciones.

## 5. Lo que falta o conviene después

- **Compilar el APK 1.4.0** (`pnpm build:apk` desde `apps/mobile`) y probar en el teléfono: un pago con Google Wallet con la tarjeta con dígitos (debe registrarse y avisar), otro con una tarjeta sin dígitos (debe ir a la bandeja y avisar), un recordatorio para mañana y un presupuesto que pase del 75 %.
- **Aplicar la base** en Supabase web: carpeta `supabase/para-supabase-web/18-10-2026 5AM/`, primero el 1 y después el 2. Cada uno debe terminar en «aplicada = sí». Va antes de publicar la app: la app nueva sigue funcionando sin la migración (sin las novedades), pero las novedades no.
- **Correos de transferencias reales** de Pichincha, Guayaquil y Pacífico, para confirmar que el lector reconoce «enviada/recibida» y los dígitos de la cuenta.
- **Versión web de escritorio** (`apps/desktop`): todavía no muestra ni registra transferencias (la del teléfono y la web de Vercel sí).
- Si el registro automático se equivoca de tarjeta en algún caso, se puede apagar en *Conectar Google Wallet*; el gasto se corrige o se elimina desde la notificación.
