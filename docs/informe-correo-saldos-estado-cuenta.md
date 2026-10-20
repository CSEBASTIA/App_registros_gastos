# Informe: correo que registra solo, saldos, lugar del consumo y estado de cuenta (19/20-oct-2026)

**Pedido:**
1. Los estados de cuenta no funcionaban al agregarlos (se probó con un estado de cuenta real de ahorros de Banco Pichincha, de 11 páginas).
2. Con el correo vinculado, la app debe registrar sola lo que llega: consumos con tarjeta de crédito y de débito, transferencias y **pagos de tarjeta** (ejemplo: un consumo con tarjeta del 17-oct que no se detectó).
3. El lugar de un consumo debe ser el sitio donde se consumió («consumo de $80 con la tarjeta •••• xxxx en Aki Tarqui, ubicado en …»).
4. Ninguna cuenta puede quedar con saldo negativo, salvo las tarjetas; una tarjeta que se pasa del cupo se pone **en rojo con un signo de peligro** (sobreendeudamiento).

«Nada más»: solo esto, sin funciones extra.

## 1. Por qué no funcionaba

| Problema | Causa |
|---|---|
| El estado de cuenta salía «sin movimientos» | El código publicado (`main`, el que despliega Vercel) leía **0 movimientos** del PDF: partía cada fila en dos. Eso ya estaba arreglado en la rama (`22fdaed`), pero esa versión leía solo los débitos y perdía todos los créditos: tomaba el primer número de la fila, que en «0.00 10.00 11.06» era el 0.00 de la columna DÉBITO. Además, el estado (más de 300 filas) pasaba el tope de 300 |
| El consumo del 17-oct no se veía | El lector de correos tomaba la **primera fecha** del aviso, y en el de Banco Guayaquil era «Fecha de corte 2026-11-17»: el gasto quedaba con fecha de noviembre (en el futuro). Y la app solo buscaba al tocar «Buscar ahora» |
| Los avisos de Pichincha no se reconocían | «Pago exitoso», «¡Transferencia exitosa!» y «Monto: USD 7.5» (un solo decimal) no coincidían con ninguna palabra ni monto del lector |
| Nada se registraba solo | Todo lo del correo iba a la Bandeja; el registro automático solo existía para Google Wallet y Apple Pay |

## 2. Qué hace ahora

### Estado de cuenta
- Lee las columnas **DÉBITO / CRÉDITO / SALDO**: cada fila sale como gasto (salida) o ingreso (entrada). Si solo hay una columna de monto, el saldo de la fila dice si entró o salió.
- Con el PDF real: todas las salidas y entradas, y sus sumas coinciden al centavo con el resumen del estado (cantidad y total de débitos y de créditos); saldo anterior + entradas − salidas = el «SALDO ACTUAL» del PDF.
- Las descripciones ya no llevan la oficina y el número de documento («12 1000001 TRANSFERENCIA INTERNET» → «TRANSFERENCIA INTERNET»).
- Los créditos que el estado marca como tales salen **marcados** como ingresos. Los que solo «parecen» abonos por sus palabras siguen saliendo sin marcar.
- Tope por importación: **1.000 filas** (antes 300).
- Muestra el saldo final que declara el estado y si coincide con el de la cuenta después de importar.
- Se guardan **primero los ingresos y después los gastos**, así una cuenta de ahorro nunca pasa por negativo a mitad del guardado.

### Correo: registra solo
- **Busca solo** al abrir la app y al volver a ella (como mucho cada 10 minutos), además de «Buscar ahora».
- **Lector por plantillas** con los formatos reales de tus bancos (nombres, tarjetas y cuentas de las pruebas son inventados):

