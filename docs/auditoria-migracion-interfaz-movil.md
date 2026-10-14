# Auditoría de supervisión: migración de interfaz móvil

**Fecha:** 2026-10-14
**Estado:** revisión final actualizada tras cerrar los ajustes responsive y de Correo.
**Alcance vigente (orden solicitado):** primero supervisar la adaptación web en `apps/desktop`; después revisar la migración móvil de `apps/mobile` usando el escritorio como referencia Zallox. No se modifica código de `apps/mobile`, `apps/desktop`, `packages/core` ni `supabase`.

**Nota de vigencia:** este informe registra la auditoría anterior a la nueva dirección visual solicitada por el usuario. La captura de Zallox compartida después es la fuente de verdad para color, tipografía y composición; las modificaciones posteriores de web y móvil todavía requieren una revisión supervisora nueva.

## Fases y puertas de revisión

1. **WEB:** Agente 2 implementa sistema visual, componentes y motion; Agente 3 integra shell y `views/**`. Revisar que cubran las referencias web pertinentes, que el estilo se mantenga consistente y que cálculos/consultas/operaciones existentes no cambien. La web terminada se convierte en referencia visual observada para móvil.
2. **MÓVIL:** Agente 2 retoma tema, componentes y layouts/dock; Agente 3 migra las 18 pantallas. Revisar contrato de componentes, rutas, accesibilidad, adaptación a teléfono y paridad de comportamiento.
3. **VEREDICTO:** comparar cambios completos de ambas fases, registrar prioridades con rutas y cerrar esta auditoría solo cuando ambos agentes hayan terminado. La instrucción de fase web primero se transmitió a los dos chats.

## Referencias de diseño y límites

Se revisaron `docs/plan-migracion-interfaz-movil.md` y `docs/prompt-migracion-interfaz-movil.md`. El escritorio actual define fondo `#f1f2f7`, superficies `#ffffff`/`#e9ebf3`, borde `#d8dae3`, texto `#14151d`/`#52566b`/`#8a8ea3`, azul `#3552d1`, peligro `#c23b34`, éxito `#157a4b` y aviso `#a5690a`. La identidad tipográfica es Fraunces para encabezados, IBM Plex Sans para lectura e IBM Plex Mono para cifras comparables. `apps/desktop/src/views/Resumen.tsx` da prioridad visual al balance mensual en un panel azul, seguido de estadísticas y tarjetas de lectura.

La migración es de composición móvil, no una copia de la navegación lateral o tablas de escritorio. La isla es un dock interno; las tarjetas conservan identidad bancaria. Los patrones solicitados son Animated Background (selección táctil), Dock, Animated Theme Toggler, Blur Fade y Ripple Button. Animated List solo se documenta para notificaciones futuras: sin servicio, avisos ficticios ni interfaz que afirme tener eventos inexistentes. No ejecutar instaladores `shadcn-svelte`.

## Línea de partida observada

- `apps/mobile/lib/theme.ts` todavía tiene los tokens anteriores (por ejemplo fondo `#f3f4f8`, texto `#1a1c23`, azul `#3b6ff2` y borde `#e5e7eb`), no los tokens actuales del escritorio.
- `apps/mobile/app/(tabs)/_layout.tsx` usa el `Tabs` estándar de Expo Router con cinco rutas. No presenta isla flotante ni selector de tema.
- Hay colores literales en pantallas y componentes, incluso además de los acentos intencionales: formularios de acceso, resumen, deudas, ingresos y selección de categorías requieren clasificación; los colores de banco y categoría con significado pueden seguir siendo locales.
- La app usa Expo 51 / React Native 0.74. Las dependencias existentes incluyen AsyncStorage, LinearGradient, Safe Area Context y StatusBar. Debe verificarse la compatibilidad real de cualquier dependencia nueva y evitar instalar una pila web/Svelte.
- Las rutas presentes corresponden a las 18 vistas esperadas: acceso (login, registro, conectar correo); cinco pestañas (resumen, ingresos, gastos, tarjetas, más); gestión (cuentas, detalle de cuenta, detalle de tarjeta, deudas, recordatorios, categorías); y operación/correo (nuevo gasto, nuevo ingreso, correo, bandeja).
- Los 11 componentes visuales compartidos actuales son `Boton`, `Tarjeta`, `Campo`, `SelectorChips`, `SelectorMes`, `ItemMovimiento`, `GraficoBarras`, `BarraProgreso`, `EstadoVacio`, `ErrorTexto` y `TarjetaVisual`.

