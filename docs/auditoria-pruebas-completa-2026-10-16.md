# Auditoría completa de pruebas

- **Fecha:** 16 de octubre de 2026
- **Proyecto:** App_registros_gastos
- **Resultado:** aprobada para pruebas automatizadas y empaquetado; queda una oportunidad no bloqueante de reducir el peso de imágenes.

## Estado evaluado

- Rama `Rama-Logica`, `HEAD` `c0950d2`.
- El árbol de trabajo ya tenía cambios locales al iniciar la auditoría. Las pruebas se ejecutaron sobre esos archivos, no solo sobre el commit.
- La rama avanzó durante la ejecución. Se repitieron las suites unitarias, las comprobaciones TypeScript, el build de escritorio y las exportaciones Web y Android después del avance. El último commit durante la auditoría solo modificó documentación legal.

## Resultados

| Área | Verificación | Resultado |
|---|---|---|
| Core | `pnpm --filter core test` | **171/171**; 0 fallos |
| Escritorio | `pnpm --filter desktop test` | **3/3**; 0 fallos |
| Móvil | `pnpm --filter mobile test` | **14/14**; 0 fallos |
| TypeScript | `tsc --noEmit` para escritorio y móvil | **Sin errores** |
| Build escritorio | `pnpm --filter desktop build` | **Correcto**; Vite transformó 313 módulos |
| División del bundle escritorio | Build de Vite | El PDF queda en un chunk separado de 365,12 kB (107,61 kB gzip); el chunk principal es 466,44 kB (131,83 kB gzip) |
| Dependencias Expo | `expo install --check` | **Dependencias al día** |
| Export Android | `expo export --platform android` | **Correcto**; 1.232 módulos, 176 assets y bundle Hermes de 3,84 MB |
| Export iOS | `expo export --platform ios` | **Correcto**; 1.235 módulos y 176 assets |
| Export Web | `expo export --platform web` | **Correcto**; 1.001 módulos y bundle JavaScript de 2,09 MB |
| Supabase/Postgres | `bash supabase/tests/correr.sh` | **266/266** comprobaciones, más la prueba de concurrencia; código de salida 0 |
| Espacios en cambios | `git diff --check` | **Sin errores**; Git solo avisó que normalizará algunos finales de línea LF/CRLF |
| Preview local | Expo Web en `http://localhost:8081/` | **HTTP 200**; la consola indicó `Web Bundled` |

Las pruebas SQL corrieron en el contenedor desechable configurado por `supabase/tests/correr.sh`. Se aplicaron las migraciones desde cero y la prueba final confirmó que dos abonos simultáneos no duplican el saldo. No se escribió en Supabase local ni de producción; el contenedor de pruebas se eliminó al terminar.

## Auditoría de rutas

- Se inventariaron **27 archivos de pantalla** y 3 archivos `_layout.tsx`.
- Las cinco rutas de pestañas están declaradas en el layout de tabs; las rutas secundarias están registradas en el stack o enlazadas desde las pantallas que las ofrecen. También se revisaron las rutas dinámicas `[id]`.
- No se encontraron referencias al destino retirado `conectar-correo` ni rutas de pantalla sobrantes sin una entrada de navegación identificable.
- La comprobación de navegación fue estática y el export Expo confirmó que el árbol de rutas puede empaquetarse. No equivale a recorrer cada pantalla con una sesión real.

## Hallazgos y acciones sugeridas

### Oportunidad no bloqueante: tamaño de imágenes móviles

El export Android incluye 176 assets que ocupan **23,86 MB** en disco antes de empaquetar. Esto no causó fallos de compilación, pero aumenta el tamaño de descarga e instalación. Si se quiere reducirlo, conviene crear versiones redimensionadas y optimizadas de las imágenes de tarjetas y comparar su calidad antes de reemplazarlas. No se modificaron assets como parte de esta auditoría.

### Cobertura pendiente

No se recorrió el flujo completo de autenticación ni cada pantalla con una cuenta de prueba conectada a un entorno Supabase de staging. Tampoco se instaló un APK compilado desde este árbol de trabajo exacto. Las pruebas SQL validan la base de datos en Postgres aislado; no verifican correo real, proveedores externos ni datos de producción.

## Conclusión

No se detectaron errores de pruebas, tipos, empaquetado ni referencias a la ruta retirada. Core, escritorio, móvil, exportaciones Android/iOS/Web y migraciones SQL pasan. El preview web queda disponible en `http://localhost:8081/`; la única observación de rendimiento encontrada es el peso total del catálogo de imágenes.