| Banco | Aviso | Qué se registra |
|---|---|---|
| Guayaquil | «X realizó un consumo por $ … en COMERCIO» | **Consumo** con la tarjeta de esos dígitos, con hora exacta y comercio |
| Guayaquil | «Gracias por el pago de tu tarjeta» + comprobante «PAGO TARJETA PROPIA» | **Pago de tarjeta** (sube el cupo y baja la cuenta de origen) **una sola vez**, aunque lleguen los dos correos |
| Guayaquil | Comprobante de transferencia interbancaria | **Transferencia** por el valor transferido + la **comisión** como gasto aparte |
| Pichincha | «TARJETAS DE DÉBITO · Pago exitoso» | **Consumo** con débito, con comercio, tarjeta y hora |
| Pichincha | «¡Transferencia exitosa!», «TRANSFERENCIA · Pago realizado correctamente» | **Transferencia** con cuenta de origen y destino; «será debitada…» (aviso previo) se ignora |

- **Cuándo se registra solo** (con «Registrar solo cuando reconozco la tarjeta» encendido, que ya lo está por defecto):
  - Consumos: la tarjeta o cuenta se reconoce por sus **últimos dígitos**. Los dígitos se anotan en el detalle de cada cuenta. Una cuenta del banco que aún no tiene dígitos también sirve si es la única.
  - Pagos de tarjeta: se reconocen la tarjeta y la cuenta desde la que pagaste.
  - Transferencias: solo si **las dos cuentas son tuyas** (se reconocen por sus dígitos). Una transferencia a otra persona va a la Bandeja, porque la app no puede saber si es tuya.
- **No duplica**: lo que ya registró Google Wallet a la misma hora (±10 min) se da por registrado. El aviso «recibida» de una transferencia ya registrada se junta con ella. Si anotaste a mano lo mismo ese día (mismo monto y cuenta, sin hora), lo deja en la Bandeja para que tú decidas.
- **Notificación** «Registré $12,50 en SUPERMAXI · Con tu tarjeta •••• 1234 · Comida». Tocarla abre Gastos, Tarjetas o Transferencias.
- **Bandeja:** los pagos de tarjeta pendientes se confirman eligiendo la tarjeta y la cuenta de origen. Las transferencias con comisión lo avisan.
- **Primera búsqueda con la versión nueva:** los avisos pendientes del correo leídos con el lector anterior se borran y se vuelven a leer los **últimos 30 días** (los confirmados y descartados no se tocan). Así el consumo del 17-oct entra con su fecha real.
- El interruptor de registro automático también aparece en *Más → Correo*.

### Lugar del consumo
- Si ya tienes un lugar con el nombre del comercio, el gasto va a ese lugar.
- Si no, y tienes activado **«Guardar la ubicación de mis pagos»**, la app busca el comercio en OpenStreetMap cerca de donde estás (hasta 15 km). Le pone ubicación al gasto, crea el lugar con el nombre del comercio y guarda su **dirección**. El detalle del gasto muestra «Lugar: AKI TARQUI · ubicado en …» y la pantalla del lugar, «Ubicado en …».
- Es una aproximación: el correo trae el nombre, no la sucursal. Si hay varias sucursales con el mismo nombre, puede elegir otra; se corrige moviendo o renombrando el lugar.

### Saldos
- **Ahorro, débito y efectivo nunca quedan en negativo**, venga de donde venga: gasto, transferencia, pago de tarjeta, abono a una deuda o borrar un ingreso. La base lo rechaza con «La cuenta «X» no puede quedar con saldo negativo…». Una cuenta que ya estaba en negativo (datos de antes) puede subir, pero no bajar más.
- **Una tarjeta sí puede pasarse del cupo.** Se quitó el rechazo por cupo de los gastos y de los avances. La tarjeta queda **en rojo con ⚠** y el texto «Sobreendeudada: te pasaste $X del cupo», en el teléfono, en la web y en el escritorio.
- Formularios: «Nuevo gasto» y «Transferir» avisan que la tarjeta quedará sobreendeudada (sin bloquear) y bloquean si una cuenta quedaría en negativo.

## 3. Cómo está hecho

