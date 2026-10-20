# Plan de mejora visual: una interfaz más tranquila

**Alcance:** interfaz de la app móvil (`apps/mobile`) como prioridad. Después de validar el resultado, trasladar las mismas reglas visuales a la web (`apps/desktop`). Este plan no cambia cálculos, datos, autenticación ni operaciones financieras.

## Punto de partida

La app ya tiene una base neutra, IBM Plex Sans, tema claro y oscuro, tarjetas sin sombra fuerte y soporte de movimiento reducido. El principal problema visual no es el color de marca: es la cantidad de información que compite en una misma pantalla. En el Resumen aparecen, uno tras otro, balance, gráfica semanal, salud financiera, lugares, recomendaciones y hasta ocho movimientos. Varias etiquetas y metadatos usan 11–12 px. Cada `Tarjeta` aplica una entrada animada; el dock conserva una sombra visible y una fila superior adicional para apariencia.

## Objetivo de diseño

Que una persona pueda abrir la app y entender su situación del mes en pocos segundos, sin tener que procesar simultáneamente todas las métricas. Mantener la información completa y fácil de encontrar.

### Reglas visuales propuestas

1. **Una cifra principal por vista.** En Resumen, el balance del mes domina. Ingresos y gastos quedan como cifras secundarias claramente relacionadas.
2. **Menos bordes y bloques.** Usar un fondo neutro ligeramente distinto de las superficies, separaciones generosas y bordes solo donde ayudan a agrupar. Evitar tarjetas anidadas y sombras decorativas.
3. **Texto más cómodo.** Llevar el texto de lectura y las cifras de listas a tamaños legibles; reservar 11–12 px para información auxiliar que no sea necesaria para decidir. Mantener IBM Plex Mono para importes comparables.
4. **Color con significado.** Gris para estructura; verde, ámbar y rojo solo para estados financieros o acciones que los necesitan. No comunicar un estado únicamente con color.
5. **Movimiento discreto.** Conservar respuesta inmediata al toque y transiciones breves. Evitar que todas las tarjetas de una lista entren animadas cada vez que se visita una pantalla. Respetar `reduceMotion`.
6. **Jerarquía constante.** Repetir el mismo patrón de título, período, acción principal, contenido y detalle en Resumen, Gastos, Ingresos y Tarjetas.

## Cambios por área

| Área | Cambio propuesto | Resultado esperado |
| --- | --- | --- |
| Sistema visual | Ajustar `theme.ts`: fondo gris muy claro, superficies blancas, texto carbón, bordes suaves y escala coherente de espaciado y tipografía. Comprobar contraste en ambos temas. | Menos brillo y una lectura más estable sin abandonar la estética Zallox. |
| Resumen | Dejar balance, ingresos, gastos y una acción principal en el primer bloque. Mostrar actividad reciente breve; agrupar gráfica, salud, lugares y recomendaciones en secciones secundarias expandibles o de acceso claro. Las alertas importantes permanecen visibles. | La primera vista responde «¿cómo voy este mes?» sin ocultar información financiera. |
| Gastos e Ingresos | Simplificar la cabecera y los selectores de mes/semana. Dar prioridad al total y a la lista; presentar categoría, cuenta, fecha y lugar en una segunda línea ordenada o en el detalle. Mantener editar y eliminar accesibles con sus confirmaciones. | Menos texto por fila y exploración más rápida. |
| Tarjetas y cuentas | Separar visualmente saldo, próximo pago y datos de la tarjeta. Conservar colores y arte propios de cada banco como contenido, sin convertirlos en el color de toda la pantalla. | Datos importantes reconocibles sin ruido cromático. |
| Formularios | Agrupar campos relacionados, aumentar separación entre grupos y aclarar estados de error, ayuda, carga y éxito. Mantener botones y campos con áreas táctiles cómodas. | Registrar un movimiento se siente guiado y sencillo. |
| Dock | Reducir el peso de la sombra y el énfasis del contenedor; revisar su altura y la fila de apariencia sin perder las cinco rutas, el selector de tema ni las áreas táctiles. | Navegación presente pero menos dominante. |
| Animaciones | Limitar `BlurFade` a entradas de sección o cambios de estado; evitar animación automática por cada tarjeta de listas largas. Mantener el fondo animado de selección y una respuesta táctil sobria. | Menos movimiento repetitivo y lectura más estable. |

