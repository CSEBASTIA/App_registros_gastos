# Contrato de lógica (`packages/core`) — Paso 1 y seguridad

Área lógica (negocio, base de datos, seguridad). No se editan pantallas ni componentes; esto es lo que la interfaz puede consumir. Todo se importa desde `"core"`.

## Presupuestos (Paso 1)
- `listarPresupuestos(mes?: "YYYY-MM")` → `Presupuesto[]`.
- `guardarPresupuesto({ categoriaId, montoLimite, mes })` → crea **o actualiza** (uno por usuario/categoría/mes). Valida con zod; lanza error legible si el límite es ≤ 0 o el mes no es `YYYY-MM`.
- `eliminarPresupuesto(id)`.
- `estadoPresupuestos(mes, presupuestos, gastos, categorias)` → `{ presupuesto, categoriaNombre, gastado, restante, porcentaje, nivel }[]`, ordenado de más a menos usado. `nivel`: `"ok"` (< 80 %), `"cerca"` (≥ 80 %), `"excedido"` (≥ 100 %). `restante` puede ser negativo.
- `sugerirLimite(categoriaId, mes, gastos)` → número (promedio de los 3 meses previos con gasto, múltiplo de 5) o `null` sin historial. Sirve para prellenar el campo.
- `generarRecomendaciones({ ..., presupuestos })`: el nuevo campo es opcional; si se pasa, agrega avisos al 80 % y alertas al pasarse.
- Pantalla sugerida: en "Más" → Presupuestos, con `SelectorMes`, una fila por categoría con `BarraProgreso` (porcentaje) y un formulario categoría + monto con botón "Sugerir".

## Ya disponibles para pasos siguientes
- `scoreFinanciero({ endeudamiento, ingresosMes, gastosMes, cuentas, recordatorios, hoy })` → `{ total 0-100, etiqueta, detalle }`.
- `planDeudas(deudas, pagoMensual, "bola_de_nieve" | "avalancha")` → orden de liquidación, meses e interés total; `viable: false` si el pago no alcanza.
- `calcularEndeudamiento(deudas, ingresoMes, ingresoReferencia?)`: el tercer parámetro (p. ej. promedio de ingresos de los últimos meses) evita marcar "bajo" en un mes sin ingresos.

## Fechas (corrige un bug)
- Usar `fechaLocal()` y `mesLocal()` en lugar de `new Date().toISOString().slice(0, 10 | 7)`. `toISOString` es UTC: en Ecuador, después de las 19:00 devuelve el día siguiente (y el último día del mes, el mes siguiente). Hay unas 26 apariciones en pantallas.

## Errores y límites
- Mostrar cualquier error con `mensajeError(err)`. Mensajes nuevos que pueden llegar:
  - `ErrorTiempoAgotado`: "La conexión tardó más de 15 s. Revisa tu internet e inténtalo de nuevo." (Supabase 15 s, subidas 60 s, Gmail/Graph 20 s).
  - De la base: "La cuenta / categoría / deuda indicada no existe o no es tuya."
- `LIMITES` (exportado): `descripcion` 200, `nombre` 80, `titulo` 120, `detalle` 80. Usarlos como `maxLength` en los campos para no chocar con la validación.

## Cambios hechos fuera del área lógica (revisar al integrar)
- `apps/desktop/src/App.tsx` (dueño: Agente 3): `DEV_EMAIL`/`DEV_PASSWORD` solo se leen con `import.meta.env.DEV`. Así las credenciales de desarrollo no se incrustan en el build de producción. **Conservar este guard** al editar el archivo.
- `apps/desktop/src/lib/supabase.ts` y `apps/mobile/lib/supabase.ts`: cliente con `global.fetch = crearFetchConTimeout()`.
- `apps/desktop/src/lib/estadoCuenta.ts`: descripción importada recortada a 200 caracteres.
- `apps/mobile/lib/gmailApi.ts` y `graphMail.ts`: timeout de 20 s.
- `apps/mobile/app/_layout.tsx` (dueño: Agente 3), 14-oct: el efecto de redirección ahora espera a sesión, tema y fuentes antes de llamar a `router.replace`. Antes navegaba mientras el layout devolvía `null` y expo-router lanzaba "Attempted to navigate before mounting the Root Layout component", que tumbaba la app al abrir. **Pendiente para el Agente 3:** con el login desactivado, la ruta raíz `/` sigue mostrando "Unmatched Route" en vez de redirigir a `/resumen` (en `/resumen` la app funciona).

## Nuevo 14-oct
- `registrarAbonoDeuda(id, monto, { cuentaId?, fecha? })`: misma firma de antes más opciones. Ahora es atómico (función `registrar_abono_deuda` en la base), descuenta de la cuenta de origen y libera cupo en diferidos. `listarAbonosDeuda(deudaId?)` da el historial. Requiere la migración `20261014120000`.
- `mensajeError` traduce los fallos de red a "No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo."

## Estabilización de la app móvil (14-oct, pedido del usuario)
- Dependencias alineadas al SDK 51: `expo-linking ~6.3.1` y `expo-constants ~16.0.2` ahora son dependencias directas de `apps/mobile` (antes pnpm resolvía los peers `*` de expo-router a la versión 57 y la app se caía en Expo Go con "Cannot find native module 'ExpoLinking'"). `react-native 0.74.5` y `async-storage 1.23.1`, las que espera Expo 51. Queda una sola copia de expo-router y de react-navigation (dos copias causaban "Cannot read properties of undefined (reading 'isReady')"). Tras cambiar dependencias, arrancar Metro con `--clear`.
- `apps/mobile/app/index.tsx` (nuevo): redirige `/` a `/resumen`; elimina el "Unmatched Route".
- `apps/mobile/app/(auth)/_layout.tsx` (nuevo): el grupo (auth) existe como ruta; quita el aviso de expo-router.
- `apps/mobile/app/_layout.tsx` (dueño: Agente 3): el login va activo también en desarrollo (sin sesión, RLS bloquea leer y guardar). Para revisar solo la interfaz sin sesión: `EXPO_PUBLIC_SIN_LOGIN=1` en `apps/mobile/.env`. Se registraron `index` y `presupuestos` (título "Presupuestos") en el Stack.

## Plan recomendado: saldos, correo y activación (14-oct)

