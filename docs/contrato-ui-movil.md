# Contrato UI móvil
Los 11 componentes existentes conservan exportación default y props. Boton añade loading?: boolean.
- useTheme() desde lib/theme devuelve { color, mode, preference, setPreference, reduceMotion, ready }. Invocarlo dentro de cada pantalla y crear estilos con la paleta actual. La paleta clara sigue el estilo Zallox: blanco, negro, grises y bordes finos; la oscura queda disponible como opción.
- color sigue exportado para compatibilidad (paleta clara). radius, spacing, font y typography son constantes. font: display, body, medium, semibold y mono. Títulos y cuerpo usan IBM Plex Sans; los importes conservan IBM Plex Mono. La raíz carga fuentes locales.
- components/Motion: BlurFade (children, style, delay en ms), AnimatedBackground (layout {x,y,width,height} o undefined, color, radius opcional). Opacidad/desplazamiento nativos, sin blur de GPU y con movimiento reducido.
- Tarjeta y EstadoVacio ya tienen entrada animada. Evitar envolver de nuevo todas las tarjetas.
- El dock participa en layout y reserva su altura + zona segura: no añadir 100px extra a todas las pantallas. Selector de tema accesible desde su asa, con menú modal. Se oculta con el teclado.
- components/AnimatedList: lista virtualizada desacoplada para futuros avisos. No aporta datos ni sistema de notificaciones.
No se cambian rutas ni operaciones financieras. color.surface2 es la superficie secundaria; conservar acentos de categoría/banco.

## Entrega de Agente 2
La validación previa del hero oscuro y la paleta anterior queda reemplazada por la actualización visual Zallox descrita al final de este contrato.

Fase móvil implementada: 11 componentes compartidos, ThemeProvider persistente con opción Sistema, fuentes locales con licencias OFL, fondo compartido de selección, fade/ripple, lista virtualizada desacoplada y dock de cinco rutas. Tema cambia con desvanecimiento breve nativo; movimiento reducido desactiva las transiciones. Dependencias nuevas: expo-font ~12.0.10 y @react-navigation/bottom-tabs 6.5.20 (misma versión de Expo Router 3.5).

Actualización visual Zallox: tema claro predeterminado y paleta neutra; tipografía sans serif en pantallas y tarjetas de superficie blanca con borde, sin sombras marcadas. El Resumen elimina el saludo de usuario genérico y el hero oscuro. Sin sesión, muestra el estado vacío sin esperar consultas protegidas.

TypeScript móvil aprobado tras declarar la dependencia del dock y la corrección paralela de View por Agente 3. La validación en teléfonos Android/iOS reales sigue pendiente; el navegador web no sustituye esa revisión. El backend de desarrollo no respondió en la revisión web y no se verificaron operaciones con datos reales.

Empaquetado Expo aprobado para web (830 módulos), iOS (1065 módulos) y Android (1062 módulos), con fuentes y recursos resueltos. Comandos usados: `pnpm --filter mobile exec expo export --platform web --output-dir dist-ui-check` y `pnpm --filter mobile exec expo export --platform android --platform ios --output-dir dist-native-ui-check --max-workers 2`. Esto verifica los bundles, no la ejecución en dispositivos.
