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
