# Plan de migración de interfaz: web → teléfono

**Estado:** ejecución iniciada por instrucción del usuario. Orden obligatorio: completar la interfaz web de `apps/desktop`, después adaptarla a `apps/mobile`, y al final hacer la revisión del supervisor.

## Dirección visual y alcance

- **Zallox** se refiere al estilo de la captura que compartió el usuario: lienzo blanco, tipografía sans serif, titulares negros, texto secundario gris, bordes finos, tarjetas blancas redondeadas sin sombra marcada y navegación tipo dock. Esa captura prevalece sobre los tokens antiguos del repositorio. La composición se adapta a cada pantalla.
- Los componentes de **Svelte Animations** aportan los patrones de interacción indicados abajo. Sus comandos `shadcn-svelte` son referencias de diseño; la web actual usa React y la app de teléfono usa Expo/React Native.
- Primero se aplicarán esos patrones a la interfaz web de `apps/desktop`. Esa versión integrada será la referencia de implementación para la app móvil: sus 18 pantallas, navegación y 11 componentes visuales compartidos. Se conservarán rutas, consultas, autenticación y operaciones existentes.
- La «isla dinámica» será un componente **dentro de la app**. La Dynamic Island del sistema iOS es una integración distinta y queda fuera de esta migración visual.
- El diseño y los documentos permanecen en este proyecto. Las notificaciones futuras se especifican visualmente; no se crea en esta fase un servicio de notificaciones ni contenido ficticio visible al usuario.

## Base que ya existe

La nueva base visual usa fondo/superficie `#ffffff`, superficie secundaria `#f5f5f5`, borde `#dedede`, texto `#111111`, texto secundario `#62666c` y negro como color principal. Peligro, éxito y aviso mantienen colores semánticos discretos. IBM Plex Sans se usa en títulos y lectura; IBM Plex Mono queda para cifras comparables. El tema oscuro es opcional; el tema claro se muestra por defecto.

La app móvil ya funciona en Expo/React Native y tiene rutas para acceso, resumen, ingresos, gastos, tarjetas, cuentas, deudas, recordatorios, categorías, correo y bandeja. Su `lib/theme.ts` conserva una paleta anterior; varias pantallas tienen colores literales. La barra de cinco pestañas es estándar, no hay selector de tema ni componentes de animación compartidos. Las tarjetas bancarias ya usan gradientes y colores propios de cada banco, que deben seguir siendo distinguibles.

## Referencias: web primero, teléfono después

La fase web implementará los patrones en React/CSS dentro de `apps/desktop`, manteniendo su estilo Zallox. La tabla define cómo se trasladarán luego a teléfono; los efectos de puntero o `hover` se convertirán en respuestas al tacto.

