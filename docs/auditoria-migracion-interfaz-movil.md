# Auditoría de supervisión: migración de interfaz móvil

**Fecha:** 2026-10-13  
**Estado:** auditoría en curso; el veredicto final queda reservado hasta completar las dos fases.  
**Alcance vigente (orden solicitado):** primero supervisar la adaptación web en `apps/desktop`; después revisar la migración móvil de `apps/mobile` usando el escritorio como referencia Zallox. No se modifica código de `apps/mobile`, `apps/desktop`, `packages/core` ni `supabase`.

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

Al comenzar ya existían cambios locales en `apps/desktop`, `packages/core`, `README.md` y archivos no rastreados en `docs/`; son trabajo ajeno al alcance de esta auditoría y no deben revertirse ni reescribirse. Los agentes 2 y 3 son dueños de sus archivos móviles asignados. La auditoría se limita a este documento y a lectura/revisión. Revisaré en particular que el contrato UI de Agente 2 se publique antes de que Agente 3 dependa de APIs nuevas y que no haya cruces en archivos compartidos.

## Seguimiento provisional (sin veredicto)

- Al inicio de la supervisión, el escritorio ya tenía cambios locales amplios anteriores en `apps/desktop` y `packages/core`; por eso el diff final debe distinguirlos de los cambios de migración.
- Antes del nuevo orden, los agentes habían iniciado en paralelo con móvil. Agente 2 agregó provisionalmente `docs/contrato-ui-movil.md`, amplió `apps/mobile/lib/theme.ts` y añadió una primitiva `apps/mobile/components/Motion.tsx`; instaló `expo-font` y comenzó a incorporar fuentes. Agente 3 inició cambios en las pantallas. Estos cambios son parciales y no representan la fase móvil terminada.
- El contrato propone `useTheme`, `BlurFade`, `AnimatedBackground`, `AnimatedList` virtualizada y reserva de espacio para el dock. La revisión posterior comprobará que las implementaciones coincidan con el contrato y que no haya pantallas que se queden con estilos claros globales en modo oscuro.
- Se observó un intento de transformación automática de estilos en varias pantallas y una ejecución de `tsc --noEmit` que terminó con error. No se han aislado aún los diagnósticos ni se ha revisado el resultado; será prioridad de integración. Este supervisor no ejecutará pruebas ni validaciones adicionales.
- Tras esa ejecución, el Agente 3 informó que TypeScript pasó con el estado móvil guardado. Confirmar que ese resultado cubre el conjunto de rutas y no se invalidó después por la fase web o por integraciones posteriores.
- La supervisión observó un archivo temporal de transformación en la raíz del repo (`.mobile-ui-transform.cjs`) en el registro del agente; comprobar si se retiró al cerrar su uso y registrarlo si permanece.
- En el cambio de fase, `apps/desktop/src/components/` ya contiene implementaciones nuevas de `AnimatedBackground`, `AnimatedList`, `BlurFade`, `Dock`, `RippleButton` y `ThemeToggler`; el contrato está en `docs/contrato-ui-web.md`. La inspección y el contraste con el shell/vistas siguen pendientes.
- Aparecieron cambios posteriores en `packages/core/package.json` y `packages/core/test/` (pruebas para lógica de deudas/presupuestos/score). No estaban en el `git status` inicial. No atribuirlos a los agentes sin evidencia; investigar su origen al reconciliar el diff, pues quedan fuera del alcance visual y la lógica financiera debe mantenerse.
- No se ha inspeccionado ninguna pantalla en simulador o dispositivo todavía. Los agentes continúan activos. No emitir hallazgos finales hasta el cierre WEB y MÓVIL.

## Hallazgos y prioridades

Pendiente de las entregas de agentes. Al actualizar, clasificaré cada hallazgo como **P0** (bloquea uso/integración o altera operaciones), **P1** (incumple un criterio central de migración/accesibilidad) o **P2** (acabado o evidencia incompleta), con ruta concreta y recomendación breve.

## Revisión de integración

Pendiente. No se han ejecutado pruebas ni validaciones de compilación; esta supervisión prioriza la lectura solicitada y no añadirá comandos de pruebas sin instrucción.
