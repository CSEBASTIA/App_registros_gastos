# Registro de tratamiento de datos personales

Inventario de **qué datos de las personas guarda fintrack, para qué, dónde y cuánto tiempo**. Es la base de la política de privacidad: si algo cambia aquí, cambia allá.

Última revisión: **18-oct-2026** · Responsable: [el de las páginas públicas].

> Una prueba (`packages/core/test/legal.test.ts`) lee `packages/core/src/types/database.ts` y falla si una tabla de la base no aparece con su nombre en este archivo. Si agregas una tabla, anótala aquí.

## 1. Actividades de tratamiento

| # | Actividad | Datos | Dónde viven | Finalidad | Base | Plazo |
|---|---|---|---|---|---|---|
| 1 | Cuenta y acceso | Correo, contraseña (guardada con hash), fechas de sesión, IP y tipo de dispositivo o navegador | Supabase Auth (`auth.users`, sesiones y registros de Auth) | Crear la cuenta, iniciar sesión, detectar accesos indebidos | Consentimiento y ejecución del servicio | Mientras exista la cuenta. Registros técnicos: lo que defina el proveedor |
| 2 | Constancia de aceptación | Documento (términos o privacidad), versión, plataforma, origen y fecha | `aceptaciones_legales` | Demostrar el consentimiento | Obligación de poder demostrarlo | Se borra con la cuenta |
| 3 | Finanzas personales | Cuentas y tarjetas (nombre, banco, tipo, últimos 4 dígitos opcionales, saldo, cupo, fechas de corte y pago), gastos, ingresos, transferencias entre cuentas propias, deudas, abonos, pagos de tarjeta, presupuestos y los niveles ya avisados de cada uno (75 %, 100 %, excedido), categorías propias, recordatorios y el ajuste «registro automático» | `cuentas`, `gastos`, `ingresos`, `transferencias`, `deudas`, `abonos_deuda`, `pagos_tarjeta`, `presupuestos`, `avisos_presupuesto`, `categorias`, `recordatorios`, `ajustes_usuario` | Mostrar el resumen, los presupuestos, el plan de deudas y las recomendaciones; no avisar dos veces el mismo nivel de un presupuesto | Consentimiento y ejecución del servicio | Se borran con la cuenta |
| 4 | Facturas | Fotos o PDF que la persona adjunta | Storage de Supabase, bucket privado `facturas/<id de la persona>/`; la ruta está en `gastos` | Que la persona las consulte | Consentimiento (adjuntar es opcional) | La app las borra antes de eliminar la cuenta |
| 5 | Ubicación de pagos (opcional) | Latitud, longitud (redondeadas a unos 11 m), precisión y el lugar. Al abrir el detalle de un pago con ubicación, el teléfono pide las imágenes del mapa (teselas) a OpenStreetMap: ver la sección 2 | `gastos`, `lugares`, `transacciones_detectadas`. Las teselas vienen de `tile.openstreetmap.org` (externo) | Resumen de gastos por lugar y mapa del detalle de un pago | Consentimiento específico (hay que activarlo) | Se borra con la cuenta o con «Borrar mis ubicaciones» |
| 6 | Atajo de Apple Pay y notificaciones de Google Wallet (opcionales) | Monto, comercio, nombre o últimos dígitos de la tarjeta, ubicación opcional (solo el atajo), y la clave de captura (solo su huella, su prefijo y su nombre) | `claves_captura`, `transacciones_detectadas`, `gastos` (billetera) | Dejar en la bandeja los pagos para que la persona los confirme o, si la tarjeta se reconoce por sus últimos dígitos y el «registro automático» está encendido (lo está por defecto y se apaga en la app), registrarlos solos como gasto. Al teléfono que tiene la clave solo vuelven el monto, el id del gasto y su categoría (y el nivel de un presupuesto, si lo cruzó) | Consentimiento (hay que crear la clave o conectar Google Wallet) | Se borran con la cuenta; la clave se revoca cuando la persona quiera |
| 7 | Correo conectado (opcional) | Del aviso de un banco: monto, fecha y hora, banco, comercio, últimos dígitos de la tarjeta o cuenta, la otra cuenta propia de la operación, la comisión y el asunto (asunto, comercio y dígitos se borran del aviso al resolverlo). El contenido del correo se analiza en el teléfono; no se guardan nombres de beneficiarios | `transacciones_detectadas`, y lo que se registra en `gastos`, `pagos_tarjeta` y `transferencias`. El permiso de acceso (token) vive solo en el almacenamiento seguro del teléfono | Proponer movimientos a partir de avisos bancarios o, si las cuentas se reconocen por sus últimos dígitos y el «registro automático» está encendido, registrarlos solos (consumos con tarjeta, pagos de tarjeta y transferencias entre cuentas propias). La app busca en el correo sola al abrirse (como mucho cada 10 minutos) | Consentimiento (hay que conectarlo) | El token se borra al desconectar o cerrar sesión |
| 7b | Notificaciones del teléfono (opcionales) | Título y texto de cada aviso (pueden llevar montos y nombres de categoría o comercio) y las preferencias de cada tipo de aviso | Solo en el teléfono: las programa el propio dispositivo (notificaciones locales). Las preferencias, en el almacenamiento de la app, por persona | Avisar pagos registrados o por confirmar, recordatorios y presupuestos | Consentimiento (permiso del sistema; cada tipo se apaga en la app) | Se borran al desinstalar; se cancelan al cerrar sesión |
| 7c | Plan de pago (Plus o Pro) | Plan, estado (activa, cancelada o vencida), fecha de vencimiento, producto comprado, si fue compra de prueba, y de cada aviso de pago: su id, tipo y fecha. **No** se guardan precio, país ni datos de la tarjeta: el cobro lo hace Google Play | `planes_usuario`, `eventos_pago` | Dar acceso a las funciones del plan pagado y revisar un cobro si la persona reclama | Ejecución del contrato (la suscripción) | Se borran con la cuenta. Google Play y RevenueCat guardan su propio historial de compras |
| 8 | Solicitudes de derechos | Correo, texto de la solicitud, fechas | Correo del responsable y `docs/legal/privado/` (fuera de Git) | Atender los derechos de la persona | Obligación legal | Mientras dure el trámite y el plazo de reclamos (a definir con el abogado) |

