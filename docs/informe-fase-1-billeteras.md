# Informe · Fase 1: base de datos y reglas de billeteras y ubicación

16 de octubre de 2026 · carpeta `App_registros_gastos` · rama `Rama-Logica` · plan: `docs/plan-billeteras-y-ubicacion.docx`

**Resultado: terminada y probada.** Lo nuevo todavía no se ve en pantalla: la Fase 2 lo usa. No se subió nada a GitHub.

## Qué se hizo

**Migración de billeteras y ubicación** (`20261016120000_billeteras_y_ubicacion.sql`):

- **Pagado con**: cada gasto puede decir si se pagó con Apple Pay, Google Wallet u otra billetera. El método sigue siendo débito o crédito, así que los saldos, los cupos y los diferidos no cambian.
- **Ubicación** del gasto (latitud, longitud y precisión del GPS), redondeada por la base a unos 11 m.
- **Lugares**: tabla nueva. Al guardar un gasto con ubicación, la base lo asigna al lugar propio más cercano dentro de 80 m, o crea uno con el nombre del gasto. Si el GPS tiene un margen de más de 200 m, no asigna lugar. Si cambias la ubicación, el lugar se recalcula; si la quitas, se quita el lugar.
- **Bandeja**: cada aviso dice de dónde vino (correo, Apple Pay o Google Wallet) y puede traer el comercio, la ubicación y los últimos dígitos de la tarjeta.
- **Confirmar un aviso de billetera** crea el gasto con la billetera, el método según la tarjeta (crédito o débito) y la ubicación. Los avisos del correo se confirman igual que antes.
- **Minimización**: al confirmar o descartar un aviso, la base le borra el asunto, el comercio, la ubicación y la tarjeta. Antes solo borraba el asunto, y cada llamada lo hacía por su cuenta.

**Lógica compartida (core)**: tipos `Billetera`, `Ubicacion`, `Lugar` y `OrigenTransaccion`; validación con zod; `crearGasto` y `actualizarGasto` guardan los campos nuevos; la bandeja los lee y los guarda; `listarLugares()`; etiquetas en español; "borrar todos mis datos" también borra los lugares. Detalle para los agentes de pantallas en `docs/contrato-logica-core.md` (sección "Billeteras y ubicación — Fase 1").

**Compatibilidad**: si un gasto no lleva billetera ni ubicación, core no envía las columnas nuevas. Así, la app funciona igual en tu Supabase web mientras no apliques la migración.

**Cambio respecto al plan**: no hizo falta una versión nueva de la función que confirma avisos. Se reemplazó la existente con los mismos parámetros, así que la app ya instalada la sigue usando sin cambios.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (Postgres desechable con las 24 migraciones desde cero) | **130 de 130** (26 nuevas, `supabase/tests/billeteras_ubicacion.sql`) |
| Pruebas de lógica (`pnpm --filter core test`) | **105 de 105** (12 nuevas, `packages/core/test/billeteras.test.ts`) |
| Pruebas de la web y del teléfono | 3 de 3 y 7 de 7 |
| TypeScript en core, web y teléfono | Sin errores |
| Paquete Android (`expo export -p android`) | Compila (3,6 MB) |

Las 26 pruebas nuevas de la base cubren: el lugar se crea, se reutiliza a 30 m y es otro a 1 km; GPS impreciso; redondeo; coordenadas imposibles; billetera con efectivo rechazada; lugar de otra persona rechazado; A no ve ni cambia los lugares de B; mover y quitar la ubicación; lugar elegido a mano; confirmar Apple Pay (billetera, crédito, ubicación, lugar y cupo descontado) y confirmar un aviso del correo (sin cambios); descartar borra los datos; avisos imposibles rechazados; borrar un lugar conserva sus gastos; sin sesión no se leen lugares; eliminar la cuenta borra los lugares.

Las pruebas anteriores de la bandeja del correo, los saldos y los diferidos siguen pasando con la migración nueva.

## Error encontrado y corregido

- **Latitud sin longitud**: la asignación de lugar corre antes que las validaciones del gasto, así que intentaba crear un lugar sin longitud y fallaba con un error confuso. Ahora deja pasar esas ubicaciones y la validación del gasto las rechaza con su mensaje normal. Lo encontró la prueba U06.

## Lo que falta o no está comprobado

- **Aplicar la migración en tu Supabase web.** En el SQL Editor, pega entero `supabase/para-supabase-web/16-10-2026 4AM/1 - gastos, lugares, transacciones_detectadas.sql` y dale Run. Al final tiene que mostrar `aplicada = sí`. Corre en una sola transacción: si algo falla, no cambia nada. `supabase/base-completa.sql` también quedó regenerado (24 migraciones) para proyectos nuevos.
- No se probó contra tu Supabase web, porque todavía no tiene la migración.
- Nada se ve en pantalla hasta la Fase 2: el formulario con "Pagado con", el permiso de ubicación y el detalle del lugar.

## Seguridad

- **RLS** en `lugares`: cuatro políticas, una para cada operación, y cada usuario solo toca los suyos. Se quitó todo permiso a `anon` (prueba U24).
- **Referencias propias**: un gasto no puede apuntar al lugar de otra persona (prueba U11). La validación es la misma que ya protege cuentas y categorías.
- **La asignación de lugar** corre con los permisos de quien guarda el gasto (`security invoker`), así que RLS impide crear o usar lugares ajenos aunque la fila diga otro dueño.
- **Sin SQL dinámico**: las búsquedas usan consultas fijas con parámetros, y nada que escriba el usuario se pega dentro del SQL.
- **Límites en la base (CHECK)**: rangos de coordenadas, latitud y longitud siempre juntas, precisión de 0 a 50 km, billeteras conocidas, comercio de hasta 200 caracteres, últimos dígitos de 3 o 4 números y nombre del lugar de hasta 80 caracteres. En core se validan los mismos límites antes de ir a la red.
- **Datos de terceros**: una ubicación o una tarjeta imposibles que lleguen en un aviso se descartan y el aviso se guarda sin ellas. Un aviso de billetera nunca puede ser un ingreso.
- **Privacidad**: la ubicación se guarda redondeada a unos 11 m. Los avisos resueltos olvidan comercio, ubicación y tarjeta. Eliminar la cuenta borra los lugares (prueba U25).
- **Tiempos de espera**: no cambian. Las llamadas de core siguen pasando por el cliente con tiempo máximo, y la búsqueda del lugar se acota por latitud antes de calcular distancias.

## Siguiente: Fase 2

Registrar a mano con "Pagado con" y ubicación: los ayudantes de ubicación para el teléfono (`expo-location`, solo mientras usas la app) y la web, la preferencia apagada por defecto, "Borrar todas mis ubicaciones" y las pantallas de los agentes 2 y 3. Hace falta una APK nueva por `expo-location`.
