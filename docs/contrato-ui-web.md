# Contrato UI web — fase 1A

`components/Dock.tsx` exporta default `Dock`. Props: `items: { id: string; etiqueta: string; icono: ReactNode; badge?: number }[]`, `value: string`, `onChange: (id: string) => void`, `moreItems?:` mismo array. Pasar Resumen, Ingresos, Gastos y Tarjetas en items; el componente agrega Más cuando moreItems tiene entradas. Más conserva Cuentas, Deudas, Recordatorios y Categorías; selecciona su estado activo si value está en moreItems. La isla expande un panel con esas rutas y ThemeToggler. Integrar una vez fuera de las vistas. La clase ui-with-dock reserva espacio inferior en el contenido.

`components/ThemeToggler.tsx`: control de tema independiente persistente en localStorage; configura data-theme en documentElement. Dock lo incluye; puede montarse en la cabecera si se conserva sidebar en monitores grandes. `useInterfazMotion` inicializa el tema guardado al arrancar, incluso durante carga.

`components/AnimatedBackground.tsx`: default, props value, children, className?. Los hijos seleccionables deben llevar data-selection-id igual al value. Mide y anima un único fondo compartido; apto para chips, segmentos y navegación. No crea roles ni maneja selección: los botones conservan su semántica.

`components/BlurFade.tsx`: children, delay? (ms), className?. Entrada breve con CSS y reduce-motion. No envolver todas las tarjetas, ya tienen animación.

`components/RippleButton.tsx`: mismas props nativas de button, className?. Mantiene .btn/.btn-primary y ripple delegado por useInterfazMotion, sin retrasar el clic.

`components/AnimatedList.tsx`: items genéricos, getKey, renderItem, className?. Aparición/retiro de una lista futura, sin datos inventados. Usar para listas cortas de avisos, no tablas financieras largas.

No se editan App ni views por parte de Agente 2. Colores Zallox originales se conservan en claro; oscuro definido vía variables. No dependencias Svelte.