## 2. Quiénes tratan los datos (encargados)

| Proveedor | Qué hace | Datos que ve | Ubicación |
|---|---|---|---|
| Supabase | Base de datos, Auth y Storage | Todo lo de las actividades 1 a 7 | [región del proyecto] |
| Vercel | Aloja la versión web | Registros de acceso (IP, navegador); no ve datos financieros | Según Vercel |
| Expo (EAS) | Compila la app y entrega actualizaciones | Versión de la app y datos del dispositivo para entregar la actualización; no ve datos financieros | Según Expo |
| Google / Microsoft | Solo si la persona conecta su correo | Los correos que la app lee en el teléfono, con el permiso de la persona | Según el proveedor |
| Google Play | Distribuye la app de Android y cobra las suscripciones | Datos de instalación; en una compra, los datos de pago de la persona (los ve Google, no nosotros) | Según Google |
| RevenueCat | Solo si la persona compra un plan: lleva la cuenta de las suscripciones y nos avisa compras, renovaciones y cancelaciones | El id de la persona en Supabase (no su correo), el producto, las fechas y el país y precio de la compra | Según RevenueCat (Estados Unidos) |

| OpenStreetMap — Nominatim (Fundación OpenStreetMap) | Solo con la ubicación de pagos activada: busca el comercio de un consumo que llegó por correo para darle lugar y dirección. **No es encargado**: la consulta sale del dispositivo | El nombre del comercio (por ejemplo «AKI TARQUI») y un cuadro de unos 28 km alrededor del teléfono (con 2 decimales), además de IP y `User-Agent`. **No ve** monto, tarjeta, cuenta ni correo | Igual que la fila de abajo; la política de uso de Nominatim pide como mucho una búsqueda por segundo y un `User-Agent` propio (la app lo respeta) |
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
| Transferencias solo entre cuentas propias; nadie ve, junta ni separa las de otra persona | `transferencias.sql` |
| El registro automático solo usa la tarjeta reconocida por sus dígitos, se puede apagar, y sus funciones internas no se llaman desde afuera | `registro_automatico.sql` |
| Funciones con permisos elevados fijan `search_path` y se quitan a `anon` | `aceptaciones_legales.sql` (L26), `captura_apple_pay.sql` |
| El plan de pago solo lo escribe el servidor con los avisos de RevenueCat que traen su clave secreta; la persona solo ve el suyo, y un aviso repetido o desordenado no cambia el plan | `planes_usuario.sql` |
| La contraseña exige 8 o más caracteres con letras y números | `packages/core/test/acceso.test.ts` |
| Enlaces del correo con código (PKCE); se rechazan los de `#access_token=` | `acceso.test.ts` |
| Ninguna clave con acceso total (`service_role`) dentro de la app; el verificador la frena | `apps/mobile/test/entornoPublicacion.test.mjs` |
| HTTPS en todo; cabeceras de seguridad en la web | `apps/mobile/vercel.json` |

## 4. Lo que NO se hace

- No se pide el número completo de una tarjeta ni claves bancarias.
- No se toma la ubicación en segundo plano.
- No se envía al servicio de mapas el monto, el comercio, la cuenta ni el correo: solo las coordenadas de las teselas que dibujan la zona, la IP y el nombre de la app.
- No se guarda el contenido de los correos, solo monto, fecha, banco y asunto de los avisos bancarios.
- No hay decisiones automatizadas con efectos legales: las recomendaciones y el puntaje son informativos. El «registro automático» solo anota pagos y transferencias de la propia persona; se puede apagar, y cada movimiento se edita o se borra.
- Las notificaciones no pasan por ningún servidor de avisos (push): las arma el teléfono.