## Orden de trabajo

1. **Auditoría visual breve.** Capturar Resumen, Gastos, Tarjetas y un formulario en teléfono pequeño y grande, con tema claro y oscuro. Anotar densidad, tamaños, contraste y elementos que compiten por atención.
2. **Prototipo de dirección.** Preparar una muestra de Resumen y una lista de movimientos con los nuevos tokens, jerarquía y dock. Revisar el aspecto antes de extenderlo.
3. **Base compartida.** Ajustar tokens y componentes comunes (`Tarjeta`, `ItemMovimiento`, selectores, botón, dock y movimiento). Evitar estilos nuevos aislados por pantalla.
4. **Pantallas principales.** Aplicar la jerarquía al Resumen, Gastos, Ingresos y Tarjetas. Después, cuentas, detalles y formularios.
5. **Adaptación web.** Usar las mismas reglas de color, tipografía, densidad y movimiento en `apps/desktop`, ajustadas al espacio de escritorio.
6. **Revisión en dispositivo.** Probar Android e iOS con datos vacíos y abundantes, textos grandes, tema oscuro, movimiento reducido, teclado abierto y anchos distintos.

## Criterios de aceptación

- El balance y la acción principal se identifican de inmediato en Resumen; el resto de métricas tiene una jerarquía clara y sigue accesible.
- Los textos necesarios para decidir o actuar no dependen de letras diminutas. El contraste de texto e iconos se verifica en claro y oscuro.
- Ninguna acción financiera, ruta o dato desaparece; las operaciones y confirmaciones conservan su comportamiento.
- El dock no tapa contenido ni teclado y mantiene controles táctiles cómodos.
- Las animaciones no retrasan tareas ni se repiten de forma distractora; `reduceMotion` funciona.
- La revisión visual se realiza en teléfonos reales o emuladores de Android e iOS; la compilación por sí sola no cierra esta etapa.

## Límites de esta propuesta

El login queda fuera de este rediseño general, según la decisión actual del proyecto. La dirección visual se valida primero en una muestra antes de propagar cambios a todas las pantallas.

## Maquetas iniciales

Estas capturas son ejemplos visuales con datos ilustrativos; aún no son pantallas implementadas en Expo:

- [Resumen claro](mockups/calma-visual/resumen-claro.png)
- [Gastos claro](mockups/calma-visual/gastos-claro.png)
- [Resumen oscuro](mockups/calma-visual/resumen-oscuro.png)

El archivo [HTML de la maqueta](mockups/calma-visual/index.html) permite revisar las decisiones de espaciado, color y jerarquía antes de aplicarlas a los componentes reales.

## Primera aplicación en móvil · 19 de octubre de 2026

- Resumen y Gastos usan la nueva jerarquía de las maquetas: balance o total primero, actividad más breve y análisis/desglose disponible al expandirlo.
- La paleta clara y oscura se suavizó. El dock ocupa menos alto y mantiene las cinco rutas y el selector de apariencia.
- Se conservan las animaciones activas de entrada, selección, respuesta táctil y cambio de tema, junto con el respeto a `reduceMotion`.
- TypeScript, renderizado web de Expo y exportación de Android/iOS pasaron. La revisión visual en teléfonos Android e iOS sigue pendiente.

### Revisión complementaria

- Resumen y Gastos revisados en Expo web a 320, 390 y 430 px: sin desbordamiento horizontal ni errores de ejecución en los estados vacíos disponibles.
- Texto ampliado al 150 % mediante simulación en navegador: se corrigió el recorte de etiquetas del dock y se ajustó la posición del menú de apariencia a su altura real.
- Se comprobó que el tema oscuro se guarda y se restaura al recargar.
- El desplazamiento automático de los selectores ahora respeta `reduceMotion`; las animaciones normales siguen habilitadas.
- TypeScript y comprobación de diferencias pasaron tras las correcciones. No hay dispositivos listados por ADB ni emulador Android instalado en la ubicación del SDK. La simulación web no sustituye la revisión de texto ampliado, teclado y movimiento en Android/iOS reales.