Funciones nuevas en `core`:
- `actualizarIngreso(id, cambios)`: edita un ingreso; `null` en categoría/detalle/cuenta lo quita. La base reajusta el saldo. Falta la pantalla de edición.
- `confirmarTransaccionDetectada(id, { monto, descripcion, categoriaId?, cuentaId? })`: confirma un aviso de la bandeja en un solo paso; si ya estaba confirmado devuelve `{ yaConfirmado: true }` sin duplicar.
- `eliminarTransaccionesDetectadas()`: borra todos los avisos del correo del usuario (no toca gastos confirmados).
- `bancoDeRemitente(remitente)`: ahora exige dirección o dominio exactos.

Reglas nuevas de la base que la interfaz debe respetar:
- **Un pago de tarjeta no se puede borrar** (no mostrar "eliminar pago").
- **Un gasto diferido no se edita en monto, cuenta, método ni plazo** (la base responde "Un gasto diferido no se puede editar…"). En la web, la edición en línea debería deshabilitar esos campos para diferidos.

Cambios hechos en pantallas (dueño: Agente 3), todos con los componentes existentes:
- `app/deudas.tsx`: el abono pide **"Pagar desde"** (cuentas que no son de crédito, con su saldo; preselecciona la cuenta de la deuda o la primera), muestra errores y el botón "Guardando…". Eliminar una deuda muestra el error si falla.
- `app/(auth)/registro.tsx`: tras crear la cuenta va directo a `/resumen` (ya no a conectar correo). Si el proyecto pide confirmar el correo, muestra el aviso. `conectar-correo.tsx` queda sin uso desde el registro.
- `app/(tabs)/resumen.tsx`: tarjeta **"Empezá con tu primer gasto"** solo cuando no hay gastos ni ingresos; "Salud financiera" ya no dice "tus ingresos cubren tus gastos" si no hay ingresos del mes.
- `app/(tabs)/mas.tsx`: "Correo (beta)" con subtítulo de opcional.
- `app/correo.tsx`: tarjeta "Qué lee y qué guarda"; desconectar revoca (Google), borra tokens y avisos, y muestra el resultado.
- `app/bandeja.tsx`: confirmar usa `confirmarTransaccionDetectada`; descartar muestra errores.
- Fechas locales (`fechaLocal`/`mesLocal`) en todas las pantallas del teléfono: ya no queda ningún `toISOString().slice(...)`.
- `lib/catalogoTarjetas.ts` (en curso por otro agente): se comentaron entradas cuyo archivo de imagen no existía, porque rompían el paquete de la app (`Unable to resolve`). Al terminar de subir las imágenes, revisar que cada `require` apunte a un archivo existente.

## Revisión general (14-oct, 10:50)
- `lib/catalogoTarjetas.ts`: el commit `834933c` dejó en `main` 7 `require` a imágenes de Pichincha que no existen (`pichincha-mastercard-premium-miles.jpg`, `pichincha-visa-joven.png`, `pichincha-visa-platinum-miles.jpg`, `pichincha-visa-premium-microfinanzas*.jpg`, `pichincha-visa-signature-miles.jpg`, `pichincha-visa-universidad-catolica.jpg`). Con eso la app móvil no arrancaba. Se comentaron (la tarjeta usa el degradado del banco). Al agregar cada imagen, descomentar su línea. Antes de cada commit, comprobar con `npx expo export -p android` desde `apps/mobile`.

## Integridad de saldos, montos y correo (15-oct)

Origen: revisión de errores con dos agentes. Todo con pruebas: core 71/71, base 89/89 (`bash supabase/tests/correr.sh`).

### Reglas nuevas de la base (migración `20261015120000_integridad_saldos`)
- **Saldo a favor:** el `disponible` de una tarjeta puede pasar de `cupo_total` (pagar de más ya no pierde dinero). Usado = `max(0, cupo_total − disponible)`; a favor = `max(0, disponible − cupo_total)`.
- Editar el monto o la cuenta de un gasto ya pagado reajusta solo la diferencia (antes se perdía cupo).
- **Un diferido solo va a una tarjeta de crédito** (o sin cuenta) y exige `mesesDiferido`. Su cuota es `ceil(monto·100 / meses) / 100`.
- No se puede borrar una deuda automática mientras exista su gasto, ni una deuda con abonos (borrar la cuenta del usuario sí funciona).
- Un aviso de la Bandeja ya resuelto no cambia de estado.
- Al borrar una categoría propia, sus gastos e ingresos pasan a "Otros" con el nombre viejo como detalle.

### Funciones de core nuevas o cambiadas
- `parsearMonto(texto)`: "12,50", "1.234,56", "$ 25" → número con 2 decimales; NaN si no es un monto. **Usar en todo campo de monto** en lugar de `Number(texto)` (que da NaN con coma). También `sumarMontos`, `redondearCentavos`.
- `mensajeError`: los errores de zod salen en español (un monto vacío da "Escribe un monto válido, por ejemplo 12,50."). Además traduce los códigos 23503, 23514, 23505 y 57014 de Postgres.
- `actualizarGasto` valida con `cambiosGastoSchema`. `""` en cuenta, detalle o método significa "quitarlo".
- `completarRecordatorio(r)`: si es recurrente, pasa a la siguiente fecha en vez de quedar tachado. `siguienteFechaRecurrente`, y `sumarMeses` usa el último día del mes (31-ene + 1 = 28-feb).
- `movimientosDe(cuentaId, gastos, pagos, ingresos, categorias, abonos?)`: la cuenta de origen muestra los pagos a tarjeta y los abonos. **Usar `item.sentido` ("entrada" | "salida") para el signo**, no `tipo`. Es opcional en el tipo solo para no romper a quien arma movimientos a mano (como `resumen.tsx`, que debería llenarlo).
- `etiquetaFecha` usa el día local.
- `insertarTransaccionesDetectadas` omite los avisos imposibles y devuelve `{ enviados, descartados }`. `marcarTransaccionDetectada` solo acepta `"descartado"` y borra el asunto.
- `lib/sincronizacionCorreo`: `avisosDeCorreos`, `juntarPaginas`, `enLotes`, `desdeParaSincronizar`, `resumenSincronizacion` y `esPermisoRetirado`.
- `crearFetchConTimeout`: el límite cubre también la descarga del cuerpo.

