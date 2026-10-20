# Auditoría de la app FinTrack

- **Fecha:** 18 de octubre de 2026
- **Alcance:** todo el repositorio. Abarca la app de teléfono y la web de Vercel (`apps/mobile`), la web de escritorio (`apps/desktop`), la lógica compartida (`packages/core`), la base de datos (`supabase/`), el módulo nativo de Android y los documentos.
- **Rama y commit evaluados:** `Rama-Logica`, a partir de `1483608`.
- **Datos sensibles:** en este documento no hay claves, ni el identificador del proyecto, ni correos reales. Todos los valores de configuración son **ejemplos**, como `https://<id-del-proyecto>.supabase.co`.

## 1. Resumen

**Qué es.** FinTrack es una app de finanzas personales para personas en Ecuador. Junta en un solo lugar lo que hoy está repartido en varias apps de bancos y tarjetas: cuánto dinero hay en cada cuenta, cuánto cupo queda en cada tarjeta, en qué se va el dinero, qué cuotas vienen y cuánto se debe.

**Para qué se usa.** Para anotar gastos e ingresos en segundos, o sin anotarlos: los pagos con Google Wallet, Apple Pay y los avisos del banco por correo se detectan solos. También sirve para controlar presupuestos y deudas, recibir avisos antes de que venza una cuota y ver dónde y en qué se gasta.

**Estado.** La lógica, la base de datos y las pantallas del teléfono están completas para un piloto, y las pruebas automáticas están en verde. Antes de publicar en Google Play falta:
- probar el APK 1.4.0 en un teléfono real;
- las pantallas «Eliminar mi cuenta» y «Olvidé mi contraseña»;
- actualizar Expo para cumplir lo que pide Google Play;
- cerrar los documentos legales con un abogado.

| Área | Veredicto |
|---|---|
| Funciones | Completas para un piloto en Android |
| Seguridad de los datos | Buena: RLS en todo, validación en la base y sin secretos en el repositorio ni en su historial |
| Calidad (pruebas) | 328 de base, 218 de lógica, 18 del teléfono y 3 de escritorio, todas en verde; tipos sin errores |
| Listo para la tienda | **No todavía** (ver §9) |
| Riesgo más urgente | La web de escritorio publicada no tiene inicio de sesión (§9, H1) |

## 2. Para qué sirve: casos de uso con ejemplos

| Persona y momento | Qué hace en FinTrack | Qué pasa |
|---|---|---|
| Ana paga $3,50 de almuerzo con Google Wallet y su Visa terminada en 4321 | Nada: la app lo detecta | Se registra el gasto «Restaurante · Comida», baja el cupo de la Visa y le llega «Registré $3.50…» |
| Luis pasa $40 de su cuenta de ahorros a efectivo | *Transferencias → Nueva* | Ahorros baja $40 y efectivo sube $40; el balance del mes no cambia |
| María compra una refrigeradora de $900 a 12 meses | «Nuevo gasto», diferido a 12 meses | Se ocupa el cupo, se crea la deuda y se crean 12 recordatorios, cada uno con su notificación |
| Pedro quiere gastar menos en comida | Presupuesto de $200 en Comida | Avisos al 75 %, al 100 % y si se pasa, una vez cada uno |
| Carla recibe el aviso del banco «Transferencia enviada» y luego «recibida» en su otra cuenta | Nada | Se registra como **una** transferencia, no como un gasto y un ingreso |
| José importa el estado de cuenta en PDF de su tarjeta | *Tarjeta → Importar estado de cuenta* | Lee el PDF en el propio teléfono, propone los consumos, marca los ya registrados y muestra cómo queda el cupo |

## 3. Qué incluye

### Teléfono (Android) y web de Vercel (`apps/mobile`)

- **Pestañas:** Resumen, Ingresos, Gastos, Tarjetas y Más.
- **En «Más»:**
  - Bandeja de revisión, Mi perfil, Cuentas y Transferencias.
  - Deudas, Presupuestos, Recordatorios, Notificaciones y Categorías.
  - Lugares y Ubicación de mis pagos.
  - Conectar Apple Pay, Conectar Google Wallet y Correo (beta).
  - Términos y privacidad, si están configurados.
- **Detalles:** cuenta, tarjeta y lugar. «Isla» de detalle de un gasto o ingreso con mapa, editar, eliminar e importar estado de cuenta.

### Web de escritorio (`apps/desktop`)

