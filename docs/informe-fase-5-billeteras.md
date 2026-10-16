# Informe · Fase 5: resumen de pagos por lugar

16 de octubre de 2026 · carpeta `App_registros_gastos` · rama `Rama-Logica` · plan: `docs/plan-billeteras-y-ubicacion.docx`

**Resultado: la lógica está terminada y probada; faltan las pantallas.** Las pantallas son «Lugares», el detalle de cada lugar y la tarjeta «Dónde más pagas». Las hace el Agente 3, con instrucciones en `docs/contrato-logica-core.md`, sección "Fase 5". No se subió nada a GitHub.

## Qué se hizo

**Migración de resumen por lugar** (`20261016150000_resumen_por_lugar.sql`):

- **`resumen_por_lugar(desde, hasta)`**: para cada lugar, el número de pagos, el total, el promedio, su parte del total (%), el primer y el último pago, la categoría más frecuente y la billetera más usada, del que más suma al que menos.
- **`resumen_por_comercio(desde, hasta)`**: junta los lugares que se llaman igual, sin mirar mayúsculas ni espacios. Para juntar dos sucursales, les pones el mismo nombre y cada una conserva su ubicación.
- **`fusionar_lugares(origen, destino)`**: pasa los pagos de un lugar a otro y borra el primero, en un solo paso.
- **Renombrar y borrar** no necesitaron función: son cambios normales, limitados a tus lugares por las reglas de acceso.

**Core:**

- `resumenPorLugar`, `resumenPorComercio`, `validarRangoResumen`, `listarGastosDeLugar`, `renombrarLugar`, `eliminarLugar` y `fusionarLugares`.
- **Recomendación nueva**: «Este mes llevas $85.00 en "Supermaxi", un 70% más que en todo el mes pasado». Sale solo si el lugar con más gasto del mes ya supera en 30 % o más a todo el mes pasado, y si son al menos $20. Sin datos del mes pasado, no inventa un aumento.

**Cambios respecto al plan:**

- **No se creó un índice nuevo.** Con 10 000 gastos, el resumen tardó 8 ms usando el índice que ya existía, `gastos (usuario_id, fecha)`. Un índice más solo haría más lento guardar gastos.
- **«Pagos de un lugar» no es una función de la base**: es la consulta normal de gastos con un filtro por lugar, y RLS ya la protege.
- **«Por comercio» junta los lugares por nombre exacto.** Adivinar cadenas (por ejemplo, por la primera palabra) habría juntado «Farmacia Cruz Azul» con «Farmacia Fybeca».

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (Postgres desechable, 27 migraciones desde cero) | **179 de 179** (13 nuevas, `supabase/tests/resumen_por_lugar.sql`) |
| Pruebas de lógica (`pnpm --filter core test`) | **124 de 124** (7 nuevas, `packages/core/test/resumenLugar.test.ts`) |
| Pruebas de la web y del teléfono | 3 de 3 y 7 de 7 |
| TypeScript en core, web y teléfono | Sin errores |
| Paquete Android (`expo export -p android`) | Compila (3,66 MB) |
| **Rendimiento**: 10 000 gastos en 50 lugares | Resumen por lugar en **8 ms** y por comercio en **22 ms**. La base usa el índice `gastos_usuario_fecha_idx` (lo muestra EXPLAIN) |

Las pruebas de la base usan datos conocidos: 3 lugares y 10 pagos, más un pago sin ubicación y otro fuera del rango. Cubren:

- **Totales:** el resumen de octubre da exactamente 60,00 / 40,00 / 15,00, con promedios, porcentajes (52,2 / 34,8 / 13,0), fechas, categoría y billetera. Otro mes da otros números.
- **Por comercio:** «Supermaxi El Bosque» y «  supermaxi   EL BOSQUE » se juntan.
- **Errores:** los rangos al revés, de más de 2 años o vacíos se rechazan.
- **Fusionar:** mueve 2 pagos, borra el lugar y el total sigue siendo 115. No se fusiona un lugar consigo mismo.
- **Renombrar y borrar:** renombrar funciona y un nombre vacío se rechaza. Borrar un lugar conserva sus 4 pagos.
- **Acceso:** otra persona ve el resumen vacío y no puede fusionar lugares ajenos. Sin sesión, o sin usuario identificado, no hay resumen.

## Error encontrado y corregido

- **El nombre del comercio podía salir con el nombre "raro".** Al juntar sucursales, el nombre se tomaba del lugar más antiguo. Los lugares creados en el mismo momento tienen la misma hora, así que el empate se decidía al azar y podía mostrar «  supermaxi   EL BOSQUE ». Ahora usa el nombre del lugar con más pagos. Lo detectó la revisión de la prueba X03, antes de que fallara de forma intermitente.

## Lo que falta o no está comprobado

- **Las pantallas** (Agente 3): «Lugares», el detalle con renombrar, fusionar y borrar, la tarjeta en Resumen y pasar `lugares` a las recomendaciones.
- **El mapa con pines** sigue fuera, como se decidió en el plan: la lista y «Abrir en Mapas» no necesitan clave de Google Maps.
- **Tu Supabase web todavía no tiene ninguna de las migraciones nuevas.** Pégalas en el SQL Editor en este orden; cada una debe terminar con `aplicada = sí`:
  1. `supabase/para-supabase-web/16-10-2026 4AM/1 - gastos, lugares, transacciones_detectadas.sql`
  2. `supabase/para-supabase-web/16-10-2026 4AM/2 - gastos, lugares, transacciones_detectadas (borrar ubicaciones).sql`
  3. `supabase/para-supabase-web/16-10-2026 4AM/3 - claves_captura, transacciones_detectadas.sql`
  4. `supabase/para-supabase-web/16-10-2026 4AM/4 - gastos, lugares (resumen por lugar).sql`

## Seguridad

- **Permisos de quien llama:** las tres funciones son `security invoker`, así que RLS filtra lo propio, y además filtran por `auth.uid()` explícitamente. Sin sesión no hay acceso: `anon` no puede ejecutarlas, y una sesión sin usuario recibe 42501.
- **Fusionar:** comprueba que los dos lugares sean tuyos y los bloquea siempre en el mismo orden, así dos fusiones a la vez no se traban. Es atómico: o se mueve todo, o nada.
- **Consultas limitadas:** como máximo 2 años por consulta, validado en core y en la base. Con 10 000 gastos responde en milisegundos, muy lejos del tiempo máximo de Supabase.
- **Sin SQL dinámico.** Los nombres de lugar se validan de 1 a 80 caracteres en core y en la base.

## Siguiente

**Fase 4** (Google Wallet en Android). Necesito capturas de 3 a 5 avisos de Google Wallet; puedes tapar los dígitos. Después viene la **Fase 6**: pruebas en teléfonos, APK 1.1.0 y la revisión final de privacidad.
