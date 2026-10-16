# Informe · Editar gastos e ingresos, y fecha de «+ Nuevo»

16 de octubre de 2026 · responde a los puntos P0-1 y P0-2 de `reports/experiencia-cliente-dia-cotidiano-2026-10-16.md` · sin commit

**Resultado: hecho y probado** en el teléfono y en su versión web. La regla nueva de los diferidos necesita aplicar una actualización de la base (ver abajo).

## Qué cambió

### «+ Nuevo» usa el período que estabas viendo

- **Antes:** si revisabas septiembre y agregabas un gasto olvidado, se guardaba con la fecha de hoy, en octubre.
- **Ahora:** «+ Nuevo» propone una fecha del mes (y, en Gastos, de la semana) que estabas viendo:
  - hoy, si cae en ese período;
  - si el período ya pasó, su último día (semana 2 de septiembre → 14 de septiembre);
  - si todavía no llega, su primer día.
- Cuando la fecha no es la de hoy, el formulario lo avisa arriba: «Se guardará con fecha lunes, 14 de septiembre de 2026, del período que estabas viendo. Puedes cambiarla abajo».
- Vale para gastos y para ingresos.

### Editar desde la isla

- En la isla de un gasto o de un ingreso hay un botón **«Editar»**. Abre una pantalla con monto, descripción, categoría (o fuente), cuenta y fecha.
- Al guardar se envía **solo lo que cambiaste**. Los saldos de las cuentas se ajustan solos: si pasas un almuerzo de $5,20 en débito a $5,70 en efectivo, el débito recupera $5,20 y al efectivo se le restan $5,70.
- Si el cambio pasa del cupo de la tarjeta, la base lo rechaza con un mensaje claro.
- Los ingresos no se pueden poner en una tarjeta de crédito, igual que al crearlos.

### Reglas de los diferidos

- **En un diferido solo se pueden cambiar la descripción y la categoría.** El monto, la tarjeta y la fecha se muestran, pero no se pueden editar. Un aviso explica que, para cambiarlos, hay que eliminarlo y registrarlo de nuevo.
- **Cambio de regla — la fecha:** antes, la base dejaba cambiar la fecha de un diferido. Ahora no, porque su deuda empieza ese día y los recordatorios automáticos de cada cuota caen ese día de cada mes. Moverla dejaba la deuda y los recordatorios con otra fecha. Por eso actualicé la prueba anterior que la permitía (D2 en `saldos_confiables.sql`).

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (todas las migraciones desde cero) | **273 de 273** (7 nuevas, `supabase/tests/editar_movimientos.sql`; D2 actualizada) |
| Pruebas de lógica | **175 de 175** (4 nuevas, `packages/core/test/edicionMovimiento.test.ts`) |
| Pruebas del teléfono | 14 de 14 |
| TypeScript en core, teléfono y web | Sin errores |
| Navegador (sin login, con datos simulados) | Almuerzo de $5,20 en débito → isla → Editar → $5,70 en efectivo → Guardar. Se envió solo `{monto: 5.7, cuenta_id: …}` y la lista mostró «Comida · Efectivo DEMO · $5.70». En el diferido «Audífonos» se vio el aviso, con el monto, la tarjeta y la fecha bloqueados. Desde septiembre, semana 2, «+ Nuevo» propuso el 2026-09-14 con su aviso. |

**Las pruebas de base cubren:**

- Editar el monto, la cuenta y la fecha devuelve el saldo a la cuenta vieja y lo cobra en la nueva, en gastos y en ingresos.
- Un diferido sí cambia la descripción y la categoría, y no cambia la fecha ni el monto; sus 3 recordatorios siguen en su fecha.
- Por encima del cupo, la base rechaza el cambio.
- Otro usuario no puede editar tus gastos.

**Las pruebas de lógica cubren:** la fecha propuesta en cada caso (semana actual, pasada, futura, febrero, mes inválido), que solo se envíe lo que cambió (5,2 contra 5,2000001 no cuenta como cambio), los campos bloqueados del diferido, y que quitar la cuenta o la fuente de un ingreso se envíe como vacío.

## Lo que hay que saber

- **Solo esos cinco campos:** la pantalla de edición no cambia el método de pago, la billetera ni la ubicación. Se pueden agregar después si hacen falta.
- **Historial de cambios:** el informe de experiencia sugería «conservar historial» de las ediciones. No se guarda: la edición reemplaza el valor anterior, como hasta ahora.
- **La web de escritorio** (`apps/desktop`) no tiene estas pantallas.

## Actualización de la base para pegar en el SQL Editor

Carpeta `supabase/para-supabase-web/16-10-2026 5PM/`, archivo `1 - gastos (fecha fija en diferidos).sql` (Migración de fecha fija en diferidos). Va **después** del de `16-10-2026 4PM/`, y debe terminar con `aplicada = sí`.

Sin esta actualización, la app no deja cambiar la fecha de un diferido, pero la base todavía lo permitiría si alguien lo intentara por fuera de la app.

## Seguridad

- **Edición:** usa las reglas de acceso de siempre: cada usuario edita solo lo suyo (probado con otro usuario: 0 filas). Core valida con zod antes de ir a la red.
- **Diferidos:** la regla vive en la base, no solo en la app.
- **Sin SQL dinámico.**
