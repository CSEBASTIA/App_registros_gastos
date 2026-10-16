# Informe · Pantallas de billeteras, ubicación y lugares (fases 2, 3 y 5)

16 de octubre de 2026 · app del teléfono (`apps/mobile`, que también es la versión web) · no se subió nada a GitHub

No había otro agente activo, así que las pantallas las hice yo, con los componentes y el estilo actuales.

## Qué se hizo

| Pantalla | Cambio |
|---|---|
| Nuevo gasto | Selector **«Pagado con»** (Tarjeta, Apple Pay, Google Wallet u otra). Se oculta con efectivo o transferencia y se limpia si cambias a uno de esos. Al guardar, toma la ubicación si la activaste; si no se pudo, avisa después de guardar, sin bloquear. |
| Gastos | Cada gasto muestra la billetera y el lugar, y un botón 📍 para abrirlo en Mapas si tiene ubicación. |
| **Ubicación de mis pagos** (nueva) | Interruptor apagado por defecto; el permiso se pide al encenderlo. Botón «Borrar todas mis ubicaciones», con confirmación. |
| **Conectar Apple Pay** (nueva) | Los pasos, la URL y la clave pública con botón para copiar. Crear una clave: se muestra una sola vez y se olvida al salir de la pantalla. Lista de claves con su último uso, y botón para revocar. Tope de 5. |
| Bandeja | Ícono y etiqueta del origen (Correo o Apple Pay), el comercio, el banco, los últimos dígitos y «Abrir en Mapas». |
| **Lugares** (nueva) | Lista por mes con el total, los pagos, el promedio y una barra de porcentaje. Interruptor «Por comercio». |
| **Detalle del lugar** (nuevo) | El total, los pagos y el promedio del mes, la lista de pagos, «Abrir en Mapas», renombrar, fusionar con otro lugar y borrar. |
| Resumen | Tarjeta **«Dónde más pagas»** (los 3 lugares con más gasto del mes). Las recomendaciones reciben los lugares. |
| Más | Entradas para Lugares, Ubicación de mis pagos y Conectar Apple Pay. |

**Piezas de apoyo:**

- `lib/dialogo.ts`: confirmaciones y avisos que funcionan también en la versión web, donde `Alert.alert` no muestra nada.
- `rangoDelMes` en core: el primer y el último día del mes.
- `mensajeError` traduce «falta la función o la tabla» (PGRST202, PGRST205, 42703) como "falta actualizar la base de datos".

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| TypeScript en core, web y teléfono | Sin errores |
| Pruebas de lógica | 126 de 126 |
| Pruebas del teléfono y de la web | 7 de 7 y 3 de 3 |
| Paquete Android | Compila (3,74 MB) e incluye el módulo de ubicación |
| Navegador (modo de desarrollo sin login, contra tu Supabase web) | Las 9 pantallas cargan. «Pagado con» se oculta con Efectivo y vuelve con Débito. Sin la migración, Lugares muestra el aviso en español y no el estado vacío. |

## Errores encontrados y corregidos

- Sin la migración, Lugares mostraba el error de Supabase en inglés («Could not find the function…») y, debajo, "no hay pagos". Ahora muestra "falta actualizar la base de datos" y nada más.

## Lo que no está comprobado

- **Guardar de verdad:** no inicié sesión con tu cuenta, así que no guardé gastos con billetera o ubicación ni creé claves. Además, tu Supabase web todavía no tiene las migraciones: hasta que las apliques, guardar un gasto **con** billetera falla. Sin billetera, todo funciona como antes.
- **En un teléfono real:** el permiso de ubicación, el GPS y «Abrir en Mapas» necesitan la APK 1.1.0.
- La web de escritorio (`apps/desktop`) no se tocó.

## Actualizaciones de la base para pegar en el SQL Editor

Carpeta `supabase/para-supabase-web/16-10-2026 4AM/`. Pégalas en orden; cada una debe terminar con `aplicada = sí`:

1. `1 - gastos, lugares, transacciones_detectadas.sql`: billeteras y ubicación.
2. `2 - gastos, lugares, transacciones_detectadas (borrar ubicaciones).sql`
3. `3 - claves_captura, transacciones_detectadas.sql`: captura con Apple Pay.
4. `4 - gastos, lugares (resumen por lugar).sql`
