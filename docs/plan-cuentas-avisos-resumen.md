# Plan por fases: casas comerciales, fecha de corte, avisos y un resumen más informativo

16 de octubre de 2026 · pedido del usuario. Cada fase se hace y se comprueba antes de la siguiente, con su informe en Markdown. Las actualizaciones de la base van en `supabase/para-supabase-web/<fecha hora>/`, con archivos nombrados por tabla.

## Qué hay hoy

- **Cuentas:** de tipo débito, crédito, efectivo o ahorro, de 6 bancos con logo (Guayaquil, Pichincha, Produbanco, Diners, Pacífico, Austro) más «Otro». No existen casas comerciales ni créditos directos.
- **Tarjetas:** tienen cupo, pero no fecha de corte.
- **Diferidos:** un diferido crea su deuda sola, pero **no** crea recordatorios.
- **Recordatorios:** pueden repetirse cada mes y estar ligados a una deuda, pero nadie los crea automáticamente.
- **Presupuestos:** avisan al 80 % solo dentro de las recomendaciones. No hay notificaciones del teléfono.
- **Endeudamiento:** se calcula contra los ingresos **del mes en curso**. El día 1 da 0 % aunque cobres $500 todos los meses.
- **Resumen:** hay balance, endeudamiento y recomendaciones, pero ningún gráfico de en qué se fue el dinero.

## Fases

| Fase | Qué te deja | Tamaño |
|---|---|---|
| **A · Casas comerciales y créditos directos** | Agregar cuentas como Comandato, Artefacta, Marcimex, La Ganga, Japón, De Prati o Créditos Económicos, como **crédito directo**, con su cupo. Comprar a cuotas en ellas igual que un diferido. Cada cuenta muestra su logo, o un ícono con su inicial y color si no hay logo. | Mediana |
| **B · Fecha de corte** | Al agregar o editar una tarjeta: el día de corte y el día máximo de pago. La tarjeta muestra "corta en N días", y un gasto hecho después del corte se marca para el mes siguiente. | Pequeña |
| **C · Recordatorios automáticos de diferidos** | Al diferir (por ejemplo, $130 a 3 meses el día 10), se crea un recordatorio mensual el día 10 durante 3 meses, con el monto de cada cuota. Al pagar la última cuota, o al vencer el plazo, el recordatorio se cierra solo. Si borras el diferido, se borra. | Mediana |
| **D · Avisos de presupuesto** | Un mensaje cuando llegas al **75 %**, al **100 %** y cuando **te pasas** de un presupuesto. Una sola vez por nivel y por mes, en la app y como notificación del teléfono. | Mediana |
| **E · Endeudamiento según tu ingreso habitual** | Se calcula contra tu ingreso mensual **regular**: el promedio de los últimos 3 meses con ingresos, o el que tú fijes a mano. Si cobras $500 al mes, todo se mide sobre $500 desde el día 1. | Pequeña |
| **F · Resumen más informativo** | Un gráfico de dona con los gastos del mes por categoría, barras de los últimos 6 meses (ingresos frente a gastos) y cifras rápidas: gastado, disponible, la categoría principal y la comparación con el mes pasado. | Mediana |

Las fases A y B tocan las cuentas, así que conviene hacerlas juntas. C depende de B solo si las cuotas siguen la fecha de pago de la tarjeta. D, E y F son independientes entre sí.

## Decisiones que necesito de ti

1. **Casas comerciales:** ¿se manejan como una **tarjeta** (con cupo; compras a cuotas como diferido; recomendado) o como un **préstamo** de cuotas fijas?
2. **Logos de las casas comerciales:** no puedo descargar logos de sus sitios sin permiso. ¿Me pasas las imágenes, o empezamos con un ícono de inicial y color (recomendado), y los logos se agregan cuando los tengas?
3. **Avisos de presupuesto:** ¿mensaje **dentro de la app** y también **notificación del teléfono** (recomendado)? La notificación necesita `expo-notifications`, que es nativo, así que conviene meterla en la misma APK 1.1.0 que ya va a salir por la ubicación.
4. **Cuotas del diferido:** ¿el recordatorio va el **mismo día de la compra** cada mes (tu ejemplo: el 10) o en la **fecha máxima de pago** de la tarjeta (fase B)?

## Seguridad y privacidad (para todas las fases)

- Todo lo que sea automático (recordatorios de diferidos, cierre al vencer) lo hace la base, en el mismo paso que crea o borra el diferido. Así nunca quedan recordatorios huérfanos ni duplicados.
- Las notificaciones son locales: las programa el teléfono, sin un servidor que conozca tus montos. No muestran montos en la pantalla bloqueada si no quieres.
- Hay reglas de acceso (RLS) y límites en la base para cada campo nuevo (día de corte de 1 a 31, cupo de 0 o más). No hay SQL dinámico.
