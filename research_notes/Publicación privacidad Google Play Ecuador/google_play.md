# Google Play: privacidad y publicación de una app de gastos (18 oct 2026)

## ¿Qué política de privacidad y declaraciones de datos son obligatorias?

### Takeaway
Toda app publicada debe enlazar una política de privacidad pública y accesible también dentro de la app; Data safety debe describir fielmente la recopilación, uso, transferencia y protección de datos de la app y sus SDK. Los datos financieros y de autenticación son sensibles.

### Cited Findings
- Google exige un enlace de política de privacidad en Play Console y enlace o texto en la app. Debe incluir identidad/contacto del desarrollador, clases de datos personales y sensibles, destinatarios, seguridad y retención/eliminación; nombrar la app o entidad como aparece en Play; URL activa, pública, sin bloqueo geográfico, no PDF y no editable. Aplica incluso a apps que no recogen datos. — [User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- La política y avisos dentro de la app deben cubrir cómo se accede, recopila, usa y comparte toda clase de datos de usuario/dispositivo, incluso lo no incluido en Data safety. Datos financieros, de pago y credenciales son sensibles; se exige limitar uso a funciones esperadas, protegerlos (p. ej. HTTPS), usar permisos runtime cuando existan, y no venderlos ni divulgar públicamente datos financieros personales. El desarrollador responde también por SDK y terceros. — [User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- Si algún tratamiento de datos sensibles no es razonablemente esperado (p. ej. lectura de correo en segundo plano), se requiere explicación destacada en el flujo normal de la app antes de pedir permiso/consentimiento: qué datos, para qué y con quién se comparten; consentimiento inequívoco por acción afirmativa. No basta la política de privacidad o términos. — [User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- Data safety es obligatoria para apps en pruebas cerradas, abiertas o producción; prueba exclusivamente interna está exenta. Se declaran también datos de SDK/bibliotecas y se actualiza al cambiar prácticas. Incluso si no recoge datos, se llena formulario y se enlaza política. — [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-en)
- “Recopilar” en Data safety significa transmitir fuera del dispositivo; los datos que solo permanecen localmente no se marcan como recogidos. Transferencias a proveedores que procesan por cuenta del desarrollador pueden no contarse como “compartir”, pero sí deben declararse como recogidas si salen del dispositivo; revisar la definición de proveedor e incluir prácticas del SDK. — [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-en)
- Categorías pertinentes a esta app según los datos realmente enviados: correo e ID de usuario, información de pago/cuentas, historial de compras o transacciones, ingresos/deudas como “otra información financiera”, archivos/fotos y actividad de la app si corresponde. Hay que responder para cada tipo finalidad, obligatoriedad/opcionalidad, recopilación/compartición, cifrado en tránsito y borrado; las respuestas son globales para todas las versiones/regiones activas. — [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-en)

### Inferences
- Preparar un inventario comprobable de flujo de datos por función (Supabase, analítica, OCR, importaciones, Gmail, notificaciones y SDK). La etiqueta Data safety debe basarse en el comportamiento del AAB final; no se pueden preseleccionar casillas sin auditarlo.
- Conviene publicar una página HTML de privacidad con fecha de vigencia, responsable/contacto, clases de datos, proveedores concretos, finalidades, plazos o criterios de conservación, derechos y borrado, y dejar su enlace visible en ajustes/registro.

### Gaps
- Sin inspección del paquete final y contratos/configuración de servicios no se puede afirmar qué casillas exactas de Data safety aplican ni qué datos salen del dispositivo.

## ¿Qué requiere Google para borrar cuentas y datos?

### Takeaway
Si se pueden crear cuentas dentro de la app, debe existir una ruta visible para pedir borrado dentro de la app y una página web funcional para pedirlo sin reinstalarla; borrar debe incluir datos asociados salvo retención legítima explicada.

### Cited Findings
- Google exige ambas rutas, in-app y recurso web, y solicita la URL del recurso en Play Console; desactivar/congelar la cuenta no cuenta. Si se conserva alguna información por seguridad, fraude o cumplimiento normativo, se informa claramente. — [User Data, Account Deletion](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- La página web debe funcionar, destacar la solicitud y nombrar app/desarrollador; puede usar formulario o correo de atención. No debe obligar a volver a instalar la app; si hay pasos adicionales (p. ej. cancelar suscripción), deben explicarse y ofrecer soporte. Todos los desarrolladores responden las preguntas de eliminación de Data safety. — [Account deletion FAQ](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- Fechas históricas: preguntas de eliminación desde 2023; fecha límite general 7 dic 2023, extensión al 31 may 2024; posterior incumplimiento puede llevar a medidas, incluida eliminación de Play. — [Account deletion FAQ](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

### Inferences
- Si esta app crea usuario en Supabase, la solicitud debe eliminar no solo la credencial sino movimientos, cuentas, presupuestos, archivos y datos derivados ligados a esa cuenta, con un flujo de verificación de identidad razonable.

### Gaps
- No se ha verificado en este subestudio si la app ya tiene borrado completo, página web activa o retenciones justificadas.

## ¿Hay reglas específicas por ser una app financiera?

### Takeaway
La declaración de funciones financieras es obligatoria para toda app publicada. Un rastreador de gastos/deudas puede encajar en “Other” y quizá “Financial advice” si realmente aconseja; las reglas estrictas de préstamos solo aplican si presta, facilita crédito o funciona como accesorio de préstamos.

### Cited Findings
- Google define servicios financieros como relacionados con gestionar o invertir dinero, incluso asesoría personalizada, exige cumplir leyes locales de cada región objetivo y completar la declaración de funciones financieras. — [Financial Services](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en)
- Toda app en prueba cerrada, abierta o producción debe completar Financial features, incluso para declarar que no ofrece funciones financieras. El formulario ofrece “Financial advice” y “Other”, además de banca, préstamos, pagos, inversiones y otros. Vigente desde 31 ago 2023. — [Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en)
- Restricciones de préstamos (metadatos de plazo/APR, documentación de prestamista y prohibición de ciertos permisos como fotos/contactos/ubicación precisa) se aplican a apps que ofrecen o facilitan préstamos y a apps accesorias de préstamo/crédito, como calculadoras o guías de préstamos; no son una prohibición general a cualquier app que registre deudas. — [Financial Services](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en)

### Inferences
- Declarar honestamente “Other” para control de gastos, presupuestos, tarjetas y diferidos, salvo que Play Console ofrezca una categoría más precisa en el formulario actual. Registrar cuotas propias no equivale por sí solo a prestar dinero. Evitar en la ficha afirmaciones de banco, prestamista, asesor regulado o sincronización bancaria si no existen.

### Gaps
- La clasificación definitiva depende de comportamiento y textos comerciales del AAB final; no se ha visto el formulario interactivo de la cuenta de Play Console.

## ¿Qué pasa con Pro a USD 2,99, permisos, Gmail y ficha de tienda?

### Takeaway
Cobrar dentro de la app por automatización digital requiere Play Billing en Ecuador salvo excepción aplicable; una suscripción debe aportar valor recurrente y permitir gestión/cancelación sencilla. Los permisos deben limitarse a funciones publicadas; Gmail tiene además una verificación distinta de la revisión de Play.

### Cited Findings
- Apps distribuidas por Play que cobran funciones o servicios digitales dentro de la app deben usar Google Play Billing, salvo excepciones de la política. “Financial management software” se menciona expresamente como servicio digital cubierto. Pagar una factura real de tarjeta o servicio es una categoría distinta no soportada por Play Billing. — [Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en); [Payment policy explainer](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en-en)
- La oferta debe exponer claramente precio, periodo, renovación automática, obligatoriedad del pago y demás condiciones; la suscripción debe dar valor continuo. En ajustes debe haber método online fácil para cancelar, por ejemplo enlace al centro de suscripciones de Play. Pruebas gratis requieren explicar conversión a cobro y cancelación. — [Subscriptions](https://support.google.com/googleplay/android-developer/answer/9900533?hl=en)
- Play exige permisos/APIs sensibles necesarios para funciones actuales anunciadas, solicitados en contexto. `READ_MEDIA_IMAGES/VIDEO` exige justificar por qué el selector del sistema no basta para la función principal; `MANAGE_EXTERNAL_STORAGE` es restringido; ubicación debe pedir el alcance mínimo, y la ubicación en segundo plano requiere justificación y declaración específica. — [Permissions and APIs](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en); [Background location](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en)
- Android 13+ requiere permiso runtime `POST_NOTIFICATIONS` para notificaciones no exentas. — [Android Developers](https://developer.android.com/develop/ui/compose/notifications/notification-permission)
- `gmail.readonly` y `gmail.metadata` son ámbitos OAuth restringidos; Gmail recomienda el alcance mínimo, verificación OAuth y evaluación de seguridad si datos de ámbito restringido se almacenan o transmiten a servidores. El uso permitido de Gmail está limitado a determinados casos de beneficio para el usuario y prohíbe usar esos datos para anuncios, intermediarios de datos, evaluar solvencia/préstamos o entrenar modelos generales. — [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes); [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification); [Workspace user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)
- Para OAuth de producción, Google exige página de inicio pública en dominio verificado, con descripción de la app y enlaces a términos y privacidad; la política debe estar en el mismo dominio e indicar uso/almacenamiento/compartición de datos de Google. Esto es requisito de OAuth, no requisito general de Play para toda app. — [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies); [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- En Play Console App content se declaran anuncios, acceso restringido para revisores, público objetivo, clasificación por edades, privacidad, permisos sensibles y Data safety. Se debe proporcionar una cuenta de demostración reutilizable sin obstáculos como OTP si se exige inicio de sesión; la ficha debe representar funciones reales y no engañar. Se requiere correo de contacto. — [Prepare app for review](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en-en); [Review sign-in details](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en); [Metadata](https://support.google.com/googleplay/android-developer/answer/9898842?hl=en-GB); [Create app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)

### Inferences
- Para importar recibos/estados de cuenta elegidos por el usuario, preferir selector de archivos/fotos a permiso amplio de galería. No pedir ubicación ni acceso a Gmail si no forman parte del lanzamiento.
- La lectura automática de Gmail podría requerir un proceso y coste de verificación de seguridad aparte; no se debe prometer como función de lanzamiento hasta completarlo. Términos de servicio no son una exigencia general de Play identificada aquí, pero sí del flujo OAuth de producción si se usa.

### Gaps
- No se ha verificado el alcance OAuth ni si la app almacena correo en servidor; ello determina el grado exacto de evaluación Gmail.

## ¿Qué condiciones técnicas y de pruebas rigen el envío en octubre de 2026?

### Takeaway
Una app Android nueva debe enviar AAB apuntando a API 36 o superior. Si se usa cuenta personal creada después del 13 nov 2023, requiere prueba cerrada con 12 personas inscritas durante 14 días continuos antes de solicitar producción.

### Cited Findings
- Desde 31 ago 2026, apps nuevas y actualizaciones para móvil deben apuntar a Android 16/API 36 o superior; apps ya publicadas requieren API 35 para seguir visibles a usuarios nuevos de versiones Android más recientes. Existe opción de solicitar extensión hasta 1 nov 2026 para casos elegibles. — [Target API level](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-en)
- Las apps nuevas se publican con Android App Bundle (`.aab`) desde agosto de 2021. — [App bundles](https://support.google.com/googleplay/android-developer/answer/9844279?hl=en-EN)
- Cuentas personales creadas después de 13 nov 2023 deben mantener al menos 12 testers inscritos continuamente por 14 días en prueba cerrada y luego solicitar acceso a producción; la prueba interna es opcional. — [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-en)

### Inferences
- La guía local que diga API 35 como requisito de app nueva ya está desactualizada; el target real se debe comprobar en el AAB producido.

### Gaps
- No se ha comprobado el tipo/fecha de creación de la cuenta Play del desarrollador, por lo que la obligación de 12 testers es condicional.