### Cambios hechos en archivos del teléfono
- `lib/correoProveedor.ts`:
  - `sincronizarCorreo()` pagina hasta 500 correos. La marca es la hora de inicio, con 10 min de solape, y no avanza si falló algún correo.
  - `desconectarYBorrarCorreo()` borra primero los datos y luego quita el permiso.
  - `olvidarCorreoDelDispositivo()`.
  - La conexión de correo queda ligada a quien la hizo: si entra otra persona, se olvida.
- `lib/supabase.ts`: al cerrar sesión (`SIGNED_OUT`) se olvida el correo del teléfono. Antes, quien entrara después seguía leyendo el correo de la persona anterior. **`mas.tsx` no necesita cambios.**
- `lib/gmailAuth.ts` y `outlookAuth.ts`: si el permiso fue retirado (`invalid_grant`), se borran los tokens y se pide reconectar. Gmail borra los tokens antes de revocar.
- `lib/gmailApi.ts` y `graphMail.ts`: paginación y descarga de a 10 (un correo malo no tumba la búsqueda). En Graph, la fecha va en el día local y solo se sigue un `nextLink` de graph.microsoft.com.
- Pantallas (dueño: Agente 3), cambios mínimos sin tocar el diseño:
  - `app/correo.tsx`: los botones Buscar y Desconectar llaman a las funciones de `lib/correoProveedor`. El resultado se arma con `resumenSincronizacion`.
  - `parsearMonto` en `gasto/nuevo`, `ingreso/nuevo`, `(tabs)/tarjetas`, `cuentas`, `deudas`, `recordatorios`, `tarjeta/[id]`, `bandeja` y `presupuestos`.
  - `gasto/nuevo`: la vista previa de la cuota redondea como la base.
  - `cuenta/[id].tsx`: carga pagos y abonos y los pasa a `movimientosDe`.
  - `recordatorios.tsx`: tocar un recordatorio usa `completarRecordatorio` y muestra el error si falla.
  - `components/ItemMovimiento.tsx` (teléfono y web): el signo sale de `sentido`.

### Pendiente para los agentes de interfaz
1. Campos de monto: `keyboardType="decimal-pad"`, `maxLength={12}`. Los formularios nuevos deben usar `parsearMonto`.
2. Gastos (`(tabs)/gastos.tsx`): al abrir el mes actual, empezar en la semana de hoy, no siempre en la 1 (`useState(1)`).
3. Categorías (`categorias.tsx`): borrar sin confirmación y sin `.catch`. Pedir confirmación ("sus movimientos pasan a Otros") y mostrar el error.
4. `gasto/nuevo.tsx`: el `useFocusEffect` vuelve a poner `cuentaIdInicial` cada vez que la pantalla recupera el foco y pisa la cuenta elegida. Aplicarlo solo la primera vez.
5. Diferido en `gasto/nuevo.tsx`: con método "diferido", listar solo tarjetas de crédito (la base rechaza otra cuenta).
6. Pago de tarjeta (`tarjeta/[id].tsx`): mostrar la deuda actual (`cupo_total − disponible`) y un atajo "Pagar todo". Si paga de más, avisar que queda saldo a favor.
7. Tarjetas (`TarjetaVisual`, detalle, web `Tarjetas.tsx`): con `disponible > cupo_total` mostrar "Saldo a favor $X". Nunca un usado negativo ni una barra de más del 100 %.
8. Web, edición de gastos: en diferidos, deshabilitar monto, cuenta, método y plazo (reenviar valores sin cambios no falla). Web, abono a deuda: agregar "Pagar desde", como en el teléfono.
9. `components/GraficoBarras.tsx`: `key={d.etiqueta}` se repite si dos datos tienen la misma etiqueta. Usar un id estable.
10. `app/correo.tsx`: los textos de desconexión usan voseo ("entrá", "revisá"); el resto de la app usa tú.

### Proyecto de Supabase web (15-oct)
- Proyecto nuevo `ikyoawstrwihaqefosbq` creado con `supabase/base-completa.sql` (19 migraciones). Los `.env` del teléfono y de la web apuntan a él con la clave publishable; la local quedó comentada.
- Ya tiene las 23 migraciones: la de interés diferido, la de eliminar cuenta y la de rendimiento se aplicaron el 15-oct (comprobado por REST). `crearGasto` sigue enviando `tasa_interes` solo si se indicó, lo que no cambia nada ahora que la columna existe.

## Paso 1 antes de producción (15-oct)

Migraciones nuevas, listas para pegar en Supabase web (`supabase/para-supabase-web/`):
- **Migración de eliminar cuenta** (`20261015190000_eliminar_cuenta`): función `eliminar_mi_cuenta('ELIMINAR')`. Borra al usuario de auth y, en cascada, sus datos de las 10 tablas. Solo la puede llamar quien tiene sesión, y solo sobre sí mismo. Se niega si quedan facturas en Storage.
- **Migración de rendimiento** (`20261015200000_rendimiento`):
  - 12 índices de claves foráneas.
  - Las 35 reglas de RLS con `(select auth.uid())`, mismo significado.
  - Función `totales_por_mes(desde, hasta)`.

Funciones de core nuevas o cambiadas:
- `eliminarMiCuenta(confirmacion)`: borra las facturas con la API de Storage, llama a la función de la base y cierra la sesión local. `CONFIRMACION_ELIMINAR_CUENTA = "ELIMINAR"`.
- `listarGastos(rango?)` y `listarIngresos(rango?)`, con `rango = { desde?, hasta? }` ("YYYY-MM-DD", incluidos):
  - **Ya no se cortan en 1.000 filas**: piden todas las páginas.
  - Con rango, filtran en la base y descargan mucho menos.
  - `listarAbonosDeuda` y `listarPagosTarjeta` también paginan.
- `totalesPorMes(desde, hasta)` → `[{ mes, totalGastos, totalIngresos }]`, con los meses vacíos en 0. Máximo 10 años.

Cambios hechos en pantallas del teléfono (dueño: Agente 3), mínimos:
- Borrar gasto, ingreso o recordatorio: si falla, se muestra "No se pudo eliminar" con el motivo. Antes fallaba en silencio, por ejemplo con un diferido con abonos.
- `categorias.tsx`: borrar pide confirmación ("sus gastos e ingresos pasan a Otros") y muestra el error. **Punto 3 de la lista del 15-oct: hecho.**

Pendiente para los agentes de interfaz (paso 1):
1. **Más → "Eliminar mi cuenta"**, obligatorio para Google Play:
   - Explicar que borra todo y no se puede deshacer.
   - Pedir que escriba `ELIMINAR` y llamar a `eliminarMiCuenta(texto)`.
   - Mostrar `mensajeError(err)` si falla.
   - Al terminar, la sesión se cierra sola (y el teléfono olvida el correo conectado).