**Base:** la **Migración de saldos y registro del correo** (`20261019120000_saldos_y_registro_del_correo.sql`) trae:
- `validar_saldo_cuenta` + `trg_validar_saldo_cuenta`, sobre `cuentas`.
- Fuera `trg_03_validar_cupo_gasto` y los disparadores de la «Migración de cupo en lote» (que está aplicada en Supabase web).
- `validar_transferencia` sin el rechazo por cupo.
- En `transacciones_detectadas`: `clase`, `contraparte_cuenta_id` (con índice) y `comision`. En `lugares`: `direccion`.
- `registrar_avisos_correo()`: *security definer*, solo para usuarios con sesión y solo procesa los avisos de quien llama. Cada aviso va en su propio bloque: si uno falla, queda en la Bandeja y los demás siguen.
- `confirmar_aviso_como_pago_tarjeta()`: *security invoker*, con RLS.

**Core:**
- `correoBancario.ts`: plantillas por banco; la fecha nunca es la de corte o vencimiento; acepta montos «USD 7.5».
- `sincronizacionCorreo.ts`: `cuentaPorDigitos` (3 dígitos del aviso coinciden con 4 anotados: «234» con «1234»), `avisosDeCorreos` con clase, la otra cuenta y la comisión, `resumenSincronizacion` y `textoNotificacionRegistrado`.
- `transaccionesDetectadas.repo.ts`: `registrarAvisosDelCorreo`, `confirmarAvisoComoPagoTarjeta`, `borrarAvisosPendientesDelCorreo`. Si la base no tiene la migración, se reintenta sin las columnas nuevas.
- `ubicarComercio.ts` (búsqueda del comercio), `guardarDireccionLugar`.
- `estadoCuenta.ts`: columnas DÉBITO/CRÉDITO/SALDO y `saldosDelEstado`.
- `importacionEstadoCuenta.ts`: `saldoQuedariaNegativo` (reemplaza `cupoInsuficiente`) y tope de 1.000 filas.
- `importarMovimientos`: ingresos primero.

**Teléfono:**
- `lib/correoProveedor.ts`: `sincronizarCorreoSiToca`, `despuesDeSincronizar` y la relectura de 30 días.
- `lib/ubicarComercios.ts`, y `avisarRegistradosDelCorreo` en `lib/notificaciones.ts`.
- Pantallas y componentes: `_layout`, Correo, Bandeja, Importar estado, Nuevo gasto, Transferir, Lugar, `TarjetaVisual` y `RegistroAutomatico`.

**Escritorio:** `TarjetaVisual` (rojo + ⚠) e importar estado de cuenta.

**Versión de la app:** sigue en 1.4.0. No hay módulos nativos nuevos (`expo-location` y `expo-notifications` ya estaban).

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| Pruebas de core | **251/251**. Nuevas: 13 del lector por plantillas, 8 del registro del correo (dígitos, inserción con y sin la migración, respuesta de la base, resumen, notificación), 3 de la ubicación del comercio y 5 del estado de cuenta y la importación (columnas, saldo por fila, ingresos primero, tarjeta sobreendeudada, cuenta en negativo) |
| El PDF real, con el lector de la app (pdf.js 4.10.38 empaquetado) | `main`: **0** movimientos. Rama anterior: solo los débitos. **Ahora: todos**; cantidad y total de débitos y de créditos iguales al resumen del PDF, y saldo anterior y final leídos |
| Avisos reales del correo | Se leyeron para ver el formato: consumo con tarjeta, pago de tarjeta, comprobante de pago, interbancaria y los de Pichincha. Las pruebas usan esa estructura con datos inventados; no se copió ningún dato personal al código ni a este informe |
| Pruebas del teléfono (JS) y del escritorio | 18/18 y 3/3 |
| Tipos (`tsc`) | Sin errores en el teléfono (incluye core) y en el escritorio |
| Pruebas de la base (`bash supabase/tests/correr.sh`, Postgres desechable) | **351/351 PASS, 0 FAIL** en 21 archivos, más la de concurrencia (PASS). Nuevo: `saldos_y_registro_del_correo.sql`, 29 casos (saldos S01–S07, consumos C1–C5, pagos P1–P3, transferencias T1–T4, Bandeja R1–R2, registro apagado y aislamiento U1–U2, seguridad X01–X03). Se ajustaron 4 pruebas que esperaban el rechazo por cupo (E05, T05, R09 y las de diferidos): ahora comprueban que la tarjeta queda en negativo |
| Archivo para Supabase web sobre una base con las 36 migraciones anteriores | Termina en **«aplicada = sí»** y las 29 pruebas nuevas pasan sobre ella |
| `base-completa.sql` en una base vacía | **«migraciones_registradas = 37»** y las 29 pruebas nuevas pasan |
| **No probado** | En un teléfono real: la búsqueda automática con tu Gmail, las notificaciones, la búsqueda en OpenStreetMap y la tarjeta en rojo en pantalla. Bancos sin muestras: Produbanco, Diners, Austro; DeUna (Peigo) no se lee |

