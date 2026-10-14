# Prompt de ejecución por fases: web → teléfono

**Orden vigente del usuario:** aplicar primero los cambios a la interfaz web; después implementarlos en la app de teléfono. Dos agentes Sol desarrollan por archivos asignados y el supervisor Luna revisa todo al final.

---

Quiero aplicar **toda la nueva interfaz** primero en `apps/desktop` (React + Vite + Tauri) y, una vez integrada, adaptarla a `apps/mobile` (Expo + React Native). Sigue `docs/plan-migracion-interfaz-movil.md` de principio a fin y trabaja dentro de este proyecto. La web fija los patrones visuales y de interacción; el resultado para teléfono debe ser una adaptación táctil completa.

## Referencia de estilo

La referencia principal de «Zallox» es la captura adjunta por el usuario: fondo blanco, títulos negros, texto secundario gris, tipografía sans serif, líneas de borde delgadas, tarjetas blancas con esquinas redondeadas, sombra mínima y una navegación dock flotante. Usa esa captura por encima de cualquier estilo antiguo que aparezca en el repositorio. Conserva el contenido y las acciones financieras; lleva ese lenguaje visual a todas las vistas web y móviles, con composición táctil propia en el teléfono.

Base cromática: fondo/superficie `#ffffff`, superficie secundaria `#f5f5f5`, borde `#dedede`, texto `#111111`, texto secundario `#62666c` y negro como acento principal. Conserva color semántico para estados de éxito, aviso y peligro y los colores propios de bancos/categorías cuando identifican contenido. IBM Plex Sans va en títulos y lectura; IBM Plex Mono queda donde ayude a comparar importes. El tema claro debe iniciar por defecto; el oscuro queda opcional y usa neutros, sin regresar a índigo/lavanda.

## Referencias de movimiento y su lugar en la interfaz

