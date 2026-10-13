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