2. **Pasar rango donde solo se necesita un periodo**:
   - Gastos e Ingresos: el mes elegido.
   - Recomendaciones: el mes y los 3 anteriores.
   - Gráficos de 6 meses: `totalesPorMes`, sin descargar los movimientos.

## Fase 2 antes de producción: acceso, privacidad y errores (15-oct)

### Lógica lista en core (probada)
- `validarContrasena(texto)` → mensaje del primer requisito que falta, o `null`. Reglas: 8 a 72 caracteres, con letras y números (`contrasenaSchema`).
- `solicitarRecuperacion(correo, redirectTo)` → envía el correo y devuelve `MENSAJE_RECUPERACION_ENVIADA`. Es siempre el mismo texto, exista o no la cuenta, para no revelar quién usa la app.
- `sesionDesdeEnlace(url)` → canjea el código del enlace del correo (flujo PKCE). **Rechaza los enlaces con `#access_token=`**: cualquiera podría armar uno para dejar a otra persona conectada a una cuenta ajena.
- `cambiarContrasena(nueva, repetida)` → valida, comprueba que coincidan y la cambia.
- `mensajeError` ahora traduce los errores de inicio de sesión de Supabase. Por ejemplo, *"Invalid login credentials"* sale como "Correo o contraseña incorrectos." **Login y registro ya lo muestran sin cambios.**
- Clientes de Supabase (teléfono y web) con `flowType: "pkce"`.
- `apps/mobile/public/privacidad.html`: política de privacidad (borrador, ver abajo). Se publica con la versión web en `/privacidad.html`, y la sección para eliminar la cuenta queda en `/privacidad.html#eliminar-cuenta`.
- Nueva variable `EXPO_PUBLIC_URL_PRIVACIDAD`. `build:play` y `update:produccion` se frenan si falta; `build:apk` no.

### Pantallas a construir (dueño: Agente 3), con los componentes y el estilo actuales
1. **Login → "¿Olvidaste tu contraseña?"**: abre la nueva `app/(auth)/recuperar.tsx`.
   - Un campo de correo y un botón "Enviar enlace", deshabilitado mientras envía.
   - Llamar `await solicitarRecuperacion(correo, Linking.createURL("/restablecer"))` (con `expo-linking`) y mostrar el texto que devuelve.
   - Errores con `mensajeError`: correo inválido, demasiados intentos.
2. **`app/restablecer.tsx`**, en la raíz y **no** dentro de `(auth)`:
   - Leer la URL con `Linking.useURL()` y llamar `await sesionDesdeEnlace(url)` una sola vez. Mientras tanto: "Verificando enlace…".
   - Si falla: `mensajeError(err)` y un botón "Pedir otro enlace" que lleve a `/recuperar`.
   - Si funciona: nueva contraseña y repetirla, con el texto "Al menos 8 caracteres, con letras y números". Llamar `await cambiarContrasena(nueva, repetida)`, avisar "Contraseña actualizada" y hacer `router.replace("/resumen")`.
   - **No mostrar ni registrar la URL**: lleva el código.
3. **`app/_layout.tsx`**: la guarda de sesión tiene que dejar pasar `restablecer`. Hoy, sin sesión mandaría a `/login`, y al abrirse la sesión del enlace mandaría a `/resumen` antes de cambiar la contraseña.
   - Al inicio del efecto de redirección: `if (segments[0] === "restablecer") return;`.
   - Registrar `<Stack.Screen name="restablecer" options={{ title: "Nueva contraseña" }} />`.
4. **Registro**:
   - Antes de `signUp`: `const problema = validarContrasena(password); if (problema) return setError(problema);`.
   - Mostrar los requisitos bajo el campo.
   - Bajo el botón: "Al crear tu cuenta aceptas la Política de privacidad", con enlace. **Reemplazado el 16-oct por una casilla de aceptación: ver «Documentos legales y aceptación» al final.**
5. **Más**:
   - "Política de privacidad": `WebBrowser.openBrowserAsync(process.env.EXPO_PUBLIC_URL_PRIVACIDAD!)`. Si la variable falta, ocultar la opción.
   - "Eliminar mi cuenta": ver la fase 1.
6. **Pantalla de error**: exportar en `app/_layout.tsx` `export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)` (de expo-router).
   - Mostrar "Algo salió mal", "Tus datos están a salvo", un botón "Reintentar" (`retry`) y otro "Volver al inicio".
   - El texto técnico del error, solo con `__DEV__`.
   - Sin esto, un fallo al dibujar una pantalla deja la app en blanco.
7. **Textos**: en `registro.tsx` y `correo.tsx` todavía hay voseo ("iniciá", "entrá", "revisá"). El resto de la app usa tú.

## Billeteras y ubicación — Fase 1 (16-oct)

Plan completo: `docs/plan-billeteras-y-ubicacion.docx`. Migración `20261016120000_billeteras_y_ubicacion` ("Migración de billeteras y ubicación"). **No hay pantallas que hacer en esta fase**: esto es lo que la Fase 2 va a usar.

### Datos nuevos en core
- `Gasto.billetera?: "apple_pay" | "google_wallet" | "otra"` ("pagado con"). **No es un método de pago**: el método sigue siendo débito o crédito. Solo es válida con `metodoPago` débito, crédito, diferido o sin método; zod y la base rechazan Apple Pay con efectivo o transferencia.
- `Gasto.ubicacion?: { latitud, longitud, precisionM? }` y `Gasto.lugarId?`. La base redondea a 4 decimales (~11 m) y asigna el lugar sola: el más cercano dentro de su radio (80 m), o crea uno nuevo con la descripción del gasto. Con `precisionM > 200` no asigna lugar.
- `Lugar { id, nombre, latitud, longitud, radioM, createdAt }` y `listarLugares()`.
- `TransaccionDetectada.origen: "correo" | "apple_pay" | "google_wallet"`, más `comercio?`, `ubicacion?` y `tarjetaFinal?`. Al confirmar un aviso de billetera, el gasto recibe la billetera, el método según la tarjeta elegida (crédito o débito) y la ubicación. Al confirmar o descartar, la base borra del aviso el asunto, el comercio, la ubicación y la tarjeta.
- Etiquetas: `ETIQUETA_BILLETERA`, `OPCIONES_BILLETERA`, `ETIQUETA_ORIGEN_TRANSACCION`. Ayudantes: `billeteraCompatible(metodo)`, `ubicacionSchema`, `ubicacionSegura(valor)`.

