# Contrato UI web — fase 1A

`components/Dock.tsx` exporta default `Dock`. Props: `items: { id: string; etiqueta: string; icono: ReactNode; badge?: number }[]`, `value: string`, `onChange: (id: string) => void`, `moreItems?:` mismo array. Pasar Resumen, Ingresos, Gastos y Tarjetas en items; el componente agrega Más cuando moreItems tiene entradas. Más conserva Cuentas, Deudas, Recordatorios y Categorías; selecciona su estado activo si value está en moreItems. La isla expande un panel con esas rutas y ThemeToggler. Integrar una vez fuera de las vistas. La clase ui-with-dock reserva espacio inferior en el contenido.

`components/ThemeToggler.tsx`: control de tema persistente en localStorage; configura data-theme en documentElement. Se abre desde el panel de la isla. `useInterfazMotion` inicializa el tema guardado al arrancar, incluso durante carga.

`components/AnimatedBackground.tsx`: default, props value, children, className?. Los hijos seleccionables deben llevar data-selection-id igual al value. Mide y anima un único fondo compartido; apto para chips, segmentos y navegación. No crea roles ni maneja selección: los botones conservan su semántica.

`components/BlurFade.tsx`: children, delay? (ms), className?. Entrada breve con CSS y reduce-motion. No envolver todas las tarjetas, ya tienen animación.

`components/RippleButton.tsx`: mismas props nativas de button, className?. Mantiene .btn/.btn-primary y ripple delegado por useInterfazMotion, sin retrasar el clic.

`components/AnimatedList.tsx`: items genéricos, getKey, renderItem, className?. Aparición/retiro de una lista futura, sin datos inventados. Usar para listas cortas de avisos, no tablas financieras largas.

La interfaz conserva el contenido y las acciones financieras existentes. Estilo visual inspirado en Zallox; tema oscuro opcional definido vía variables. No dependencias Svelte.

Validación de fase 1A: build Vite y TypeScript aprobados. Navegador local: isla expandida, foco inicial del panel, claro/oscuro y persistencia tras recargar. Se corrigió contraste del saldo oscuro mediante un fondo de marca estable. La API de desarrollo respondió `Failed to fetch`; no se hicieron transacciones. La revisión responsive completa queda pendiente del supervisor.

Animated List excluye las filas salientes de interacción y foco con `inert` durante su transición. No se integra una fuente de notificaciones.

Navegación: el dock/isla permanece visible en todos los anchos y la barra lateral queda oculta. El espacio inferior se reserva para que el contenido no quede detrás del dock.

## Revisión visual en ejecución (14 de octubre de 2026)

La inspección anterior del navegador se hizo a 1024×768, 881×740, 880×740, 390×844 y 320×640. Esa revisión corresponde al diseño previo y no valida la actualización Zallox.

Defectos corregidos durante la revisión: pestañas semanales que ensanchaban el documento, acciones de Nuevo gasto que comprimían el título, cabecera con selector de mes que desbordaba a 320 px y vista previa bancaria con nombre y saldo superpuestos. Los campos inferiores del formulario de gastos y el botón Agregar se alcanzan mediante desplazamiento. No se envió ningún formulario.

Límite: la instancia mostró `Sin sesión` y `TypeError: Failed to fetch`; no se pudieron comprobar registros con datos, validación del backend ni acciones financieras. Las comprobaciones visuales son del navegador integrado y no sustituyen pruebas en dispositivos móviles reales.

## Actualización visual Zallox

La web usa el estilo de la captura de referencia: lienzo blanco, tipografía sans serif, texto negro y gris, bordes grises finos, tarjetas sin sombra marcada y navegación dock centrada abajo. El tema claro se aplica por defecto; el selector conserva el tema oscuro opcional y su transición circular. En desarrollo, cuando no existe sesión, se muestra la interfaz vacía de datos sin esperar una consulta de Supabase. Esta actualización está pendiente de revisión visual en navegador.