1. **Animated Background:** [documentación](https://sv-animations.vercel.app/magic/docs/components/animated-background). Es un fondo compartido que se mueve entre elementos seleccionados. Adáptalo a la pestaña activa del dock y a selectores de período/chips. En teléfono, la selección ocurre al tocar, sin `hover`.
2. **Dock:** [documentación](https://sv-animations.vercel.app/magic/docs/components/dock). Inspírate en su forma y transición para una **isla dinámica dentro de la app**: dock flotante inferior con las cinco pestañas existentes, estado activo claro y accesos táctiles cómodos. Adapta la ampliación de iconos al toque. La isla debe respetar áreas seguras, teclado y contenido desplazable.
3. **Animated Theme Toggler:** [documentación](https://sv-animations.vercel.app/magic/docs/components/animated-theme-toggler); comando original de referencia: `pnpm dlx shadcn-svelte@latest add https://sv-animations.vercel.app/r/animated-theme-toggler.json`. Coloca el control de cambio de tema/color en el estado expandido de la isla. Implementa tema claro basado en Zallox y un oscuro coherente, con transición circular o equivalente nativo, iconografía legible y preferencia persistente.
4. **Blur Fade:** [documentación](https://sv-animations.vercel.app/magic/docs/components/blur-fade). Úsalo para entrada breve de títulos, tarjetas de resumen, paneles y estados vacíos. Mantén la sensación de desenfoque/desvanecimiento, usando una alternativa nativa de opacidad y desplazamiento cuando el blur real perjudique el rendimiento.
5. **Ripple Button:** [documentación](https://sv-animations.vercel.app/magic/docs/components/ripple-button); comando original de referencia: `pnpm dlx shadcn-svelte@latest add https://sv-animations.vercel.app/r/ripple-button.json`. Lleva el feedback de onda a `Boton` y acciones principales, respetando estados de carga, deshabilitado y peligro.
6. **Animated List para futuras notificaciones:** [documentación](https://sv-animations.vercel.app/magic/docs/components/animated-list); comando original de referencia: `pnpm dlx shadcn-svelte@latest add https://sv-animations.vercel.app/r/animated-list.json`. Define la presentación de avisos que entran, cambian o desaparecen. Prepara la especificación visual o un componente desacoplado; todavía no existe un sistema de notificaciones que deba inventarse durante esta migración.

Los comandos citados instalan **Svelte** y no se deben ejecutar en este proyecto React/React Native. Reproduce su comportamiento primero con React/CSS en web y luego con componentes compatibles con la versión de Expo/React Native del proyecto. Consulta las páginas originales antes de implementarlos para confirmar detalles vigentes.

## Fase 1 — web: reparto entre los dos desarrolladores

- **Agente 2 (Sol), sistema visual:** trabaja en `apps/desktop/src/index.css`, `apps/desktop/src/components/**` y primitivas visuales de `apps/desktop/src/lib/`. Implementa los patrones compartidos, animaciones, estados de tema y componentes reutilizables. Expone sus APIs en `docs/contrato-ui-web.md` o documento equivalente. Preserva los cambios locales previos del escritorio.
- **Agente 3 (Sol), composición y vistas:** trabaja en `apps/desktop/src/App.tsx` y `apps/desktop/src/views/**`. Integra los componentes del Agente 2 en la navegación y en cada módulo sin cambiar sus operaciones. Registra necesidades de API para coordinarse y no edita CSS/componentes del Agente 2.
- Antes de comenzar móvil, ambos comprueban que la web está integrada, que todas las vistas funcionan y que las referencias visuales tienen una aplicación coherente. Animated List puede quedar preparado para notificaciones futuras, sin datos ni servicio ficticios.

## Fase 2 — teléfono: reparto entre los dos desarrolladores

- **Agente 2 (Sol), base móvil:** trabaja en `apps/mobile/lib/theme.ts`, `apps/mobile/components/**`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/_layout.tsx` y configuración/recursos visuales móviles indispensables. Adapta tema, tipografía, primitivas, componentes, dock/isla y selector de tema. Conserva props y exportaciones existentes y documenta cualquier API nueva.
- **Agente 3 (Sol), 18 pantallas:** trabaja en archivos de pantallas bajo `apps/mobile/app/**`, excepto los dos `_layout.tsx` del Agente 2. Integra la base móvil en todos los flujos y conserva el comportamiento existente.

### Alcance móvil

- Migra las 18 pantallas: login, registro, conectar correo; Resumen, Ingresos, Gastos, Tarjetas, Más; Cuentas, detalle de cuenta, detalle de tarjeta, Deudas, Recordatorios, Categorías; nuevo gasto, nuevo ingreso, Correo y Bandeja de revisión.
- Actualiza los 11 componentes compartidos y centraliza los tokens visuales de móvil. Elimina los colores literales antiguos de las pantallas, excepto los acentos de banco/categoría que tienen significado.
- Sustituye la barra de pestañas estándar por el dock/isla flotante, sin perder ninguna ruta. Haz que el control de tema sea accesible desde la isla expandida.
- Asegura que formularios, modales, cabeceras, tarjetas, gráficos, listados y estados de carga/error/vacío sigan una misma jerarquía visual.
- Respeta la preferencia del sistema de reducir movimiento, zonas táctiles cómodas, lectores de pantalla, contraste, áreas seguras y teclado. Las animaciones deben responder rápido y mantenerse fluidas en teléfonos reales.
- Mantén intactos los cálculos, repositorios, modelos, esquema de Supabase y operaciones financieras. Conserva autenticación, correo y bandeja en producción; el acceso visual sin login solo se permite en desarrollo para revisar la interfaz. Puedes guardar localmente la preferencia visual del tema.
- Interpreta «isla dinámica» como interfaz **dentro de la app**. La Dynamic Island del sistema iOS y un servicio real de notificaciones requieren un alcance diferente.

## Fase 3 — supervisor Luna y entrega

1. Lee el estado actual del repo y preserva todos los cambios existentes del usuario.
2. Completa e integra web antes de continuar con teléfono. Los desarrolladores revisan sus cambios al cerrar cada fase.
3. Implementa los efectos nativos solo donde ayuden a entender selección, navegación o estado. Mantén el comportamiento simple si una traducción literal de Svelte afecta la fluidez.
4. Revisa la web y después la app en Android e iOS, en pantallas pequeñas y grandes, con tema claro/oscuro y movimiento reducido. Comprueba las rutas y acciones existentes.
5. Después de que ambos desarrolladores terminen web y móvil, el **Agente 1 (Luna)** audita cobertura, integración, accesibilidad, conflictos de archivos y preservación de lógica. Entrega hallazgos concretos con prioridades.
6. Entrega un resumen de archivos modificados, lo que quedó cubierto, cómo se revisó y cualquier limitación concreta. Deja claramente separado el diseño de futuras notificaciones del sistema de notificaciones que aún no existe.

Mantén todo el trabajo dentro de este proyecto.