## Cobertura de revisión

| Área | Evidencia de cierre que buscaré | Riesgo principal |
| --- | --- | --- |
| Tokens y tipografía | Claro/oscuro centralizados; Fraunces/IBM Plex disponibles o sustitución documentada; cifras legibles | Tipografías declaradas pero no cargadas, tokens obsoletos o contraste desigual |
| 11 componentes | Mantienen props/exportaciones usadas por pantallas; estilos basados en tema; estados accesibles | Rupturas de API entre agentes, tonos literales residuales, controles demasiado pequeños |
| Dock e isla | Cinco rutas accesibles, selección visible/animada al toque, expandido con tema, safe area y teclado | Dock superpuesto al contenido/modales/teclado, una ruta perdida o expansión difícil de descubrir |
| 18 pantallas | Cada flujo conserva navegación, consultas y operaciones; estados carga/error/vacío/selección tratados | Migración solo de pantallas principales, cambios accidentales en lógica financiera o rutas |
| Movimiento | Entrada breve y feedback en controles adecuados; movimiento reducido respetado | Animación bloqueante, dependencias incompatibles o falta de alternativa accesible |
| Tema persistente | Preferencia local, arranque sin flash incoherente, iconos y barra de estado coordinados | AsyncStorage no cargado antes de render o Stack/StatusBar ignorando el tema |
| Formularios y teclado | Inputs utilizables, foco/scroll/submit y acciones modales sin quedar bajo dock | CTA oculto, modal sin área segura, acciones repetidas o teclado tapando el campo activo |
| Notificaciones futuras | Especificación desacoplada para insertar/actualizar/retirar elementos, sin datos inventados | Construcción de un feed/servicio ajeno al alcance |
| Android/iOS | Revisión declarada en tamaños pequeño/grande, claro/oscuro y movimiento reducido | La revisión de tipos no detecta safe areas, clipping, navegación visual o rendimiento |

## Integridad del repositorio y coordinación

Al comenzar ya existían cambios locales en `apps/desktop`, `packages/core`, `README.md` y archivos no rastreados en `docs/`; son trabajo ajeno al alcance y no se revirtieron. La migración visual quedó en el commit `f562126`; el commit separado `fbb3d13` contiene el trabajo de lógica descrito arriba. Los únicos cambios aún sin commit al cierre son la corrección de error de Correo/Resumen, el atributo `inert` de Animated List y los contratos actualizados. Esta auditoría solo modificó su propio documento.

## Informe final de supervisión

- La fase **WEB** integra seis patrones: dock, selector de tema, fondo de selección compartido, entrada Blur Fade, Ripple Button y Animated List desacoplada. `App.tsx` conecta ocho destinos sin quitar las operaciones de las vistas. La paleta clara y tipografía corresponden a los tokens Zallox de escritorio; hay variables de tema oscuro y soporte `prefers-reduced-motion`.
- La fase **MÓVIL** cubre las 18 pantallas, los 11 componentes compartidos y las cinco rutas del dock. `ThemeProvider` ofrece claro/oscuro/sistema persistente, carga Fraunces e IBM Plex desde recursos locales, actualiza StatusBar y observa movimiento reducido. El dock usa áreas seguras, se oculta con el teclado y conserva selección por pulsación. Animated List es virtualizada y no recibe datos de avisos.
- Se verificó estáticamente que las 22 funciones asíncronas de autenticación y operaciones financieras de las pantallas conservan sus cuerpos frente a la versión inicial. Los desarrolladores reportan que TypeScript pasó para escritorio y móvil, el build Vite pasó y Expo exportó para web, Android e iOS. El supervisor no ejecutó esas validaciones.
- Los dos problemas P1 detectados durante la revisión se corrigieron: el fallo al cargar el proveedor ya no deja Correo en el spinner porque muestra el error y sale del estado indefinido; el fallo de consultas de Resumen ya no presenta cifras vacías como diagnóstico financiero, sino error y botón Reintentar.
- Los archivos temporales `.mobile-ui-transform.cjs` se eliminaron. Las fuentes locales incluyen archivos OFL. No se encontraron comandos `shadcn-svelte` ejecutados ni datos/avisos ficticios integrados.
- El commit `fbb3d13 Paso 1 (presupuestos), endurecimiento de seguridad y pruebas` incluye cambios de `packages/core`, `supabase`, correo y pruebas ajenos a esta migración visual. Es trabajo concurrente separado; no forma parte del veredicto visual ni debe revertirse como parte de esta auditoría.

