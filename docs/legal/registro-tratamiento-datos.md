# Registro de tratamiento de datos personales

Inventario de **qué datos de las personas guarda fintrack, para qué, dónde y cuánto tiempo**. Es la base de la política de privacidad: si algo cambia aquí, cambia allá.

Última revisión: **16-oct-2026** · Responsable: [el de las páginas públicas].

> Una prueba (`packages/core/test/legal.test.ts`) lee `packages/core/src/types/database.ts` y falla si una tabla de la base no aparece con su nombre en este archivo. Si agregas una tabla, anótala aquí.

## 1. Actividades de tratamiento

| # | Actividad | Datos | Dónde viven | Finalidad | Base | Plazo |
|---|---|---|---|---|---|---|
| 1 | Cuenta y acceso | Correo, contraseña (guardada con hash), fechas de sesión, IP y tipo de dispositivo o navegador | Supabase Auth (`auth.users`, sesiones y registros de Auth) | Crear la cuenta, iniciar sesión, detectar accesos indebidos | Consentimiento y ejecución del servicio | Mientras exista la cuenta. Registros técnicos: lo que defina el proveedor |
| 2 | Constancia de aceptación | Documento (términos o privacidad), versión, plataforma, origen y fecha | `aceptaciones_legales` | Demostrar el consentimiento | Obligación de poder demostrarlo | Se borra con la cuenta |
| 3 | Finanzas personales | Cuentas y tarjetas (nombre, banco, tipo, últimos 4 dígitos opcionales, saldo, cupo, fechas de corte y pago), gastos, ingresos, deudas, abonos, pagos de tarjeta, presupuestos, categorías propias y recordatorios | `cuentas`, `gastos`, `ingresos`, `deudas`, `abonos_deuda`, `pagos_tarjeta`, `presupuestos`, `categorias`, `recordatorios` | Mostrar el resumen, los presupuestos, el plan de deudas y las recomendaciones | Consentimiento y ejecución del servicio | Se borran con la cuenta |
| 4 | Facturas | Fotos o PDF que la persona adjunta | Storage de Supabase, bucket privado `facturas/<id de la persona>/`; la ruta está en `gastos` | Que la persona las consulte | Consentimiento (adjuntar es opcional) | La app las borra antes de eliminar la cuenta |
| 5 | Ubicación de pagos (opcional) | Latitud, longitud (redondeadas a unos 11 m), precisión y el lugar. Al abrir el detalle de un pago con ubicación, el teléfono pide las imágenes del mapa (teselas) a OpenStreetMap: ver la sección 2 | `gastos`, `lugares`, `transacciones_detectadas`. Las teselas vienen de `tile.openstreetmap.org` (externo) | Resumen de gastos por lugar y mapa del detalle de un pago | Consentimiento específico (hay que activarlo) | Se borra con la cuenta o con «Borrar mis ubicaciones» |
| 6 | Atajo de Apple Pay (opcional) | Monto, comercio, nombre de la tarjeta o pase, ubicación opcional, y la clave de captura (solo su huella, su prefijo y su nombre) | `claves_captura`, `transacciones_detectadas`, `gastos` (billetera) | Dejar en la bandeja los pagos del iPhone para que la persona los confirme | Consentimiento (hay que crear la clave) | Se borran con la cuenta; la clave se revoca cuando la persona quiera |
| 7 | Correo conectado (opcional) | Del aviso de un banco: monto, fecha, banco y asunto (el asunto se borra al confirmar o descartar). El contenido del correo se analiza en el teléfono | `transacciones_detectadas`. El permiso de acceso (token) vive solo en el almacenamiento seguro del teléfono | Proponer movimientos a partir de avisos bancarios | Consentimiento (hay que conectarlo) | El token se borra al desconectar o cerrar sesión |
| 8 | Solicitudes de derechos | Correo, texto de la solicitud, fechas | Correo del responsable y `docs/legal/privado/` (fuera de Git) | Atender los derechos de la persona | Obligación legal | Mientras dure el trámite y el plazo de reclamos (a definir con el abogado) |

## 2. Quiénes tratan los datos (encargados)