### Cómo se usa
- Crear: `crearGasto({ ..., metodoPago: "credito", billetera: "apple_pay", ubicacion })`. Sin billetera ni ubicación no se envían las columnas nuevas: sigue funcionando con una base que todavía no tiene la migración.
- Editar: `actualizarGasto(id, { billetera: "" })` la quita; `{ ubicacion: null }` quita la ubicación y el lugar; `{ lugarId }` elige el lugar a mano. Cambiar el método a efectivo o transferencia quita la billetera sola.
- El selector "Pagado con" solo se muestra si `billeteraCompatible(metodoPago)`.
- **Antes de mostrar billetera o ubicación en pantalla, la migración tiene que estar aplicada en Supabase web**: si no, `crearGasto` con `billetera` falla con "columna no existe".

## Billeteras y ubicación — Fase 2 (16-oct): registrar a mano

Migración `20261016130000_borrar_ubicaciones` ("Migración de borrar ubicaciones"). La app del teléfono pasa a la **versión 1.1.0**: `expo-location` es nativo, así que hace falta una APK nueva (EAS Update no alcanza). En `app.json` el permiso en segundo plano queda bloqueado.

### Lógica lista (probada)
- **Teléfono y su versión web** (`apps/mobile/lib/ubicacion.ts`): `guardarUbicacionActiva()`, `cambiarGuardarUbicacion(activar)`, `ubicacionParaNuevoGasto()` y `abrirEnMapas(ubicacion)`.
- **Web de escritorio** (`apps/desktop/src/lib/ubicacion.ts`): las mismas, pero con `enlaceMapaWeb(ubicacion)` en lugar de `abrirEnMapas`. Solo funciona con HTTPS o en localhost.
- `ubicacionParaNuevoGasto()` **nunca lanza ni pide permiso** y espera como mucho 8 s. Devuelve `{ ubicacion }` o `{ motivo }`. Para el aviso, usar `MENSAJE_SIN_UBICACION[motivo]`; si es `undefined` (preferencia apagada), no se muestra nada.
- La preferencia «Guardar la ubicación de mis pagos» está **apagada por defecto** y es **de cada usuario**: otra persona que inicie sesión en el mismo teléfono no la hereda.
- Encenderla pide el permiso del sistema en ese momento. Si se niega, devuelve `{ activa: false, motivo: "sin_permiso" }` y queda apagada.
- `borrarMisUbicaciones()` (core) quita la ubicación y el lugar de todos los gastos y la ubicación de los avisos, y borra los lugares, en un solo paso. Devuelve `{ gastos, avisos, lugares }`. Los gastos y los saldos no cambian.

### Pantallas a construir (dueño: Agente 3), con los componentes y el estilo actuales
1. **Nuevo gasto** (`app/gasto/nuevo.tsx`, y `NuevoGasto` en `views/Gastos.tsx` de la web):
   - Debajo del método: el selector **«Pagado con»**, con las opciones Tarjeta (sin billetera) + `OPCIONES_BILLETERA` y las etiquetas de `ETIQUETA_BILLETERA`. Mostrarlo solo si `billeteraCompatible(metodoPago)`. Si el método cambia a uno incompatible, limpiar la elección.
   - Al guardar, **antes** de `crearGasto`: `const r = await ubicacionParaNuevoGasto();`. Después: `crearGasto({ ...lo de hoy, billetera: billetera || undefined, ubicacion: r.ubicacion })`.
   - Mientras espera el GPS, el botón dice "Guardando…" (como hoy).
   - Si `r.motivo` tiene mensaje, mostrarlo después de guardar como aviso suave (el gasto ya se guardó), no como error.
2. **Detalle o fila del gasto**:
   - Si `gasto.billetera`: una etiqueta pequeña con `ETIQUETA_BILLETERA[gasto.billetera]`.
   - Si `gasto.lugarId`: el nombre del lugar (de `listarLugares()`, por id).
   - Si `gasto.ubicacion`: el botón **«Abrir en Mapas»**, con `abrirEnMapas(gasto.ubicacion)` en el teléfono o un `<a target="_blank" rel="noopener">` a `enlaceMapaWeb(...)` en la web.
3. **Más → «Ubicación de mis pagos»** (pantalla nueva, por ejemplo `app/ubicacion.tsx`):
   - Un interruptor con `guardarUbicacionActiva()` / `cambiarGuardarUbicacion(valor)`.
   - Antes de encender, el texto: "Guardaremos dónde haces cada pago para mostrarte cuánto gastas en cada lugar. Solo al registrar un pago, con la app abierta, nunca en segundo plano. Puedes borrarla cuando quieras."
   - Con `sin_permiso`: "Sin permiso de ubicación. Puedes darlo en los ajustes del teléfono."
   - El botón **«Borrar todas mis ubicaciones»**, con confirmación ("Tus gastos no se borran"). Llama a `borrarMisUbicaciones()` y muestra "Listo: N gastos quedaron sin ubicación".
   - Enlace a la política de privacidad, igual que en Más.
4. **No pedir el permiso de ubicación al abrir la app ni al abrir el formulario**: solo al encender la preferencia.

## Billeteras y ubicación — Fase 3 (16-oct): captura de Apple Pay

Migración `20261016140000_captura_apple_pay` ("Migración de captura con Apple Pay"). El atajo del iPhone llama a `registrar_pago_billetera` con la clave pública y una **clave de captura**; el pago queda **pendiente** en la bandeja. Guía para el usuario: `docs/guia-atajo-apple-pay.md`.

### Lógica lista (probada)
- `crearClaveCaptura(nombre)` devuelve la clave (`ft_` + 64 caracteres). **Es la única vez que existe fuera de la base**: mostrarla, permitir copiarla y no guardarla en ningún lado.
- `listarClavesCaptura()` devuelve `[{ id, nombre, prefijo, createdAt, ultimoUso? }]`.
- `revocarClaveCaptura(id)` la borra; los avisos que ya llegaron se quedan.
- Máximo `MAXIMO_CLAVES_CAPTURA` (5) por usuario.
- `configuracionAtajo(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!)` devuelve `{ url, metodo, encabezados, campos }` para mostrar en pantalla lo que va en el atajo.
- Los avisos captados llegan con `origen: "apple_pay"`, `comercio`, `ubicacion?` y, si se reconoce la tarjeta, `cuentaId` y `banco`. Al confirmarlos, el gasto queda con la billetera, el método según la tarjeta (crédito o débito) y el lugar.