## Hallazgos y prioridades

- **P0 — ninguno observado.** No vi evidencia de rutas eliminadas ni de cambios en las operaciones financieras de la migración visual.
- **P1 — corregido, rama de carga de Correo:** [`apps/mobile/app/correo.tsx`](../apps/mobile/app/correo.tsx#L65) captura el rechazo de `proveedorConectado`, muestra `ErrorTexto` y cambia `conectado` a `null`, por lo que la pantalla deja el estado de carga (`conectado === undefined`).
- **P1 — corregido, error de Resumen:** [`apps/mobile/app/(tabs)/resumen.tsx`](../apps/mobile/app/(tabs)/resumen.tsx#L147) termina la vista financiera en el error, ofrece reintento y no renderiza balance/recomendaciones con arreglos vacíos cuando falló la carga.
- **Cerrado — responsive web:** [`apps/desktop/src/index.css`](../apps/desktop/src/index.css#L2350) oculta el sidebar y muestra el dock hasta 880 px; desde 881 px oculta el dock, elimina su reserva inferior y muestra el selector de tema del sidebar. [`apps/desktop/src/App.tsx`](../apps/desktop/src/App.tsx#L410) monta ese selector junto a la navegación lateral.
- **Cerrado — desconexión de correo:** [`apps/mobile/app/correo.tsx`](../apps/mobile/app/correo.tsx#L91) ahora muestra estado ocupado, ignora intentos repetidos, captura el rechazo y conserva el proveedor conectado si la operación falla. La acción presenta el error con el componente compartido.
- **Limitación externa pendiente:** los bundles no validan tacto, lector de pantalla, teclado, zona segura ni rendimiento en dispositivos. Además el backend de desarrollo respondió `Failed to fetch`; no se verificaron operaciones con datos reales. Mantener este límite al comunicar la entrega.
- **Notificaciones:** `AnimatedList` web/móvil queda desacoplada y sin fuente, de acuerdo con el alcance. No se implementó servicio ni contenido inventado.

## Revisión de integración

**Veredicto:** la migración visual queda integrada y compilable según los informes de los agentes. Los dos P1 de carga/error, el dock duplicado en pantallas anchas y el feedback de desconexión están cerrados. No detecté cambios de lógica financiera en los diffs visuales revisados. **Solo queda la validación externa en teléfonos reales y con backend disponible**; esos comportamientos no se han presentado como probados. Agentes reportan TypeScript web/móvil, build Vite y exportaciones Expo aprobados. El supervisor revisó el código y el diff, no ejecutó pruebas ni compilaciones.

## Actualización de dirección visual posterior

El usuario pidió reemplazar el hero negro y el saludo genérico del Resumen y extender el estilo Zallox a móvil. La nueva base usa blanco, negro y grises, tipografía sans serif y tarjetas con borde fino. Web inicia claro, el dock queda visible en todos los anchos y el Resumen no consulta Supabase sin sesión durante la vista previa. Móvil usa la misma paleta y tipografía y su Resumen omite consultas sin sesión. Estos cambios no están cubiertos por el veredicto ni por las validaciones históricas de arriba.
