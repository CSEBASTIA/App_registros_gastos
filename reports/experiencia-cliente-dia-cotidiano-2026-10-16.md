# FinTrack: un día de uso como cliente

**Fecha:** 16 de octubre de 2026
**Alcance:** app móvil, vista web de desarrollo y servicio Supabase configurado en `apps/mobile/.env`.
**Cuenta de ensayo:** `<tu-correo>+fintrack-prueba@gmail.com` (dirección de ejemplo) (confirmada, usuario normal; la app no define roles de cliente o administrador). La contraseña se entrega en el chat, no se guarda en este archivo.

## Resumen

FinTrack ya permite registrar ingresos y gastos, llevar cuentas y tarjetas, diferir compras, controlar presupuestos y consultar recordatorios. Para una persona que paga varias veces al día, la principal fricción es **corregir y encontrar movimientos**: en el teléfono se pueden crear y borrar, pero no editar. También faltan una transferencia entre cuentas propias y una entrada rápida para gastos pequeños.

El registro reveló una fricción real: al intentar registrarse con un correo que ya existía, Supabase devolvió una respuesta sin error y sin sesión; la contraseña nueva no permitió iniciar sesión. [Supabase documenta esta respuesta ambigua para correos ya registrados](https://supabase.com/docs/reference/javascript/auth-signup). La pantalla decía que se había enviado un correo. Se ajustó el mensaje para orientar a iniciar sesión cuando la respuesta trae una identidad vacía y para evitar afirmar la creación cuando el resultado es ambiguo.

## Datos de ensayo cargados

La cuenta confirmada permite iniciar sesión. Se crearon datos ficticios con el prefijo `DEMO ·` para que puedas distinguirlos:

| Tipo | Datos | Resultado comprobado |
| --- | --- | --- |
| Cuentas | Efectivo $20, débito $100, tarjeta con cupo $300 | Saldos tras los movimientos: $19,65, $126,80 y cupo $264,00. |
| Ingreso | $50,00 a débito | Figura en ingresos y elevó el saldo de débito. |
| Gastos | Transporte $0,35; almuerzo $5,20; supermercado $18,00; audífonos diferidos $36,00 | Figuran cuatro gastos por $59,55. |
| Diferido | Audífonos a 3 meses, sin interés | Deuda pendiente $36,00 y tres recordatorios de cuota: 16 oct., 16 nov. y 16 dic. |
| Presupuesto y aviso | Comida $50 en octubre; pago de internet $18 el 20 oct. | Ambos figuran en sus respectivas tablas. |

El **balance del mes** de este día es −$9,55 ($50 de ingresos menos $59,55 de gastos), aunque hay $146,45 entre efectivo y débito. Esta diferencia ilustra por qué conviene separar «balance del período» y «dinero disponible» en la interfaz.

## Recorrido cotidiano

| Momento | Lo que haría como cliente | Lo que hay hoy | Fricción / idea |
| --- | --- | --- | --- |
| 07:30, salgo de casa | Consultar cuánto dinero puedo gastar hoy | El Resumen muestra balance **del mes**, ingresos y gastos; las cuentas están en Más | Añadir «Disponible hoy» desde cuentas no crediticias y pagos próximos. Diferenciarlo claramente del flujo del mes. |
| 08:00, pago transporte en efectivo | Anotar $0,35 en pocos segundos | Nuevo gasto pide monto, categoría, cuenta, método, fecha y ofrece más opciones; espera categorías y cuentas antes de mostrarlo | Captura rápida con monto, categoría reciente y cuenta habitual; detalles opcionales después. |
| 12:30, almuerzo con débito | Registrar $5,20 y guardar factura | El modelo de gasto admite factura, pero el formulario móvil no ofrece adjuntar archivo | Botón para foto o PDF del recibo, visible desde el detalle del movimiento. |
| 15:00, paso dinero de ahorros a efectivo | Reflejar la transferencia sin alterar ingresos/gastos | No aparece una acción de transferencia entre cuentas propias | Movimiento de transferencia atómico: resta de origen, suma a destino y no afecta el balance de ingresos/gastos. |
| 18:00, corrijo una compra | Cambiar $5,20 por $5,70 o la categoría | El detalle del gasto e ingreso solo ofrece eliminar; la lógica compartida sí tiene funciones de edición | Editar desde el detalle y conservar historial; en diferidos respetar las restricciones existentes. |
| 20:00, reviso el día | Encontrar un pago, ver límite y próxima cuota | Gastos se divide por semanas; inicia en semana 1. Presupuestos y recordatorios están en Más | Abrir la semana actual, buscar por texto/monto y mostrar un bloque breve de límites y próximos pagos en Resumen. |

## Hallazgos verificables

### P0: corregir antes de ampliar

1. **Fecha equivocada al crear desde un mes anterior.** Gastos pasa `mes` al abrir «+ Nuevo», pero el formulario solo lee `cuentaId` y fija la fecha en hoy. Si reviso septiembre y agrego un gasto olvidado, se guarda inicialmente en octubre. Criterio: usar el mes seleccionado para proponer una fecha de ese mes, indicar la fecha claramente y permitir cambiarla. Evidencia: [Gastos](../apps/mobile/app/(tabs)/gastos.tsx), [Nuevo gasto](../apps/mobile/app/gasto/nuevo.tsx).
2. **No puedo editar un gasto o ingreso en el teléfono.** El detalle ofrece eliminar; el núcleo ya implementa `actualizarGasto` y `actualizarIngreso`. Criterio: editar monto, descripción, categoría, cuenta y fecha, con ajuste correcto de saldos y un mensaje claro si un diferido no admite el cambio. Evidencia: [detalle de gastos](../apps/mobile/app/(tabs)/gastos.tsx), [detalle de ingresos](../apps/mobile/app/(tabs)/ingresos.tsx), [repositorio de gastos](../packages/core/src/repositories/gastos.repo.ts).
3. **El registro de un correo existente resulta confuso.** Supabase puede devolver un usuario ficticio sin error para no revelar si la dirección existe. La prueba con el correo original devolvió `signUp` sin error y `signInWithPassword` con `invalid_credentials`. Criterio: no asegurar que la cuenta se creó ni que llegó un mensaje; guiar a iniciar sesión. El mensaje ya se corrigió en [Registro](../apps/mobile/app/(auth)/registro.tsx). Falta una pantalla de recuperación de contraseña, cuya lógica ya existe en `core`.

### P1: uso diario y confianza

4. **Transferencia entre cuentas propias.** Debe ajustar ambos saldos en una operación indivisible y aparecer en ambos historiales sin contarse como ingreso ni gasto.
5. **Captura rápida.** Ofrecer una ruta de dos pasos para gastos frecuentes: monto y categoría; recordar cuenta/método usados recientemente, sin imponerlos para una tarjeta o diferido.
6. **Búsqueda y filtros de movimientos.** Buscar por descripción, lugar, monto, categoría o cuenta; elegir un rango de fechas. Gastos e ingresos cargan todo el historial y filtran el mes en memoria.
7. **Semana correcta al abrir Gastos.** El estado comienza en semana 1 aunque hoy esté en otra; elegir la semana que contiene la fecha actual y restablecerla al cambiar de mes.
8. **Saldo disponible distinto del balance mensual.** «Balance del mes» es ingresos menos gastos, no el dinero que queda en cuentas. Mostrar ambos con nombres distintos y explicar por qué pueden diferir.
9. **Recordatorios que lleguen al teléfono.** Los recordatorios automáticos de diferidos ya se ven dentro de la app; aún no se programan notificaciones del dispositivo. Ofrecer un aviso configurable antes del vencimiento.

### P2: completar y escalar

10. **Factura en el móvil.** El campo `facturaPath` existe en el modelo, pero no hay captura/adjunto en el formulario móvil.
11. **Acceso sin conexión.** Permitir anotar un gasto sin red, indicar que está pendiente y sincronizarlo una sola vez al reconectar. Requiere diseñar conflictos y evitar duplicados.
12. **Carga por período y tolerancia a fallos.** Resumen ya pide solo el mes actual y tres anteriores para sus cálculos; sigue esperando gastos, ingresos, categorías, cuentas y deudas y muestra error de toda la pantalla si falla alguna. Gastos e ingresos tienen su propia carga y filtros. Como siguiente mejora, cachear datos estables y mostrar las secciones disponibles si falla una fuente.

## Tiempos de respuesta observados

| Operación | Resultado | Tiempo | Alcance de la medición |
| --- | --- | ---: | --- |
| Primer GET local a `/` | HTTP 200 | 5,14 s | Primer arranque de Metro; incluye preparación del entorno de desarrollo. No representa producción. |
| Cinco GET posteriores a `/` | HTTP 200 | 32–62 ms | Solo entrega del HTML local; no incluye renderizado ni consultas de datos. |
| Registro con correo ya existente | Respuesta sin error ni sesión | 1,15 s | Llamada Auth medida desde este equipo; no confirma creación de usuario. |
| Inicio de sesión con contraseña nueva del correo existente | `invalid_credentials` | 358 ms | Confirma que esa contraseña no abrió la cuenta existente. |
| Registro de la cuenta de ensayo nueva | Identidad nueva, sesión pendiente de confirmación | 758 ms | Llamada Auth; no incluye entrega ni apertura del correo. |
| Inicio de sesión de la cuenta de ensayo, tras confirmarla | Sesión válida | 776 ms | Llamada Auth desde este equipo. |
| Crear cuentas de ensayo | Tres altas correctas | 529, 187 y 159 ms | Escrituras individuales, en orden. |
| Crear ingreso y cuatro gastos | Cinco altas correctas | 236 ms; 345, 150, 120 y 140 ms | Escrituras individuales, con la red y la base de esta prueba. |
| Crear presupuesto y recordatorio | Dos altas correctas | 151 y 174 ms | Escrituras individuales. |
| Consultas equivalentes al bloque principal de Resumen | Cinco tablas en paralelo, sin error | 222, 386 y 314 ms | Tres repeticiones con pocos datos; excluye renderizado, ubicación, fuentes y recursos web. |

**Sin medir todavía:** tiempo visible hasta Resumen, apertura de Gastos, guardado y aparición del movimiento, cambio de mes, carga de presupuestos y respuesta con red móvil. La versión web local se abrió para la revisión visual posterior, pero no se instrumentó una medición de tiempo de pantalla. No se deben presentar los tiempos HTTP o API anteriores como tiempos de pantalla.

### Cambios posteriores de rendimiento y perfil

- **Resumen:** ahora consulta gastos e ingresos desde el primer día de los tres meses anteriores. Esto conserva las comparaciones de recomendaciones, la semana y el balance actual. Si ese período ya contiene ocho movimientos, reutiliza esas filas para la actividad; si contiene menos, pide hasta ocho gastos y ocho ingresos recientes sin filtro de fecha, para que los movimientos antiguos sigan visibles. También evita recalcular recomendaciones, semana y lugares en cada render sin cambios de datos.
- **Más:** el indicador de la bandeja pide el conteo de avisos pendientes a la base, sin descargar todas sus filas. La bandeja sigue consultando sus detalles cuando se abre.
- **Perfil:** en `Más → Mi perfil` se puede editar nombre y teléfono opcional y solicitar el cambio de correo de acceso. Los datos se guardan en los metadatos de Supabase Auth, conservando los metadatos existentes. [Supabase permite actualizar correo y metadatos](https://supabase.com/docs/reference/javascript/auth-updateuser); el enlace de regreso `confirmacion` debe estar [permitido en las URL de redirección](https://supabase.com/docs/guides/auth/redirect-urls).
- **Verificación:** 170 pruebas de `core`, 14 de `mobile` y compilación TypeScript móvil correctas. Estas pruebas comprueban que la consulta de actividad pide como máximo ocho filas por tipo sin excluir fechas antiguas y que el indicador de Más usa un conteo sin filas. No miden latencia de red ni tiempo hasta que la pantalla sea visible.
- **Tiempo de respuesta tras el cambio:** aún sin medición en dispositivo o web publicada. En una cuenta con al menos ocho movimientos durante cuatro meses, Resumen mantiene sus cinco consultas principales en paralelo y transfiere menos filas conforme crece el historial. Con menos de ocho movimientos recientes hace dos consultas adicionales; podría tardar más en una cuenta pequeña. La mejora real de p50 y p95 requiere medición en el dispositivo objetivo.

### Revisión visual en la versión web móvil

Se inició sesión con la cuenta de ensayo y se revisaron Login, Resumen, Ingresos, Gastos, Tarjetas, Más y Mi perfil con un viewport de teléfono. Las tarjetas, textos, botones y navegación se mostraron sin desbordamiento horizontal; Mi perfil también se comprobó en modo oscuro. Los mensajes de validación de correo y teléfono aparecieron junto a sus respectivos campos y no guardaron datos inválidos.

En Gastos apareció una fricción visible: la pantalla abría en la semana actual, pero el selector horizontal mostraba las semanas 1 y 2 y dejaba la seleccionada fuera del viewport. Se ajustó `SelectorChips` para desplazar automáticamente la opción activa; se verificó al abrir la pantalla y al cambiar de semana. Esta revisión visual corresponde a React Native Web; falta comprobar el teclado, el área segura y el desplazamiento en Android/iOS reales.

### Objetivos propuestos para el piloto

Estos son **objetivos de producto**, no mediciones actuales: primera pantalla útil en menos de 2 s en una conexión móvil normal; abrir una pestaña con datos recientes en menos de 1 s; guardar un gasto y verlo en lista en menos de 2 s; toda acción con indicador inmediato y error recuperable. Registrar p50, p95, tasa de error y número de solicitudes por pantalla en dispositivo real y en la web publicada.

## Orden recomendado

1. Corregir fecha de «+ Nuevo», semana inicial y mensaje de registro existente.
2. Añadir edición de gastos/ingresos y recuperación de contraseña.
3. Implementar transferencia entre cuentas y distinguir saldo real de balance mensual.
4. Reducir pasos de captura y añadir búsqueda.
5. Añadir notificaciones, adjuntos de factura y mejoras de carga.

## Límites de esta revisión

La cuenta original (tu correo personal) ya existía; el intento de registro no le cambió la contraseña. La cuenta de ensayo se creó con una dirección `+fintrack`, fue confirmada y solo contiene movimientos ficticios. Las cifras medidas son de Auth, consultas/escrituras Supabase y servidor local; la revisión visual posterior fue en React Native Web, no en un teléfono físico.