| Proveedor | Qué hace | Datos que ve | Ubicación |
|---|---|---|---|
| Supabase | Base de datos, Auth y Storage | Todo lo de las actividades 1 a 7 | [región del proyecto] |
| Vercel | Aloja la versión web | Registros de acceso (IP, navegador); no ve datos financieros | Según Vercel |
| Expo (EAS) | Compila la app y entrega actualizaciones | Versión de la app y datos del dispositivo para entregar la actualización; no ve datos financieros | Según Expo |
| Google / Microsoft | Solo si la persona conecta su correo | Los correos que la app lee en el teléfono, con el permiso de la persona | Según el proveedor |
| Google Play | Distribuye la app de Android | Datos de instalación | Según Google |
| OpenStreetMap (Fundación OpenStreetMap) | Sirve las imágenes del mapa del detalle de un pago con ubicación. **No es encargado**: la persona lo consulta desde su dispositivo | Dirección IP, tipo de dispositivo o navegador, el nombre de la app y la zona que se pide (cuadros de unos 600 m a zoom 16). **No ve** monto, comercio, cuenta ni correo | Su política (revisada el 16-oct-2026) dice que otros datos personales están en Reino Unido y Países Bajos, con respaldos en la UE, y que usa una red de entrega de contenido; excluye de esa afirmación los datos de las teselas y no indica cuánto tiempo guarda los registros de acceso |

Apple (Wallet y Atajos) corre en el iPhone de la persona: el atajo envía los pagos directo a nuestro servidor; Apple no es nuestro encargado.

**OpenStreetMap** es un servicio externo, no un encargado: se informa en la política (secciones 2 y 4) y queda como pregunta para el abogado (n.º 13 de `README.md`). Condiciones de uso del servidor de teselas (política de uso, 16-oct-2026): identificar la app con un `User-Agent` propio (la app manda `FinTrack/<versión> (<paquete>)`), mostrar la atribución «© OpenStreetMap contributors», no precargar zonas ni descargar en masa, y respetar la caché; pueden bloquear el uso intensivo sin aviso y no hay garantía de disponibilidad. Si la app crece, conviene un proveedor de mapas propio o de pago.

**Venta y publicidad**: no se venden datos, no hay publicidad ni analítica de terceros. Si eso cambia, **primero** la política.

## 3. Medidas de seguridad (y dónde se prueban)

| Medida | Prueba |
|---|---|
| RLS en todas las tablas: cada persona solo ve y cambia lo suyo | `supabase/tests/seguridad_y_presupuestos.sql` |
| Eliminar la cuenta borra todo en cascada, también las aceptaciones | `eliminar_cuenta_y_rendimiento.sql`, `aceptaciones_legales.sql` (L24, L27) |
| Toda tabla con `usuario_id` se borra con la cuenta | `aceptaciones_legales.sql` (L27) |
| La aceptación no se puede modificar ni borrar a mano, y la fecha la pone el servidor | `aceptaciones_legales.sql` (L08 a L10) |
| La copia de datos la saca solo la administración y no incluye secretos | `exportar_datos_persona.sql` |
| Clave de captura de Apple Pay: solo su huella, límite de avisos por hora y día, nunca en la URL | `captura_apple_pay.sql` |
| Funciones con permisos elevados fijan `search_path` y se quitan a `anon` | `aceptaciones_legales.sql` (L26), `captura_apple_pay.sql` |
| La contraseña exige 8 o más caracteres con letras y números | `packages/core/test/acceso.test.ts` |
| Enlaces del correo con código (PKCE); se rechazan los de `#access_token=` | `acceso.test.ts` |
| Ninguna clave con acceso total (`service_role`) dentro de la app; el verificador la frena | `apps/mobile/test/entornoPublicacion.test.mjs` |
| HTTPS en todo; cabeceras de seguridad en la web | `apps/mobile/vercel.json` |

## 4. Lo que NO se hace

- No se pide el número completo de una tarjeta ni claves bancarias.
- No se toma la ubicación en segundo plano.
- No se envía al servicio de mapas el monto, el comercio, la cuenta ni el correo: solo las coordenadas de las teselas que dibujan la zona, la IP y el nombre de la app.
- No se guarda el contenido de los correos, solo monto, fecha, banco y asunto de los avisos bancarios.
- No hay decisiones automatizadas con efectos legales: las recomendaciones y el puntaje son informativos.