## 5. Seguridad y privacidad

- **Lo que se registra solo** va únicamente a cuentas que la persona identificó (dígitos anotados, o la única cuenta del banco sin dígitos). Un correo de un remitente que no es de un banco conocido nunca usa plantillas. Como no se verifica DKIM/SPF, un correo falso con el remitente real podría crear un movimiento; queda a la vista y se elimina desde la notificación o desde Gastos.
- `registrar_avisos_correo` usa `auth.uid()` y no recibe parámetros. Una «otra cuenta» que no es de quien llama se ignora (prueba T3). anon no puede ejecutar las funciones nuevas, y todas fijan `search_path` (X01–X02).
- **Minimización:** el aviso resuelto olvida asunto, comercio y dígitos (C1b). No se guardan los nombres de los beneficiarios de las transferencias.
- **OpenStreetMap / Nominatim:** solo con la ubicación de pagos activada. Se envía el nombre del comercio y un cuadro de ~28 km alrededor del teléfono (con 2 decimales), con `User-Agent` propio y como mucho una búsqueda por segundo. No se envían montos, tarjeta, cuenta ni correo. Quedó en `docs/legal/registro-tratamiento-datos.md`.
- **Política de privacidad pública:** conviene agregar el registro automático desde el correo y la búsqueda del comercio en OpenStreetMap. Es un cambio de texto legal, así que hay que subir `version-legal`; no lo cambié.

## 6. Lo que te toca

1. **Aplicar la base** en Supabase → SQL Editor → New query. Pegar entero `supabase/para-supabase-web/20-10-2026 2AM/1 - cuentas, gastos, transferencias, pagos_tarjeta, transacciones_detectadas, lugares (saldos y registro del correo).sql` y darle Run. Nombre: **«gastos-app — Migración de saldos y registro del correo · 20-10-2026 2AM»**. Debe terminar en «aplicada = sí».
   - Tu Supabase web ya tiene la «Migración de cupo en lote» (del 18-oct), que va en contra de lo que pediste. Esta migración la desactiva: se probó sobre una base igual a la tuya y no queda ningún disparador de cupo. Sus archivos se quitaron del repositorio.
2. **Anota los últimos dígitos** de cada tarjeta y cuenta en su detalle (cada tarjeta de crédito y cada cuenta de ahorro). Sin ellos, lo que llegue por correo va a la Bandeja en vez de registrarse solo.
3. **Publicar la app.** Si tienes el APK 1.4.0, basta una actualización (`eas update`). Si tienes uno anterior, hay que compilar el 1.4.0. La web de Vercel toma el cambio cuando esta rama llegue a `main`.
4. Abrir la app con el correo conectado: la primera búsqueda vuelve a leer los últimos 30 días.
5. Decidir si se actualiza la política de privacidad (§5).
