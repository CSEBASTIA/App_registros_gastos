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
   - Bajo el botón: "Al crear tu cuenta aceptas la Política de privacidad", con enlace.
5. **Más**:
   - "Política de privacidad": `WebBrowser.openBrowserAsync(process.env.EXPO_PUBLIC_URL_PRIVACIDAD!)`. Si la variable falta, ocultar la opción.
   - "Eliminar mi cuenta": ver la fase 1.
6. **Pantalla de error**: exportar en `app/_layout.tsx` `export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)` (de expo-router).
   - Mostrar "Algo salió mal", "Tus datos están a salvo", un botón "Reintentar" (`retry`) y otro "Volver al inicio".
   - El texto técnico del error, solo con `__DEV__`.
   - Sin esto, un fallo al dibujar una pantalla deja la app en blanco.
7. **Textos**: en `registro.tsx` y `correo.tsx` todavía hay voseo ("iniciá", "entrá", "revisá"). El resto de la app usa tú.
