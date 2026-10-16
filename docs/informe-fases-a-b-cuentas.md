# Informe · Fases A y B: casas comerciales, logos y fecha de corte

16 de octubre de 2026 · plan: `docs/plan-cuentas-avisos-resumen.md` · no se subió nada a GitHub

**Resultado: terminadas y probadas**, incluidas las pantallas del teléfono y de su versión web. Antes de usarlas, falta aplicar la actualización de la base en tu Supabase web (ver abajo).

## Qué se hizo

**Fase A · Casas comerciales y créditos directos**

- **Entidades nuevas:** Comandato, Artefacta, Marcimex, La Ganga, Japón, De Prati, Créditos Económicos y «Otra casa comercial».
  - Se registran como **tarjeta de crédito**, con su cupo, como recomendaste.
  - Comprar a cuotas en ellas usa el diferido de siempre: crea la deuda, reserva el cupo y cobra el interés.
  - La base no deja crear una «cuenta de ahorros de Comandato».
- **Formulario «Agregar tarjeta»:**
  - Nueva opción «¿De dónde es el crédito? → Casa comercial o crédito directo».
  - Al elegir la casa, el nombre se completa solo («La Ganga crédito directo»), el campo se llama «Cupo aprobado» y no se piden marca ni catálogo.
  - Muestra una vista previa de la tarjeta.
- **Logo o iniciales:**
  - Si la entidad tiene logo, se muestra; si no, aparece un ícono con sus iniciales y su color («LG», «DP», «C»).
  - Las **cuentas de ahorro y débito** ahora también muestran el logo del banco sobre una pastilla blanca. Antes solo mostraban el nombre.
  - Las tarjetas de casas comerciales dicen «Crédito directo».

**Fase B · Fecha de corte y de pago**

- **Al agregar una tarjeta:** campos opcionales «Día de corte» y «Día de pago», de 1 a 31. En los meses más cortos se usa el último día: un corte el 31 en noviembre es el 30.
- **En cada tarjeta:** la línea «Corta en 4 días · paga hasta el 30/11».
- **En el detalle de la tarjeta:**
  - Una sección «Corte y pago» con la fecha del corte, la fecha máxima de pago y los días que faltan.
  - **Los consumos del ciclo actual**: lo que gastes después del corte se cobra en el siguiente estado de cuenta.
  - Un botón para agregar o cambiar las fechas en tarjetas que ya tenías.

**Migración de casas comerciales y fecha de corte** (`20261016160000_casas_comerciales_y_corte.sql`): agrega las entidades nuevas, la regla de que una casa comercial es siempre crédito, y las columnas `dia_corte` y `dia_pago`, solo para crédito y de 1 a 31.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (29 migraciones desde cero) | **188 de 188** (9 nuevas, `supabase/tests/casas_comerciales_y_corte.sql`) |
| Pruebas de lógica | **133 de 133** (7 nuevas, `packages/core/test/corteTarjeta.test.ts`) |
| Pruebas del teléfono y de la web | 7 de 7 y 3 de 3 |
| TypeScript en core, web y teléfono | Sin errores |
| Paquete Android | Compila (3,75 MB) |
| Navegador (modo de desarrollo sin login) | Aparecen las 8 casas comerciales. Al elegir La Ganga con cupo 1200, corte 15 y pago 30, la vista previa muestra «LG · La Ganga crédito directo · Crédito directo · Corta en 30 días · paga hasta el 30/11» (hoy es 16, así que el próximo corte es el 15 de noviembre). |

**Las pruebas cubren:**

- **Base de datos:** el crédito de Comandato se guarda con corte y pago, y se aceptan las 8 casas. Se rechazan una casa comercial como ahorro, una fecha de corte en una cuenta de ahorro, el día 32 y una entidad desconocida. Las fechas se pueden cambiar y quitar. Comprar a 12 cuotas en Comandato crea la deuda y reserva el cupo. Las cuentas de banco de antes siguen funcionando.
- **Lógica:** días 31 en meses cortos y febrero bisiesto; un gasto antes, el mismo día o después del corte; la fecha de pago; el ciclo actual y los días que faltan; las iniciales; las reglas del formulario; y el cambio de fechas.

## Error encontrado y corregido

- **Las iniciales de las casas salían mal** («L» en vez de «LG»): el script con el que edité el archivo se comió las barras invertidas de la expresión regular. Lo detectó la prueba de iniciales. Revisé el resto de lo que escribí con scripts y estaba bien.

## Lo que falta o no está comprobado

- **Logos reales de las casas comerciales:** por ahora van las iniciales. Cuando me pases las imágenes, se agregan en `apps/mobile/lib/logosBanco.ts`.
- **Guardar de verdad en tu cuenta:** no lo probé (no inicié sesión con tus datos). Hasta que apliques la actualización, crear una tarjeta **con** día de corte o de una casa comercial falla. Sin eso, todo funciona como antes.
- **La web de escritorio** (`apps/desktop`) no tiene todavía el formulario nuevo.

## Actualización de la base para pegar en el SQL Editor

Carpeta `supabase/para-supabase-web/16-10-2026 5AM/` → `1 - cuentas.sql` (Migración de casas comerciales y fecha de corte). Va **después** de los 4 archivos de `16-10-2026 4AM/`, y debe terminar con `aplicada = sí`.

## Seguridad

- **Límites en la base (CHECK):** solo entidades conocidas, una casa comercial siempre como crédito, y los días de 1 a 31 solo en crédito. Core valida lo mismo antes de ir a la red, con mensajes en español.
- **Cambiar fechas:** usa la regla de acceso que ya tenía la tabla, así que cada usuario solo cambia sus tarjetas. Solo se envían los campos indicados.
- **Compatibilidad:** sin fechas no se envían las columnas nuevas, así que las cuentas de siempre siguen funcionando en una base sin la actualización.
- **Sin SQL dinámico.**

## Siguiente

**Fase C**: recordatorios automáticos de los diferidos, en el mismo día de la compra durante los meses del diferido, que se cierran solos al terminar.