- Resumen, Ingresos, Gastos, Tarjetas, Cuentas, Deudas, Recordatorios y Categorías.
- OCR de recibos y de estados de cuenta escaneados.
- **Va detrás del teléfono:** no tiene transferencias, presupuestos, bandeja ni billeteras.
- **No tiene inicio de sesión** (ver H1).

### Lógica compartida (`packages/core`)

La usan las dos apps y es la única puerta a la base. Trae:
- **Validaciones:** zod, con los mismos límites que la base.
- **Repositorios:** uno por tabla.
- **Casos de uso:** presupuestos, plan de deudas, puntaje financiero, recomendaciones e importación de estados de cuenta.
- **Utilidades:** fechas en la hora de Ecuador, lectura de correos bancarios, ubicación, notificaciones y montos sin errores de coma flotante.

### Módulo nativo de Android (`apps/mobile/modules/captura-billetera`)

- Lee **solo** las notificaciones de Google Wallet; las demás apps se ignoran sin leerlas.
- Las envía a la base con la clave de captura del teléfono.
- Guarda hasta 20 pendientes si no hay internet.
- Muestra las notificaciones «Registré…», «Por confirmar» y de presupuesto.

## 4. Cómo funciona por dentro

```mermaid
sequenceDiagram
    participant GW as Google Wallet
    participant M as Módulo Android
    participant B as Base (Supabase)
    participant P as Persona
    GW->>M: notificación «SUPERMAXI · $12,50 · Visa •••• 4321»
    M->>B: registrar_aviso_billetera(clave, título, texto, hora)
    B->>B: lee monto, comercio y dígitos; busca la tarjeta
    alt tarjeta reconocida y registro automático encendido
        B->>B: crea el gasto, baja el cupo, categoría y lugar
        B-->>M: {estado: registrado, gasto_id, categoría}
        M->>P: «Registré $12.50 en SUPERMAXI»
    else no reconocida o supera el cupo
        B->>B: deja el aviso en la bandeja
        B-->>M: {estado: recibido, monto}
        M->>P: «Pago de $12.50 por confirmar»
    end
```

**Reglas de diseño que se cumplen en todo el código:**
1. **El dinero se calcula en la base.** Cada gasto, ingreso, pago, abono o transferencia mueve saldos y cupos con disparadores de Postgres. Ninguna pantalla guarda un saldo calculado por ella.
2. **La base es la última barrera.** La clave pública de Supabase va dentro de la app (es pública por diseño). Por eso RLS, los CHECK y los disparadores protegen los datos aunque alguien use la API directamente.
3. **Atómico.** Confirmar un aviso, abonar a una deuda o hacer una transferencia ocurre en un solo paso. Reintentar después de un error de red no duplica nada.
4. **Compatible hacia atrás.** La app nueva sigue funcionando, sin las novedades, contra una base que todavía no se actualizó.