### Pantallas a construir (dueño: Agente 3)
1. **Más → «Conectar Apple Pay»** (pantalla nueva, por ejemplo `app/apple-pay.tsx`):
   - Explicación corta: "Cada pago con Apple Pay llega a tu bandeja para que lo confirmes. Necesitas iOS 17 o más nuevo."
   - Un enlace a los pasos de `docs/guia-atajo-apple-pay.md`: copiar el texto a la pantalla o a una página web.
   - **Crear clave**: pedir un nombre ("Mi iPhone") y llamar a `crearClaveCaptura`. Mostrar la clave **una sola vez** en un `<Text selectable>`, con un botón **Compartir o copiar** (`Share.share({ message: clave })`, que no necesita librería nativa nueva) y el aviso "Guárdala ahora: no se vuelve a mostrar". Al salir de la pantalla, olvidarla del estado.
   - Mostrar la **URL** y la **clave pública** de `configuracionAtajo(...)`, también seleccionables.
   - **Lista** de `listarClavesCaptura()`: nombre, `ft_${prefijo}…`, creada y último uso ("nunca" si no tiene). Cada una con **Revocar**, que pide confirmación ("El atajo que la usa dejará de funcionar") y llama a `revocarClaveCaptura(id)`.
   - Con 5 claves, deshabilitar «Crear clave» y decir "Revoca una para crear otra".
2. **Bandeja** (`app/bandeja.tsx`):
   - Mostrar de dónde vino cada aviso con `ETIQUETA_ORIGEN_TRANSACCION[t.origen]` y un ícono (correo o billetera), y `t.comercio` si lo tiene.
   - Si tiene `t.ubicacion`, el botón «Abrir en Mapas» (`abrirEnMapas(t.ubicacion)`).
   - Si `t.cuentaId` falta, la cuenta se elige al confirmar, como hoy.
3. **Errores**: `mensajeError(err)`. Los mensajes de la base ya están en español ("Ya tienes 5 claves: revoca una antes de crear otra.").

## Billeteras y ubicación — Fase 5 (16-oct): resumen por lugar

Migración `20261016150000_resumen_por_lugar` ("Migración de resumen por lugar").

### Lógica lista (probada)
- `resumenPorLugar(desde, hasta)` devuelve, del lugar que más suma al que menos: `[{ lugarId, nombre, latitud, longitud, pagos, total, promedio, porcentaje, primerPago, ultimoPago, categoriaId?, billetera? }]`. Los gastos sin lugar no cuentan.
- `resumenPorComercio(desde, hasta)` junta los lugares que **se llaman igual** (sin mirar mayúsculas ni espacios) y devuelve `[{ comercio, locales, pagos, total, promedio, ultimoPago, lugarIds }]`. Para juntar sucursales, basta con ponerles el mismo nombre.
- El rango es de **2 años como máximo** y se valida antes de ir a la red (`validarRangoResumen`).
- `listarGastosDeLugar(lugarId, { desde, hasta })` da los pagos de un lugar, los más recientes primero.
- `renombrarLugar(id, nombre)` acepta de 1 a 80 caracteres.
- `eliminarLugar(id)`: sus gastos se quedan, sin lugar.
- `fusionarLugares(origenId, destinoId)` pasa los pagos y borra el origen en un solo paso. Devuelve cuántos pagos movió.
- `generarRecomendaciones({ ..., lugares })`: si se le pasa `listarLugares()`, avisa cuando el lugar con más gasto del mes ya supera en 30 % o más a todo el mes pasado (con un mínimo de $20). Si no se le pasa, todo sigue igual.

### Pantallas a construir (dueño: Agente 3)
1. **Más → «Lugares»** (pantalla nueva, por ejemplo `app/lugares.tsx`):
   - Selector de mes (por defecto, el actual) y la lista de `resumenPorLugar(primerDía, últimoDía)`.
   - Cada fila: nombre, total, número de pagos y una barra con `porcentaje`.
   - Un interruptor «Por comercio» cambia a `resumenPorComercio`; muestra "N locales" si son varios.
   - Sin datos: "Todavía no hay pagos con ubicación este mes. Actívala en «Ubicación de mis pagos»."
2. **Detalle del lugar**:
   - Totales del resumen, «Abrir en Mapas» y la lista de `listarGastosDeLugar(id, rango)`.
   - Acciones: **Renombrar**, **Fusionar con…** (elegir otro lugar de `listarLugares()`, con la confirmación "Los pagos de A pasan a B y A se borra") y **Borrar lugar** ("Los pagos no se borran").
3. **Resumen** (pestaña): una tarjeta **«Dónde más pagas»** con los 3 primeros de `resumenPorLugar` del mes. Se oculta si no hay ninguno.
4. **Recomendaciones**: pasar `lugares: await listarLugares()` a `generarRecomendaciones`.

## Cuentas — fases A y B (16-oct): casas comerciales y fecha de corte

Migración `20261016160000_casas_comerciales_y_corte`. **Pantallas hechas** en el teléfono (`(tabs)/tarjetas.tsx`, `tarjeta/[id].tsx`, `components/TarjetaVisual.tsx`); la web de escritorio queda pendiente.
- `Banco` ahora incluye las casas comerciales (`OPCIONES_CASA_COMERCIAL`, `esCasaComercial`). Siempre son `tipo: "credito"`, porque así lo exigen zod y la base.
- `inicialesDeEntidad(banco)` da las iniciales para el ícono cuando no hay logo.
- `Cuenta.diaCorte?` y `Cuenta.diaPago?` (1 a 31, solo en crédito). `actualizarFechasTarjeta(id, { diaCorte, diaPago })`: `null` los quita.
- `cicloTarjeta(diaCorte, hoy, diaPago?)` devuelve `{ corte, diasHastaCorte, inicio, pago?, diasHastaPago? }`. Además: `corteDeGasto(fecha, diaCorte)`, `pagoDeCorte`, `fechaDelDia` y `textoDias`.

## Cuentas — fase C (16-oct): recordatorios automáticos de diferidos

