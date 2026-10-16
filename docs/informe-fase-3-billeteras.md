# Informe · Fase 3: captura automática de Apple Pay (iPhone)

16 de octubre de 2026 · carpeta `App_registros_gastos` · rama `Rama-Logica` · plan: `docs/plan-billeteras-y-ubicacion.docx`

**Resultado: la parte del servidor está terminada y probada, también por HTTP.** Faltan dos cosas: la pantalla «Conectar Apple Pay» (Agente 3, instrucciones en `docs/contrato-logica-core.md`, sección "Fase 3") y la prueba en un iPhone real, que solo puedes hacer tú. No se subió nada a GitHub.

## Cómo funciona

1. En la app creas una **clave de captura** para tu iPhone.
2. En la app **Atajos** creas la automatización «Transacción» con la guía `docs/guia-atajo-apple-pay.md`.
3. Cada vez que pagas con Apple Pay, el atajo envía el monto, el comercio, la tarjeta y la ubicación a tu Supabase. El pago aparece **pendiente** en la bandeja y lo confirmas con un toque.

No hace falta una app de iPhone: el atajo habla directo con el servidor.

## Qué se hizo

**Migración de captura con Apple Pay** (`20261016140000_captura_apple_pay.sql`):

- **Claves de captura:**
  - Son largas y aleatorias (244 bits) y se muestran una sola vez.
  - La base guarda solo su huella SHA-256: ni tú puedes volver a leerla.
  - Hasta 5 por usuario, y se revocan borrándolas.
  - La app no puede crearlas ni cambiarlas a mano, solo por la función.
- **`registrar_pago_billetera`**, la función que llama el atajo:
  - Comprueba la clave y lee el monto en los formatos del iPhone («$12,50», «US$ 1.234,56», o un número).
  - Limpia el comercio de caracteres raros y lo recorta.
  - Reconoce la tarjeta por el banco de su nombre y, si tienes varias de ese banco, por los últimos dígitos.
  - Guarda la ubicación si viene bien y deja el aviso pendiente. La fecha la pone el servidor, en hora de Ecuador.
  - Solo responde `recibido` o `repetido` y el monto: nada de tus datos.
- **Repetidos:** si el atajo se ejecuta dos veces por el mismo pago (mismo monto y comercio en 2 minutos), queda un solo aviso.
- **Límite:** 30 avisos por hora y 200 por día por clave.
- **Sirve también para Google Wallet** (`p_billetera: "google_wallet"`). Así, en Android se puede usar MacroDroid o Tasker mientras llega la Fase 4.

**Core:** `crearClaveCaptura`, `listarClavesCaptura` (nunca pide la huella), `revocarClaveCaptura` y `configuracionAtajo` (la URL y los encabezados para el atajo).

**Guía para el usuario:** `docs/guia-atajo-apple-pay.md`, paso a paso, con una tabla de errores y consejos de seguridad.

**Cambio respecto al plan:** el atajo ya no envía la fecha; la pone el servidor. El atajo corre en el momento de pagar, así que es igual de exacta y hay un dato menos que validar.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (Postgres desechable, 26 migraciones desde cero) | **166 de 166** (27 nuevas, `supabase/tests/captura_apple_pay.sql`) |
| Pruebas de lógica (`pnpm --filter core test`) | **117 de 117** (4 nuevas, `packages/core/test/clavesCaptura.test.ts`) |
| Pruebas de la web y del teléfono | 3 de 3 y 7 de 7 |
| TypeScript en core, web y teléfono | Sin errores |
| **Prueba de punta a punta por HTTP**: Postgres desechable + PostgREST 16.4 (el servidor REST de Supabase) + curl con el mismo cuerpo que arma Atajos | 9 de 9 respuestas correctas (abajo) |

Respuestas de la prueba por HTTP:

| Petición | Respuesta |
|---|---|
| Pago con monto «$12,50», tarjeta «Produbanco Visa» y coordenadas | 200 `recibido`: aviso pendiente, tarjeta reconocida, ubicación redondeada |
| El mismo pago otra vez | 200 `repetido`: sigue habiendo un solo aviso |
| Monto como número JSON (7.25), sin ubicación | 200 `recibido` |
| Clave inventada | **403** `Clave no válida.` |
| Monto «gratis» | **400** `Monto no válido` |
| Clave en la URL en vez del cuerpo | **400**: no funciona |
| Leer la bandeja con la clave pública | Lista vacía: no ve nada |
| Leer las claves con la clave pública | **401**: permiso denegado |
| Aviso número 31 en una hora | **429** `Demasiados avisos` |

Las 27 pruebas nuevas de la base cubren:

- **La clave:** solo se guarda su huella; nadie lee la huella; no se crean ni cambian claves a mano; G no ve ni revoca las de F; una clave revocada no funciona; eliminar la cuenta borra sus claves.
- **Montos:** 17 formatos se leen igual que en core, y un monto ilegible o de menos de un centavo se rechaza.
- **Errores:** una clave mal escrita y una inventada dan el mismo error, sin pistas.
- **La tarjeta:** se reconoce por banco y por dígitos, y si es ambiguo se elige al confirmar.
- **La ubicación:** con coma sirve; ilegible o imprecisa se descarta sin perder el aviso.
- **Textos y otros casos:** el comercio llega sin caracteres de control; funciona para Google Wallet; el límite por hora corta y es por clave; máximo 5 claves; una clave necesita nombre.
- **Permisos:** sin sesión no se crean claves, y con sesión de usuario no se puede llamar a la función del atajo.
- **De punta a punta:** confirmar el pago captado crea el gasto con Apple Pay, crédito, su lugar y el cupo descontado.

## Errores encontrados y corregidos

- **Una prueba de la Fase 1 pasaba sin comprobar nada.** La U19 llamaba a la confirmación dentro de un `WHERE`, así que Postgres la ejecutaba en cada fila y la consulta nunca veía el gasto creado. Comparaba una fila vacía y "pasaba". Lo descubrió la prueba nueva W24, que con el mismo patrón falló. Las dos se corrigieron y la U19 ahora exige que el gasto exista.
- **Una precisión de GPS ilegible dejaba la ubicación como si fuera exacta.** Ahora, si la precisión viene mal o es de más de 50 km, se descarta la ubicación entera.
- **La función del atajo estaba abierta también a sesiones de usuario.** Ahora solo la puede llamar el rol público (`anon`), que es el que usa el atajo.

## Lo que falta o no está comprobado

- **La prueba en un iPhone real** con una tarjeta de Produbanco, Guayaquil o Bolivariano. No sé con certeza cómo envía iOS el monto en español (texto con «US$» o número): el lector acepta las dos formas, pero hay que verlo en tu iPhone. Tampoco está comprobado el nombre exacto de cada campo de la automatización, que puede variar según la versión de iOS.
- **La pantalla «Conectar Apple Pay»** y los íconos de origen en la bandeja (Agente 3).
- **El enlace de iCloud al atajo ya armado**: tienes que crearlo tú en un iPhone siguiendo la guía, con «Preguntas de importación» para la clave.
- **Tu Supabase web todavía no tiene ninguna de las migraciones nuevas.** Pégalas en el SQL Editor en este orden; cada una debe terminar con `aplicada = sí`:
  1. `supabase/para-supabase-web/16-10-2026 4AM/1 - gastos, lugares, transacciones_detectadas.sql`
  2. `supabase/para-supabase-web/16-10-2026 4AM/2 - gastos, lugares, transacciones_detectadas (borrar ubicaciones).sql`
  3. `supabase/para-supabase-web/16-10-2026 4AM/3 - claves_captura, transacciones_detectadas.sql`

## Seguridad

- **Autorización:** la clave pública de Supabase es pública por diseño; lo que autoriza es la clave de captura. Sus 244 bits aleatorios la hacen imposible de adivinar, y la base guarda solo la huella. Con la clave solo se crean avisos **pendientes**: no se lee nada ni se crea ningún gasto.
- **Sin pistas:** una clave mal escrita, inventada o revocada recibe el mismo error. Antes de calcular la huella se revisa el formato, así que un texto enorme no cuesta trabajo.
- **La clave nunca en la URL:** la función solo la acepta en el cuerpo, así no queda en los registros de servidores. Comprobado por HTTP.
- **Abuso:** 30 avisos por hora y 200 por día por clave. El conteo bloquea la fila de la clave, así que dos llamadas simultáneas no se saltan el límite, y responde 429.
- **Permisos mínimos:** `registrar_pago_billetera` solo para `anon`; `crear_clave_captura` solo para usuarios con sesión; los lectores de monto y coordenadas no se pueden llamar desde fuera. Las funciones `security definer` tienen el `search_path` fijo.
- **Tablas:** `claves_captura` con RLS, sin INSERT ni UPDATE para nadie y sin acceso a la columna `huella`.
- **Sin SQL dinámico.**
- **Datos de terceros:** el comercio pierde los caracteres de control y se recorta a 200; el monto pasa por un lector estricto; la tarjeta solo aporta banco y últimos dígitos; las coordenadas se validan.
- **Tiempos de espera:** las consultas del rol `anon` tienen el tiempo máximo de Supabase (3 s). La función hace pocas consultas, todas con índice (la huella es única, y los avisos tienen un índice por clave y fecha).
- **Privacidad:** al confirmar o descartar el aviso se borran el comercio, la ubicación y la tarjeta (Fase 1). Revocar una clave no borra los avisos que ya llegaron. Eliminar la cuenta borra las claves.

## Siguiente

- **Fase 4** (Google Wallet en Android, con un módulo nativo que lee el aviso de Wallet). Mientras tanto, MacroDroid o Tasker pueden llamar a esta misma función con `p_billetera: "google_wallet"`.
- **Fase 5** (resumen por lugar).

Las dos se pueden hacer en paralelo.
