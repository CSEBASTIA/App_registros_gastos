# Piloto cerrado

Objetivo: comprobar con **5 a 10 personas de un solo segmento**, durante **4 semanas**, si la app logra que registren sus gastos cada semana y confíen en sus saldos. Sin tiendas, sin compilaciones nativas y sin actualizar el SDK: se usa la **versión web de la app móvil**, abierta desde el navegador del celular y añadida a la pantalla de inicio.

> Hipótesis local a probar primero: personas que pagan con **tarjeta de crédito y difieren compras** (la app convierte cada diferido en deuda y controla el cupo). Contrastarla en las entrevistas con las otras: ingresos variables, estudiantes, hogares.

## 1. Lo que necesitas crear (cuentas tuyas)

| Cuenta | Para qué | Costo |
|---|---|---|
| [supabase.com](https://supabase.com) | Base de datos en la nube | Plan gratuito |
| [netlify.com](https://netlify.com) o [vercel.com](https://vercel.com) | Publicar la versión web | Plan gratuito |

Las contraseñas las escribes tú cuando el CLI las pida. Nunca pongas la clave `service_role` en la app ni en un `.env` de la app.

## 2. Base de datos en la nube

1. Crear el proyecto en supabase.com. Elegir la región más cercana (por ejemplo São Paulo). Los datos quedarán fuera de Ecuador: mencionarlo en el aviso de privacidad (LOPDP, transferencia internacional).
2. Aplicar las 16 migraciones desde la raíz del repo:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

3. **Cargar las categorías base**: `db push` no ejecuta `supabase/seed.sql`. Pegar ese archivo en el SQL Editor del proyecto y correrlo (crea Comida, Transporte, Ocio y Servicios).
4. Comprobar en el SQL Editor: `select version, name from supabase_migrations.schema_migrations order by version;` → 16 filas.
5. Actualizar la tabla **Estado de despliegue** del README.

### Autenticación

- *Authentication → URL Configuration*: **Site URL** = la dirección donde publiques la app (paso 3). Es a donde lleva el enlace de confirmación.
- Dejar activada la **confirmación de correo**. El servicio de correo incluido en el plan gratuito tiene un límite bajo de envíos por hora: alcanza si los participantes se registran de forma escalonada; si no, configurar un SMTP propio.
- Traducir al español las plantillas de correo (*Authentication → Email Templates*).

## 3. Publicar la versión web

1. Crear `apps/mobile/.env.production` (no se sube a git) con los datos del proyecto en la nube:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key del proyecto>
   ```

   No incluir `EXPO_PUBLIC_SIN_LOGIN` (de todos modos solo actúa en desarrollo).
2. Generar la versión web:

   ```bash
   cd apps/mobile
   npx expo export -p web
   ```

   El resultado queda en `apps/mobile/dist/`.
3. Es una app de una sola página: todas las rutas deben servir `index.html`. En Netlify, crear `apps/mobile/dist/_redirects` con la línea `/* /index.html 200` antes de subir.
4. Subir la carpeta `dist` (Netlify: arrastrarla en *Sites → Add new site → Deploy manually*).
5. En el celular: abrir la dirección → menú del navegador → **Añadir a pantalla de inicio**.

Cada cambio en la app requiere repetir los pasos 2 a 4.

## 4. Antes de invitar a nadie: criterios de éxito

Definirlos **antes** de empezar, a partir de lo que el producto necesita, no de cifras ajenas. Las consultas están en `supabase/metricas/metricas_piloto.sql`.

| Pregunta | Métrica (consulta) | Umbral para decir "funciona" |
|---|---|---|
| ¿La gente entiende cómo empezar? | % que registra su primer movimiento en 24 h (1) | ____ % |
| ¿Lo vuelven a usar? | % de cada cohorte que anota algo en la semana 1, 2 y 4 (3) | ____ % en la semana 4 |
| ¿Se vuelve un hábito? | Días activos por persona por semana (2) | ____ días |
| ¿Confían en los saldos? | Reportes de "el saldo no cuadra" en el registro de soporte | ____ reportes |
| ¿Qué función los retiene? | % que usa tarjetas, diferidos y presupuestos (4) | — (para decidir qué priorizar) |

Regla de decisión sugerida: si la retención de la semana 4 no llega al umbral, **no** se agregan funciones nuevas; primero se entrevista a quienes dejaron de usarla.

## 5. Guía de entrevista inicial (30 min, antes de dar acceso)

1. ¿Cómo llevas hoy la cuenta de tus gastos? Muéstrame la última vez que lo hiciste.
2. ¿Qué parte pagas en efectivo, con débito y con tarjeta de crédito?
3. ¿Difieres compras? ¿Cómo sabes cuánto te queda de cupo y cuánto debes cada mes?
4. ¿Qué te hizo dejar de anotar gastos alguna vez?
5. ¿Qué tendría que pasar para que abras una app así cada semana?
6. ¿Qué datos **no** pondrías en una app (correo, cuentas, montos)?
7. Si te ahorrara un problema concreto, ¿pagarías? ¿Por cuál, exactamente? *(solo escuchar; no ofrecer precio)*

## 6. Entrevista de salida (al terminar las 4 semanas)

1. ¿Qué usaste más y qué no usaste nunca? ¿Por qué?
2. ¿Hubo un momento en que dejaste de usarla? ¿Qué pasó?
3. ¿Alguna vez el saldo no coincidió con tu banco?
4. Presupuestos: ¿qué entiendes por el porcentaje, los colores y el "restante"? *(validar el punto 10 de la priorización)*
5. ¿Seguirías usándola? ¿Se la recomendarías a alguien? ¿A quién?

## 7. Registro de soporte

Anotar cada consulta o problema, aunque se resuelva en el momento:

| Fecha | Participante (alias) | Qué pasó | Tipo (saldo / uso / error / privacidad) | Resuelto |
|---|---|---|---|---|

## 8. Privacidad del piloto

- Avisar por escrito, antes de empezar, qué datos se guardan, dónde y por cuánto tiempo, y que se pueden borrar en cualquier momento.
- El correo (beta) es opcional: no pedir a los participantes que lo conecten.
- Al terminar, borrar los datos de quienes lo pidan (y de todos, si así se acordó).