Migración `20261016170000_recordatorios_diferidos`. **Pantalla hecha** en el teléfono (`app/recordatorios.tsx`); la web de escritorio queda pendiente (ahí se ven como recordatorios normales).
- La base crea un recordatorio por cuota al registrar un gasto diferido: el mismo día de la compra cada mes (recortado al último día en meses cortos), con el monto de la cuota y el título «Cuota 1 de 3 · Televisor». Nunca se crean desde la app.
- `Recordatorio.automatico?: boolean` los distingue. La base no deja convertirlos en manuales ni crear uno automático sin deuda.
- Al registrar abonos (`registrarAbonoDeuda`), la base marca como hechas las cuotas ya pagadas; al saldar la deuda, todas. Al borrar el diferido se borran sus recordatorios automáticos; los manuales que apuntaban a esa deuda se quedan, sin deuda.
- `organizarRecordatorios(lista, hoy)` → `{ proximos, cuotasDespues, anteriores }`: de cada diferido muestra solo la cuota que toca y cuántas quedan; una cuota sigue a la vista hasta la fecha de la siguiente y después pasa a «anteriores» (así, al terminar el plazo, no queda nada pendiente). `textoVencimiento(fecha, hoy)` da «hoy», «mañana», «en 4 días», «venció hace 3 días».
- Los avisos en el teléfono (notificaciones) de estos recordatorios llegan con la fase D.

## Documentos legales y aceptación (16-oct)

Términos y condiciones nuevos, política de privacidad ampliada y **constancia de aceptación en la base**. Todo el detalle legal está en [`docs/legal/README.md`](legal/README.md); aquí solo lo que toca a las pantallas.

### Base de datos (probada: 27 + 10 pruebas nuevas, y la suite completa en verde)
Hora y qué es, como pide el usuario (archivos en `supabase/para-supabase-web/16-10-2026 5AM/`):
- **gastos-app — Migración de aceptación de términos y privacidad · 16-10-2026 5AM** (`20261016210000`, archivo `2`): tabla `aceptaciones_legales` (**solo lectura** para la persona), función `registrar_aceptacion_legal` y un disparador en `auth.users` que anota la aceptación del registro con la hora del servidor.
- **gastos-app — Migración de exportación de datos personales · 16-10-2026 5AM** (`20261016211000`, archivo `3`): `exportar_datos_persona(correo)`, solo para quien administra (derechos de acceso y portabilidad). **La app no la usa.**

### Lógica lista en core (probada, 19 pruebas)
- `VERSION_LEGAL` (`{ terminos, privacidad }`, una fecha cada una), `DOCUMENTOS_LEGALES`, `plataformaLegal(Platform.OS)` → `"android" | "ios" | "web"`.
- `datosAceptacionRegistro(plataforma?)` → el objeto para `signUp({ options: { data } })`.
- `documentosLegalesPendientes()` → qué documentos faltan de aceptar (vacío = al día). Una versión más nueva ya aceptada no se vuelve a pedir.
- `aceptarDocumentosPendientes(plataforma?)` → registra todos los pendientes; devuelve cuáles. Es idempotente: reintentar es seguro.
- `registrarAceptacion(documento, plataforma?)` y `listarAceptaciones()`, por si hace falta algo más fino.
- `destinoPorAceptacion({ exigir, haySesion, estado, ruta })`: qué hace la guarda de rutas (`"esperar"`, una ruta o `null`). `EstadoAceptacion` y `RUTA_ACEPTAR_TERMINOS` también salen de core.
- **La pantalla nunca elige la versión**: siempre es la de la app (`VERSION_LEGAL`). Así nadie «acepta» un texto que no vio.
- Páginas públicas: `apps/mobile/public/terminos.html` y `privacidad.html`. Variables: `EXPO_PUBLIC_URL_TERMINOS`, `EXPO_PUBLIC_URL_PRIVACIDAD` (ya existía) y `EXPO_PUBLIC_CORREO_PRIVACIDAD`. **Las tres vacías en desarrollo: ocultar los enlaces si faltan.**

### Pantallas (construidas el 16-oct por la sesión de lógica, a pedido del usuario)
Todo va detrás de **`EXPO_PUBLIC_EXIGIR_ACEPTACION=1`** (apagado por defecto): con el interruptor apagado la app se comporta **exactamente como antes**. Se enciende cuando la base ya tiene las migraciones de aceptación y las páginas legales están completas; sin las migraciones, la pantalla de aceptación bloquearía a todos. `build:play` y `update:produccion` exigen que sea `1`.
1. **Registro** (`app/(auth)/registro.tsx`): casilla obligatoria «Acepto los Términos y condiciones y la Política de privacidad» (`components/Casilla.tsx` y `EnlaceLegal.tsx`; solo la casilla alterna, los enlaces abren el documento). «Crear cuenta» queda deshabilitado hasta marcarla, y `signUp` manda `datosAceptacionRegistro(plataformaLegal(Platform.OS))` en `options.data`: el disparador de la base anota la aceptación aunque aún no se haya confirmado el correo.
2. **`app/aceptar-terminos.tsx`** (con `components/PantallaAceptacion.tsx`, que solo dibuja): «Revisa y acepta para continuar», con los documentos pendientes como enlaces, «Acepto y continuar» (`aceptarDocumentosPendientes`) y «No acepto: cerrar sesión». Estados: verificando, error al comprobar (con «Reintentar»: no se entra sin saber) y error al guardar.
3. **`app/_layout.tsx`**: tras iniciar sesión comprueba `documentosLegalesPendientes()` una vez por persona (el resultado va atado al id de usuario: si entra otra en el mismo teléfono, no vale el de la anterior) y aplica `destinoPorAceptacion` (lógica pura de core, con pruebas): verificando → espera con un velo; pendiente o error → `/aceptar-terminos`; al día → resumen. La pantalla avisa por `AceptacionContext` (`lib/legal.ts`).
4. **Más**: filas «Términos y condiciones» y «Política de privacidad» (abren el documento), visibles solo si su dirección está configurada. La fila «Eliminar mi cuenta» de la fase 1 **sigue pendiente**.

**Probado:** `destinoPorAceptacion` (4 pruebas), tipos sin errores y, en el navegador, la casilla y el botón (marcar habilita, desmarcar deshabilita, `aria-checked` correcto), la pantalla de aceptación en sus 4 estados, las filas de Más y que **con el interruptor apagado el registro queda idéntico**. **No probado con sesión real:** sin una cuenta de prueba y las migraciones aplicadas en Supabase no se pudo recorrer el flujo completo (registro, aceptación guardada, pantalla de aceptar, resumen).