**Ejemplo de configuración** (valores de ejemplo, no reales):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<id-del-proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx   # pública; nunca la service_role
```

Clave de captura (se crea en la app, se ve una sola vez, la base guarda solo su huella):

```
ft_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef   ← formato de ejemplo
```

## 5. Datos que guarda y dónde

| Dato | Ejemplo (inventado) | Dónde | Quién lo ve |
|---|---|---|---|
| Cuenta o tarjeta | «Visa Produbanco», crédito, cupo $1.000, disponible $800, dígitos 4321 | `cuentas` | Solo su dueño (RLS) |
| Gasto | $12,50 · SUPERMAXI · Comida · 18-oct 14:32 · Google Wallet · lugar «Supermaxi» | `gastos` | Solo su dueño |
| Transferencia | Ahorro → Efectivo · $40 · 18-oct | `transferencias` | Solo su dueño |
| Aviso de la bandeja | $12,50 · SUPERMAXI · tarjeta 4321 · pendiente | `transacciones_detectadas` (al resolverse se borran el asunto, el comercio, la ubicación y la tarjeta) | Solo su dueño |
| Ubicación de un pago | -0,1807, -78,4678 (redondeada a ~11 m) | `gastos`, `lugares` | Solo su dueño; se borra con un botón |
| Clave de captura | Nombre «Mi Android», prefijo `012345`, **solo la huella** | `claves_captura` | Nadie puede leer la huella |
| Ajustes y avisos de presupuesto | Registro automático: sí; «Comida 75 % ya avisado» | `ajustes_usuario`, `avisos_presupuesto` | Solo su dueño |
| Tokens del correo | — | Solo en el almacenamiento seguro del teléfono | Nunca llegan a la base |
| Facturas | PDF o foto | Storage privado, carpeta de la persona | Enlace firmado de 1 hora |

Eliminar la cuenta borra todo en cascada (lo comprueba una prueba), y la exportación de datos personales incluye todas las tablas (otra prueba). El inventario completo está en `docs/legal/registro-tratamiento-datos.md`.

## 6. Servicios externos y qué ve cada uno

| Servicio | Para qué | Qué ve |
|---|---|---|
| Supabase | Base de datos, inicio de sesión y archivos | Todos los datos de la app, protegidos por RLS |
| Expo (EAS) | Compilar la app y entregar actualizaciones | Versión de la app y datos del dispositivo; no ve datos financieros |
| Vercel | Publicar las versiones web | Registros de acceso (IP y navegador) |
| Google y Microsoft | Solo si la persona conecta su correo | Los correos que el teléfono lee con permiso |
| Google Wallet | La app lee su notificación en el teléfono | Google no recibe nada de la app |
| OpenStreetMap | Mapa al abrir el detalle de un pago | Zona aproximada (~600 m) e IP; no ve monto, comercio ni cuenta |

No hay publicidad, analítica de terceros ni servidor de notificaciones (push).

## 7. Seguridad: controles y cómo se comprueban

| Control | Comprobación |
|---|---|
| RLS en todas las tablas; nadie ve ni cambia datos ajenos | `seguridad_y_presupuestos.sql` (36 pruebas, entre ellas 12 ataques entre usuarios) |
| No se puede apuntar a la cuenta de otra persona | `validar_referencias_propias`; pruebas de ataques |
| Transferencias solo entre cuentas propias | `transferencias.sql` (29) |
| Registro automático solo con la tarjeta reconocida por dígitos; funciones internas cerradas | `registro_automatico.sql` (26) |
| Clave de captura: formato, huella, límites, revocación y nunca en la URL | `captura_apple_pay.sql` (27), `captura_google_wallet.sql` (19) |
| Funciones con permisos elevados con `search_path` fijo | Se comprueba en cada corrida |
| Sin inyección SQL (SQL estático, parámetros de PostgREST) | Revisión y prueba con texto malicioso |
| Contraseñas de 8 o más caracteres, enlaces del correo con PKCE | `acceso.test.ts` |
| La publicación se frena con una URL local o la clave `service_role` | `entornoPublicacion.test.mjs` |
| Secretos fuera del repositorio | Revisado el 18-oct: ni el código ni el historial tienen claves, tokens ni `.env` |

**Revisión de datos sensibles en documentos (18-oct):**
- El identificador del proyecto de Supabase aparecía en el README y en `docs/contrato-logica-core.md`.
- El correo personal y el de la cuenta de prueba aparecían en `reports/experiencia-cliente-dia-cotidiano-2026-10-16.md`.

Todos se reemplazaron por ejemplos. El identificador del proyecto de EAS y el dueño de Expo siguen en `apps/mobile/app.json`: los necesita la compilación y no son secretos.

## 8. Calidad: pruebas y verificación (18-oct)

| Verificación | Resultado |
|---|---|
| Base de datos (`bash supabase/tests/correr.sh`): 36 migraciones desde cero en un Postgres desechable | **328/328** (incluye la prueba de concurrencia) |
| Lógica (`pnpm --filter core test`) | **218/218** |
| Teléfono (`pnpm --filter mobile test`) | **18/18** |
| Web de escritorio (`pnpm --filter desktop test`) | **3/3** |
| Tipos (`tsc --noEmit`) en core, teléfono y escritorio | Sin errores |
| Empaquetado | `expo export` Android (4,23 MB) y web: correcto. `vite build` de escritorio: correcto (320 módulos) |
| Código Kotlin del módulo | Compila contra Android 34 con Kotlin 1.9.24 |
| Actualización de la base web | El texto único se aplicó en el proyecto web (`aplicada = sí`). Antes se probó en una base igual a la del proyecto: 0 fallas |
| Revisión visual | Pantallas nuevas en el navegador con datos de ejemplo: sin errores en la consola |

**Pruebas de base por archivo:**

| Archivo | Pruebas | Archivo | Pruebas |
|---|---|---|---|
| seguridad_y_presupuestos | 36 | integridad_saldos | 16 |
| transferencias | 29 | recordatorios_diferidos | 15 |
| aceptaciones_legales | 27 | abono_deuda | 13 |
| captura_apple_pay | 27 | resumen_por_lugar | 13 |
| billeteras_ubicacion | 26 | saldos_confiables | 13 |
| registro_automatico | 26 | exportar_datos_persona | 11 |
| captura_google_wallet | 19 | correo_bandeja, eliminar_cuenta_y_rendimiento | 10 c/u |
| casas_comerciales_y_corte, borrar_ubicaciones | 9 c/u | editar_movimientos / hora_del_pago | 7 / 6 |
| diferidos_cupo_interes | 5 | concurrencia (dos abonos simultáneos) | 1 |

**Lo que las pruebas no cubren:** un teléfono real (notificaciones nativas, permiso de Android 13, GPS), los avisos reales de Google Wallet y de los bancos, y la carga con muchos usuarios a la vez.

## 9. Hallazgos y riesgos

| # | Hallazgo | Gravedad | Recomendación |
|---|---|---|---|
| H1 | La **web de escritorio publicada** en Vercel (es el enlace del «About» del repositorio) no tiene inicio de sesión: en producción se ve vacía con «Sin sesión», y muestra el botón «Borrar todo (temporal)». No expone datos (sin sesión, RLS no deja leer nada), pero da mala impresión y confunde | Alta antes de difundirla | Quitar el enlace del «About» o apuntarlo a la web del teléfono. Agregar login a la de escritorio o retirarla |
| H2 | **El repositorio es público** y tiene la app entera. No hay claves, pero el código y los documentos internos están a la vista | Alta | Hacerlo privado y publicar aparte una vitrina sin código (decidido el 18-oct) |
| H3 | Falta la pantalla **«Eliminar mi cuenta»**, que exige Google Play (la lógica ya existe), y «Olvidé mi contraseña» | Alta | Construirlas con `eliminarMiCuenta` y `solicitarRecuperacion` de core |
| H4 | **Expo SDK 51**: Google Play exige Android 15 o más reciente | Alta para la tienda | Actualizar Expo y volver a compilar |
| H5 | **APK 1.4.0 sin probar** en un teléfono real | Alta | Compilar y seguir la lista de pruebas del informe del 18-oct |
| H6 | **Documentos legales en borrador:** faltan los datos del responsable, la región de Supabase y los días de respaldo | Alta | Completarlos y revisarlos con un abogado (`docs/legal/README.md`) |
| H7 | La migración `cupo_en_lote` está aplicada en el proyecto web pero **no está en el repositorio** | Media | ~~Agregarla a `supabase/migrations/`~~ **Superado el 20-oct:** quedó obsoleta (una tarjeta puede pasarse del cupo) y la `20261019120000_saldos_y_registro_del_correo` la desactiva; no se agrega |
| H8 | **Registro automático:** si dos tarjetas comparten los últimos 4 dígitos, el pago no se registra solo (va a la bandeja). Si los dígitos anotados son de otra tarjeta, el gasto se carga a la tarjeta equivocada | Media | Se puede apagar; el gasto se corrige desde la notificación. Explicar bien en la pantalla de dígitos |
| H9 | **Correo:** faltan los remitentes de Produbanco, Diners y Austro; los cuerpos reales no están verificados; no se verifica DKIM/SPF; `gmail.readonly` necesita la verificación de Google | Media | Conseguir avisos reales; seguir con la revisión humana de gastos e ingresos |
| H10 | La web de escritorio va detrás: no tiene transferencias, presupuestos ni abono con cuenta de origen, y usa `toISOString()` para «hoy» | Media | Igualarla al teléfono o retirarla |
| H11 | La Supabase local está desactualizada desde el 15-oct | Baja | `supabase migration up` |

## 10. Recomendaciones, en orden

1. Hacer privado el repositorio y quitar el enlace a la web de escritorio del «About» (H1, H2).
2. Compilar el APK 1.4.0 y probarlo: Google Wallet con y sin dígitos, notificaciones, recordatorios y presupuestos (H5).
3. Construir «Eliminar mi cuenta» y «Olvidé mi contraseña» (H3).
4. Actualizar Expo (H4) y completar los documentos legales (H6) antes de Google Play.
5. ~~Subir `cupo_en_lote` al repositorio (H7).~~ Superado el 20-oct: ver H7.
6. Conseguir avisos reales de los bancos y de Google Wallet para ajustar la lectura (H8, H9).

## Anexo: cómo repetir esta auditoría

```bash
pnpm install
pnpm --filter core test && pnpm --filter mobile test && pnpm --filter desktop test
bash supabase/tests/correr.sh                       # requiere Docker; base desechable
(cd apps/mobile && npx tsc --noEmit && npx expo export --platform android)
(cd apps/desktop && npx tsc --noEmit && npx vite build)
git grep -n -I -E "eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role\"?\s*[:=]"   # no debe encontrar nada
```
