# Informe · Fase 2: registrar a mano con billetera y ubicación

16 de octubre de 2026 · carpeta `App_registros_gastos` · rama `Rama-Logica` · plan: `docs/plan-billeteras-y-ubicacion.docx`

**Resultado: la lógica está terminada y probada; faltan las pantallas.** Las pantallas son de los agentes de interfaz (Agente 3), con instrucciones exactas en `docs/contrato-logica-core.md`, sección "Fase 2". Mientras no existan, no se ve nada nuevo en la app. No se subió nada a GitHub.

## Qué se hizo

- **Ubicación del dispositivo con reglas fijas** (`packages/core/src/lib/ubicacionDispositivo.ts`):
  - Apagada por defecto, y la preferencia es de cada usuario: otra persona que inicie sesión en el mismo teléfono no hereda tu permiso.
  - El permiso se pide solo al encender la opción. Si lo niegas, la opción queda apagada.
  - Al guardar un gasto nunca se pide permiso ni salta un error. El GPS tiene como mucho 8 segundos; si tarda, falla o da un dato imposible, el gasto se guarda sin ubicación, con un aviso claro.
- **Ayudantes por plataforma**:
  - `apps/mobile/lib/ubicacion.ts`: teléfono y versión web, con `expo-location`. Usa la última posición si tiene menos de 2 minutos, así es instantáneo.
  - `apps/desktop/src/lib/ubicacion.ts`: web de escritorio, con la ubicación del navegador.
- **«Abrir en Mapas»** sin clave de API: en Android abre la app de mapas que elijas, en iPhone Apple Maps y en la web Google Maps. Solo lleva las coordenadas.
- **Migración de borrar ubicaciones** (`20261016130000_borrar_ubicaciones.sql`): «Borrar todas mis ubicaciones» en un solo paso. Quita la ubicación y el lugar de todos tus gastos, la ubicación de los avisos de la bandeja, y borra tus lugares. Los gastos y los saldos no cambian.
- **App del teléfono 1.1.0**:
  - Se agregó `expo-location` y se subió la versión, como pide `docs/actualizaciones.md` para librerías nativas. Así las APK 1.0.0 no reciben por actualización código que no podrían ejecutar.
  - El permiso de ubicación en segundo plano está **bloqueado** en `app.json`.
  - Los textos del permiso están en español.
- **Privacidad**:
  - `privacidad.html` explica qué ubicación se guarda, cuándo y cómo borrarla.
  - La guía de Google Play (`docs/publicacion-produccion.md`) declara "Ubicación precisa, opcional" desde la 1.1.0.

## Cómo se comprobó

| Verificación | Resultado |
|---|---|
| Pruebas de base de datos (Postgres desechable, 25 migraciones desde cero) | **139 de 139** (9 nuevas, `supabase/tests/borrar_ubicaciones.sql`) |
| Pruebas de lógica (`pnpm --filter core test`) | **113 de 113** (8 nuevas, `packages/core/test/ubicacionDispositivo.test.ts`) |
| Pruebas de la web y del teléfono | 3 de 3 y 7 de 7 |
| TypeScript en core, web y teléfono | Sin errores |
| Paquetes del teléfono (`expo export -p android` y `-p web`) | Compilan (Android 3,65 MB) |
| Permisos nativos (`expo config --type introspect`) | Android: ubicación aproximada y precisa; **segundo plano eliminado**. iPhone: textos en español |

Las pruebas nuevas cubren:

- **Base de datos:** el borrado limpia gastos, avisos y lugares, y dice cuántos. Los gastos siguen, con el mismo total. Los saldos no cambian, tampoco los de un diferido. El aviso pendiente sigue pendiente. Repetirlo no hace nada. Después se puede volver a guardar ubicación. No toca a otra persona. Sin sesión o sin usuario no funciona.
- **Lógica:** apagada sin tocar el GPS; encender pide permiso y solo queda encendida si se concede; la preferencia va por usuario; un valor raro cuenta como apagada; con permiso, la posición sale redondeada; los casos sin permiso, GPS lento (corta a tiempo), dato imposible y error; los enlaces de mapas de cada plataforma; y el borrado.

## Errores encontrados y corregidos

- Core no compilaba con `setTimeout`, porque no incluye los tipos del navegador ni de Node. Se resolvió con el mismo patrón que ya usa `fetchConTimeout`.
- En iPhone, el plugin de `expo-location` agregaba solo un texto en inglés para la ubicación "siempre", aunque la app nunca la pide. Se cambió por un texto en español que dice que nunca se usa en segundo plano.

## Lo que falta o no está comprobado

- **Las pantallas** (Agente 3): el selector «Pagado con», guardar con ubicación, la etiqueta y «Abrir en Mapas» en el detalle, y la pantalla «Ubicación de mis pagos» con su interruptor y el borrado. Sin ellas no se puede probar en tu teléfono.
- **Los ayudantes de ubicación todavía no los usa ninguna pantalla.** TypeScript los revisó, pero la compilación no los incluye hasta que una pantalla los importe. Se comprueban con la primera pantalla.
- **APK 1.1.0**: hay que compilarla (`build:apk`) cuando estén las pantallas.
- **Tu Supabase web no tiene todavía ninguna de las dos migraciones** (lo comprobé por REST: falta la tabla `lugares`). Aplícalas en este orden, pegando cada archivo entero en el SQL Editor; cada una debe terminar con `aplicada = sí`:
  1. `supabase/para-supabase-web/16-10-2026 4AM/1 - gastos, lugares, transacciones_detectadas.sql`
  2. `supabase/para-supabase-web/16-10-2026 4AM/2 - gastos, lugares, transacciones_detectadas (borrar ubicaciones).sql`
- La política de privacidad todavía tiene datos por completar de antes (región de Supabase, correo de contacto, plazos).

## Seguridad

- **Consentimiento (LOPDP):** la ubicación está apagada por defecto, se pide permiso solo al activarla, la preferencia es de cada usuario y se puede borrar toda sin borrar la cuenta.
- **Permiso mínimo:** solo «mientras usas la app». El permiso en segundo plano está bloqueado en el manifiesto de Android, comprobado.
- **Tiempos de espera:** 8 s como máximo para el GPS, así el formulario nunca se queda colgado. Las llamadas a la base siguen con el tiempo máximo del cliente (`crearFetchConTimeout`).
- **Datos del GPS:** se validan y se redondean antes de enviarlos. Un valor imposible no se guarda.
- **El borrado** es `security invoker` (RLS limita a lo propio) y además filtra por `auth.uid()`. Exige sesión y `anon` no lo puede ejecutar (pruebas V08 y V09). Es atómico: o se borra todo, o nada.
- **Sin SQL dinámico.**
- **Terceros:** «Abrir en Mapas» envía solo las coordenadas redondeadas, y solo cuando lo tocas. En Android las abre la app de mapas que tengas.

## Siguiente

Cuando el Agente 3 haga las pantallas, se prueba en tu teléfono (APK 1.1.0). Después siguen la Fase 3 (captura de Apple Pay con el atajo del iPhone) y la Fase 5 (resumen por lugar), que se pueden hacer en paralelo.