**No hacer**: no guardar la aceptación en `AsyncStorage` ni en el teléfono: no es prueba. La constancia vive solo en la base.

### Para quien agregue tablas o servicios
- Una tabla nueva con `usuario_id` **debe** tener `ON DELETE CASCADE` hacia `auth.users`, estar en `exportar_datos_persona` y en `docs/legal/registro-tratamiento-datos.md`. Pruebas de base y de lógica fallan si falta alguna de las tres.
- Si el **fondo** de un texto legal cambia, hay que cambiar su etiqueta `version-legal` **y** `VERSION_LEGAL`: la app vuelve a pedir la aceptación (una prueba exige que coincidan).
- `build:play` y `update:produccion` se frenan mientras las páginas legales tengan `[datos por completar]` o falten las tres variables.

## Billeteras y ubicación — Fase 4 (16-oct): captura de Google Wallet

Migración `20261016180000_captura_google_wallet`. **Pantalla hecha** en el teléfono (`app/google-wallet.tsx`, en *Más → Conectar Google Wallet*), con el módulo nativo `apps/mobile/modules/captura-billetera` (solo Android; requiere el APK 1.1.0). Guía: `docs/guia-google-wallet.md`.
- RPC `registrar_aviso_billetera(p_clave, p_titulo, p_texto, p_paquete?, p_cuando?)`, solo `anon`. La base lee la notificación (`leer_aviso_google_wallet`) y usa `registrar_pago_billetera` con `google_wallet`. Responde `{estado: "recibido" | "repetido", monto}` o `{estado: "ignorado"}` (sin monto, rechazado o reembolso). Errores: 28000 clave, 22023 app no admitida o monto, PT429 límite.
- `p_cuando`: milisegundos de la notificación; si llega tarde (hasta 3 días), el aviso queda con la fecha del pago.
- Core: `configuracionGoogleWallet(url, clavePublica)` y `PAQUETE_GOOGLE_WALLET`.
- Módulo JS `capturaGoogleWallet` (null fuera del APK de Android): `estado()` → `{conectado, prefijo, permiso, pendientes, ultimo}`, `conectar(url, apikey, clave)`, `desconectar()`, `abrirPermiso()` y `reintentar()`. La clave se guarda solo en el almacenamiento privado del teléfono y nunca vuelve a JS.

## Isla de detalle de transacciones (16-oct)

**Pantallas hechas** en el teléfono: `components/IslaDetalle.tsx`, que se abre al tocar un gasto (Gastos), un ingreso (Ingresos) o «Ver detalles» en un aviso de la bandeja.
- Core: `filasDetalleGasto(gasto, {categoria, cuenta, lugar})`, `filasDetalleIngreso(ingreso, {categoria, cuenta})` y `filasDetalleAviso(aviso, {cuenta})` devuelven `FilaDetalle[]` (`{clave, etiqueta, valor, mono?}`), solo con los datos que existen. El tercer parámetro opcional `{zona}` fija la zona horaria (por defecto, la del teléfono).
- Además: `fechaLarga("2026-10-16")` → «viernes, 16 de octubre de 2026», `fechaHora(createdAt)` → «16 oct 2026, 14:32» y `textoUbicacion(u)` → «-0.1807, -78.4678 (±12 m)».
- «Registrado» es el `created_at` del gasto: la hora en que se guardó. En un aviso de Apple Pay o Google Wallet, la bandeja muestra la «Hora del pago» (`created_at` del aviso).
- **Mapa:** si hay ubicación (la del gasto o, si no, la del lugar elegido), la isla muestra `components/MapaUbicacion.tsx`, con 3×3 teselas de OpenStreetMap y el alfiler; tocarlo abre Mapas. Core: `mapaEstatico(u)` → `{teselas, puntoX, puntoY, radioPrecisionPx}`, más `posicionEnTeselas`, `metrosPorPixel` y `ATRIBUCION_MAPA` («© OpenStreetMap contributors», obligatoria en pantalla y enlazada a `URL_ATRIBUCION_MAPA`). Las teselas se piden solo al abrir el detalle: el servidor de mapas ve la zona aproximada.
- **Hora del pago** (migración `20261016220000_hora_del_pago`): `Gasto.pagadoEn?` y `TransaccionDetectada.pagadoEn?`. Al confirmar un aviso de Apple Pay o Google Wallet, el gasto guarda `coalesce(aviso.pagado_en, aviso.created_at)`. Google Wallet guarda en el aviso la hora de la notificación (`p_cuando`). La isla muestra «Hora del pago» antes de «Registrado».
- **Semana de hoy en Gastos:** `semanaDeFecha(fecha)` (1-7 → 1, 8-14 → 2, 15-21 → 3, desde el 22 → 4) y `semanaInicial(mes, hoy?)` (la de hoy en el mes actual; en otro mes, la 1).

## Editar gastos e ingresos y fecha de «+ Nuevo» (16-oct)

**Pantallas hechas** en el teléfono: `app/gasto/editar.tsx` y `app/ingreso/editar.tsx` (parámetro `id`), con `components/FormularioEdicion.tsx`. Se abren con «Editar» en la isla de detalle.
- Core: `obtenerGasto(id)`, `obtenerIngreso(id)`, `edicionPermitida(gasto)` → `{monto, cuenta, fecha, aviso?}`, `cambiosDeGasto(original, formulario)` y `cambiosDeIngreso(...)`, que devuelven solo lo que cambió (`sinCambios` si nada). Si se intenta cambiar algo que un diferido no permite, lanzan `MENSAJE_EDICION_DIFERIDO`.
- **Diferidos:** solo cambian la descripción y la categoría. La migración `20261016230000_diferido_fecha_fija` agrega la fecha a lo que la base no deja cambiar (antes ya estaban el monto, la tarjeta, el método y el plazo), porque la deuda y los recordatorios de cuotas dependen de ella.
- Los saldos se reajustan solos al editar el monto o la cuenta (disparadores de siempre); por encima del cupo, la base rechaza el cambio.
- **«+ Nuevo»** recibe `mes` (y `semana` desde Gastos). `fechaPropuesta(mes, hoy?, semana?)` devuelve hoy si cae en ese período, su último día si ya pasó o su primer día si todavía no llega. El formulario avisa cuando la fecha no es hoy.
