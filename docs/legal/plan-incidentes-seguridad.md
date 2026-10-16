# Plan de respuesta a incidentes de seguridad

Qué hacer si pasa algo que **pone en riesgo los datos de las personas**: una clave filtrada, alguien que entró a lo que no debía, datos expuestos o perdidos. La ley de protección de datos de Ecuador obliga a **notificar a la Superintendencia de Protección de Datos Personales** y, cuando hay riesgo para ellas, **a las personas afectadas**. El plazo legal que se maneja es de **5 días**; la norma técnica nueva (Resolución SPDP-SPD-2026-0040-R, Registro Oficial del 24-sep-2026) manda notificar por el sistema digital de la Superintendencia. Ambos puntos (desde cuándo corren los 5 días y cómo te registras en ese sistema) están como pregunta para el abogado en [`README.md`](README.md). **Cuenta los 5 días desde que te enteras**, que es lo más exigente.

> Si dudas de si algo es un incidente, trátalo como uno hasta descartarlo: regístralo y decide después.

## 1. Qué cuenta como incidente

- Una clave **secreta** filtrada: la `service_role` o secreta de Supabase, la contraseña de la base, un token de Expo/EAS, de Vercel o de GitHub (en el código, en un chat, en una captura).
- Acceso indebido: alguien ve o cambia datos de otra persona; un error de RLS; una cuenta tomada.
- Pérdida o exposición de una copia de datos (una exportación enviada a quien no era, un respaldo en un lugar abierto).
- Un fallo de un proveedor que expone datos (Supabase, Vercel, Expo, Google) y que ellos te avisan.
- Una clave de captura de Apple Pay usada por alguien más (solo deja avisos pendientes, pero hay que revocarla).

La clave **pública** de Supabase (`anon`/`publishable`) y los Client ID de Google y Microsoft **no son secretos** y no son incidente si se ven: están dentro de la app por diseño.

## 2. Primeras horas: contener

| Qué pasó | Qué haces |
|---|---|
| Se filtró la clave `service_role` / secreta | Supabase → *Project Settings → API*: **rota la clave** (genera una nueva) y actualiza donde se usara. Revisa los registros por usos raros |
| Se filtró la contraseña de la base | *Project Settings → Database*: **resetea la contraseña** |
| Se filtró un token de Expo, Vercel o GitHub | Revócalo en el panel del servicio y crea otro. Revisa los despliegues recientes |
| Una cuenta de usuario fue tomada | *Authentication → Users*: cierra sus sesiones y pídele cambiar la contraseña. Revoca sus claves de captura |
| Un error de RLS expuso datos | Corrige la regla (migración), vuelve a correr `bash supabase/tests/correr.sh` y despliega. Si no puedes corregirlo ya, **pausa lo que lo expone** |
| El proveedor te avisa de una brecha | Pide el detalle por escrito (qué datos, cuándo, cuántas personas) y sigue desde la sección 3 |

**No borres evidencia**: registros de Supabase, correos, capturas. Pueden hacer falta.

## 3. Evaluar (el mismo día)

Anota en `docs/legal/privado/incidentes/AAAA-MM-DD-<alias>.md` (esa carpeta **no se sube a Git**):

1. **Cuándo ocurrió y cuándo te enteraste** (la hora de enterarte inicia el plazo).
2. **Qué datos** se vieron afectados (usa el [registro de tratamiento](registro-tratamiento-datos.md)): ¿solo correos? ¿datos financieros? ¿ubicación?
3. **Cuántas personas**, y quiénes (la consulta `public.exportar_datos_persona` ayuda a saber qué había de cada una).
4. **Qué tipo de incidente es**: de confidencialidad (alguien vio lo que no debía), de integridad (se cambiaron datos) o de disponibilidad (se perdieron o dejaron de estar), o varios.
5. **¿Hay riesgo para los derechos de las personas?** (fraude, suplantación, exposición de sus finanzas o su ubicación). La ley exime de notificar a las personas solo si **es improbable que haya riesgo**: si dudas, notifica.

## 4. Notificar (dentro de los 5 días)

1. **A la Superintendencia de Protección de Datos Personales**, por su sistema digital (SISPDP, según la norma técnica). Lleva a mano lo de la sección 3, las medidas que tomaste y quién es el contacto.
2. **A las personas afectadas**, por el correo de su cuenta, si hay riesgo. Debe decir, en lenguaje claro: **qué pasó, qué datos, qué riesgo hay, qué hiciste y qué puede hacer cada una** (por ejemplo, cambiar su contraseña y revisar sus movimientos bancarios).
3. **Si el incidente es de un proveedor**: él te lo notifica a ti, y tú sigues siendo quien notifica a la Superintendencia y a las personas.

Plantilla para las personas:

> Asunto: Aviso de seguridad de fintrack
>
> Hola. El [fecha] detectamos que [qué pasó, en una frase simple]. Afectó [qué datos] de [tu cuenta / algunas cuentas, incluida la tuya]. [Qué riesgo hay y qué no se vio: por ejemplo, tus contraseñas no se vieron porque se guardan cifradas.]
>
> Ya hicimos esto: [medidas]. Te recomendamos: [cambiar tu contraseña; revisar tus movimientos en tu banco; …].
>
> Si tienes preguntas, escríbenos a [correo de contacto]. También puedes acudir a la Superintendencia de Protección de Datos Personales.

## 5. Después

1. **Causa raíz**: qué falló y por qué no se vio antes.
2. **Arreglo permanente con prueba**: un cambio de código o de base con una prueba que falle si vuelve a pasar (como se hace con las pruebas de `supabase/tests/`).
3. **Actualiza** la política de privacidad y el [registro de tratamiento](registro-tratamiento-datos.md) si cambió qué datos se guardan o con quién.
4. **Cierra la nota** del incidente con las fechas de cada paso: es la evidencia de que cumpliste los plazos.

## 6. Prevención que ya existe

- El verificador de publicación frena una clave `service_role` o secreta dentro de la app (`apps/mobile/test/entornoPublicacion.test.mjs`).
- `.gitignore` bloquea `.env` y todas sus variantes, claves privadas, credenciales de Google, volcados de la base y la carpeta privada de datos personales.
- RLS en todas las tablas, probada contra ataques entre usuarios (`supabase/tests/seguridad_y_presupuestos.sql`).
- Las claves de captura de Apple Pay no se guardan: solo su huella; tienen límite de avisos por hora y día, y se pueden revocar.
- Ante una sospecha de filtración en Git: **rota la clave primero**, después limpia el historial; borrar el archivo no basta.
