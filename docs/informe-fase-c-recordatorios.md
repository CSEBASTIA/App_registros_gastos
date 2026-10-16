# Informe · Fase C: recordatorios automáticos de los diferidos

16 de octubre de 2026 · plan: `docs/plan-cuentas-avisos-resumen.md` · no se subió nada a GitHub

**Resultado: terminada y probada**, con la pantalla del teléfono y de su versión web. Antes de usarla falta aplicar la actualización de la base en tu Supabase web (ver abajo).

## Qué hace

Al comprar a cuotas, la app crea sola un recordatorio por cada cuota, como pediste:

| Tu ejemplo: $130 a 3 meses, comprado el 10 de octubre | Fecha | Monto |
|---|---|---|
| Cuota 1 de 3 · Televisor | 10/10/2026 | $43,34 |
| Cuota 2 de 3 · Televisor | 10/11/2026 | $43,34 |
| Cuota 3 de 3 · Televisor | 10/12/2026 | $43,32 |

- **El mismo día de la compra cada mes**, como elegiste. Una compra del 31 cae el 28 de febrero o el 30 de los meses cortos. Las fechas son las mismas que usa la deuda para el «próximo pago».
- **Con el monto de cada cuota.** Sin interés, la última lleva el redondeo. Con interés, cada recordatorio lleva la cuota fija (capital + interés).
- **Se cierran solos:**
  - Al registrar el abono de una cuota en Deudas, su recordatorio queda hecho. Al saldar la deuda, se cierran todos.
  - Si no registras el pago, cada cuota sigue a la vista hasta la fecha de la siguiente. **Al terminar el plazo del diferido no queda nada pendiente.**
- **Se borran con el diferido.** Los recordatorios que tú creaste y apuntaban a esa deuda se quedan, sin la deuda. Antes, esa referencia impedía borrarla.
- **Los diferidos que ya tenías** reciben sus recordatorios al aplicar la actualización, con las cuotas ya pagadas marcadas como hechas.

**Pantalla Recordatorios:**

- De cada diferido se ve **solo la cuota que toca**, con la etiqueta «Automático · diferido» y «quedan 11 cuotas más». Así un diferido a 12 meses no llena la lista.
- Cada fila dice cuándo vence: «hoy», «en 25 días» o, en rojo, «venció hace 11 días».
- Enlace «Registrar el pago en Deudas →» para que baje el saldo.
- Los hechos y las cuotas pasadas quedan en «Ver anteriores».
- Eliminar ahora pide confirmación también en la versión web. Antes, ahí no hacía nada.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (todas las migraciones desde cero) | **240 de 240** (15 nuevas, `supabase/tests/recordatorios_diferidos.sql`), con las migraciones de la otra sesión incluidas |
| Pruebas de lógica | **139 de 139** (6 nuevas, `packages/core/test/recordatorios.test.ts`) |
| Pruebas del teléfono y de la web | 13 de 13 y 3 de 3 |
| TypeScript en core, web y teléfono | Sin errores |
| Navegador (modo de desarrollo sin login, con datos simulados, también a 375 px) | Se ven la Laptop «Cuota 1 de 12 · venció hace 11 días · $108.88 · quedan 11 cuotas más», el arriendo manual y el Televisor «Cuota 2 de 3 · en 25 días · queda 1 cuota más». En «Ver anteriores» están la cuota 1 hecha y una cuota vieja «pasó sin registrar el pago». |

**Las pruebas de base cubren:**

- El ejemplo de $130 y una compra del 31.
- Con interés, 12 recordatorios con la cuota fija.
- Abonos: pagar la primera cuota cierra solo esa; un abono parcial no cierra la siguiente; saldar la deuda cierra todas.
- Marcar uno como hecho sí se puede; volverlo manual o crear un «automático» sin deuda, no.
- Borrar el diferido borra sus recordatorios y conserva los manuales; un diferido con abonos sigue sin poder borrarse, y conserva sus recordatorios.
- Un gasto normal o una deuda manual no crean nada.
- Tope de 60 recordatorios.
- La función de mantenimiento no se puede llamar desde la app.
- Otro usuario no ve ni cambia tus recordatorios.
- Los diferidos de antes reciben los suyos, sin duplicar al repetir.

## Errores encontrados y corregidos

- **El monto salía sin el signo $** en la pantalla. Fue otra vez el script de edición, ahora con `$` en una plantilla. Lo vi en el navegador y lo corregí.
- **Orden de los disparadores al borrar:** el mío iba antes del que protege los diferidos con abonos. No rompía nada, porque la base deshace todo si el borrado se rechaza, pero lo renombré para que corra después.

## Lo que falta o no está comprobado

- **Avisos en el teléfono** (notificación aunque la app esté cerrada): llegan con la fase D, que instala las notificaciones. Por ahora los recordatorios se ven dentro de la app.
- **Guardar de verdad en tu cuenta:** no lo probé, porque no inicié sesión con tus datos. Sin la actualización, la pantalla funciona igual que antes (solo que sin recordatorios automáticos).
- **La web de escritorio** (`apps/desktop`) muestra estos recordatorios como normales, sin agruparlos.

## Actualización de la base para pegar en el SQL Editor

Carpeta `supabase/para-supabase-web/16-10-2026 5AM/`, archivo `4 - recordatorios, deudas (recordatorios de diferidos).sql` (Migración de recordatorios de diferidos). Va **después** de los archivos 1 a 3 de esa carpeta, y debe terminar con `aplicada = sí`.

## Seguridad

- **Disparadores con los permisos de quien hace el cambio** (security invoker): un usuario solo crea, cierra o borra recordatorios suyos, por las reglas de acceso de siempre. Otro usuario no ve ni cambia nada (probado).
- **La función que completa los diferidos de antes** no se puede llamar desde la app; solo la corre la actualización.
- **Límites en la base:** un recordatorio automático siempre tiene deuda, no se puede volver manual, y como mucho se crean 60 por diferido, aunque alguien envíe un plazo enorme por la API.
- **Sin SQL dinámico.**

## Siguiente

**Captura de Google Wallet** (fase 4 de billeteras), que pediste. Después siguen las fases D (avisos del presupuesto), E (nivel de endeudamiento) y F (resumen con gráfico).