| Referencia | Aplicación móvil planeada | Adaptación táctil |
| --- | --- | --- |
| [Animated Background](https://sv-animations.vercel.app/magic/docs/components/animated-background) | Fondo compartido que se desplaza entre la pestaña activa del dock, segmentos de período y opciones seleccionadas. | Se activa al tocar; no depende de `hover`. No es un fondo decorativo de toda la pantalla. |
| [Dock](https://sv-animations.vercel.app/magic/docs/components/dock) | Barra flotante inferior en forma de isla con las cinco rutas actuales. Estado activo, etiqueta contextual y espacio para insignias existentes. | Sustituir la ampliación por `hover` por respuesta al toque. Ajustar tamaño y posición a la zona segura inferior. |
| [Animated Theme Toggler](https://sv-animations.vercel.app/magic/docs/components/animated-theme-toggler) | Control en el estado expandido de la isla para cambiar el tema visual. Tema claro basado en Zallox; versión oscura coherente con esa identidad. | Transición de revelado circular o equivalente nativo, persistencia local de preferencia y actualización de iconos/barra de estado. |
| [Blur Fade](https://sv-animations.vercel.app/magic/docs/components/blur-fade) | Entrada breve de títulos, tarjetas de resumen, paneles y estados vacíos. | Limitar el desenfoque real donde afecte el rendimiento; conservar la secuencia de opacidad y desplazamiento. |
| [Ripple Button](https://sv-animations.vercel.app/magic/docs/components/ripple-button) | Feedback de botones primarios y acciones destacadas mediante el componente `Boton`. | Onda desde el punto de contacto o equivalente nativo; estados de pulsado, deshabilitado y carga claros. |
| [Animated List](https://sv-animations.vercel.app/magic/docs/components/animated-list) | Patrón reservado para una futura bandeja de notificaciones: aparición escalonada, inserción y retiro legibles. | Preparar el diseño para listas largas y actualizaciones, sin crear una fuente de notificaciones ahora. |

Los efectos deben respetar la preferencia del sistema de reducir movimiento. Las transiciones cortas no pueden retrasar navegación, lectura ni pulsaciones repetidas.

## Fase 1: aplicar la interfaz a la web

**Agente 2 · base visual y movimiento web.** Es dueño de `apps/desktop/src/index.css`, `apps/desktop/src/components/**` y las primitivas de animación de `apps/desktop/src/lib/`. Implementa los elementos compartidos de Animated Background, Dock/isla, Theme Toggler, Blur Fade y Ripple Button. Define Animated List para la presentación de futuras notificaciones sin crear un sistema de notificaciones. Documenta las interfaces de sus componentes para que el Agente 3 pueda integrarlos.

**Agente 3 · composición y pantallas web.** Es dueño de `apps/desktop/src/App.tsx` y `apps/desktop/src/views/**`. Integra los componentes del Agente 2 en navegación, encabezados, selectores, tarjetas, formularios y estados de cada vista. Mantiene el funcionamiento actual de cada pantalla y registra necesidades de API para evitar editar archivos del Agente 2.

**Cierre de fase web.** Ambos agentes revisan juntos la interfaz resultante y confirman que las vistas y flujos web usan el sistema visual. Solo entonces pasan a la fase móvil. Los cambios locales anteriores del escritorio se conservan e incorporan; nadie los restaura o sobrescribe sin revisarlos.

## Fase 2: adaptar la interfaz completa al teléfono

### 2A. Definir el sistema visual móvil — Agente 2

Extraer los tokens vigentes del escritorio y centralizarlos en `apps/mobile/lib/theme.ts` o su sustituto. Incorporar las familias tipográficas, escalas de texto, importes, espaciado, bordes y superficies. Definir colores para claro y oscuro, manteniendo los colores de banco como acentos de contenido. Preparar especificaciones de teléfono pequeño y grande, con áreas seguras y teclado.

### 2B. Construir la base de interacción — Agente 2

Crear primitivas reutilizables para fondo de selección animado, entrada Blur Fade, botón con ripple y cambio de tema. Actualizar `Boton`, `Tarjeta`, `Campo`, `SelectorChips`, `SelectorMes`, `ItemMovimiento`, `GraficoBarras`, `BarraProgreso`, `EstadoVacio`, `ErrorTexto` y `TarjetaVisual`. Elegir herramientas de animación compatibles con la versión Expo del proyecto durante la implementación; priorizar fluidez en dispositivos reales.

### 2C. Navegación e isla dinámica — Agente 2

Convertir la barra inferior de `(tabs)/_layout.tsx` en un dock flotante para Resumen, Ingresos, Gastos, Tarjetas y Más. El fondo animado marca la ruta activa. La isla puede expandirse para alojar el selector de tema sin reducir el área táctil de las cinco rutas. Conservar la navegación de Stack, las rutas de «Más» y los formularios modales; evitar que el dock cubra el contenido o el teclado.

### 2D. Migrar las 18 pantallas por flujos — Agente 3

1. **Acceso:** login, registro y conectar correo.
2. **Principal:** resumen, ingresos, gastos, tarjetas y Más.
3. **Detalle y gestión:** cuentas, detalle de cuenta, detalle de tarjeta, deudas, recordatorios y categorías.
4. **Formularios y correo:** nuevo gasto, nuevo ingreso, correo y bandeja de revisión.

En cada pantalla aplicar el sistema visual a estado inicial, contenido, carga, error, vacío, selección y acciones. Conservar la semántica financiera y las operaciones que ya realiza.

### 2E. Integrar animaciones y futura notificación — Agentes 2 y 3

Integrar Animated Background en navegación y selectores; Blur Fade en entradas de contenido; Ripple Button en acciones; Dock y Theme Toggler en la isla. Documentar un componente de lista animada y sus estados para notificaciones futuras. Si todavía no existe el flujo de notificaciones, dejarlo listo como especificación o componente desacoplado, sin mostrar avisos inventados.

### 2F. Revisión visual en teléfonos — Agentes 2 y 3

Revisar Android e iOS en pantalla pequeña y grande: zona segura, teclado, contraste, tamaño táctil, desplazamiento, tema claro/oscuro, movimiento reducido y fluidez de las listas. Comprobar todos los caminos de navegación y que los controles siguen ejecutando la misma acción.

## Fase 3: supervisión final — Agente 1 (Luna)

Cuando los Agentes 2 y 3 terminen tanto web como móvil, el Agente 1 revisará la cobertura de las referencias, la coherencia visual entre plataformas, accesibilidad, rutas, interacciones, conflictos de archivos y límites de alcance. Entregará hallazgos concretos con prioridades y rutas de archivo. Su revisión final no sustituye la integración que los desarrolladores deben hacer al cerrar cada fase.

## Criterios de cierre

- La web de `apps/desktop` usa primero los nuevos patrones de interfaz y sus vistas siguen operativas.
- Las 18 pantallas y los 11 componentes compartidos utilizan la identidad visual definida; no quedan colores antiguos o estilos aislados, salvo colores intencionales de banco y categoría.
- El dock flotante permite llegar a las cinco pestañas y deja accesible el selector de tema dentro de la isla.
- Las cinco referencias de interacción solicitadas funcionan en móvil; Animated List queda definido para futuras notificaciones.
- Animaciones y cambios de tema respetan accesibilidad y funcionan sin bloquear contenido ni acciones.
- La lógica de dominio, el backend y los datos permanecen intactos.
- El supervisor emite su análisis final después de ambas fases de desarrollo.
