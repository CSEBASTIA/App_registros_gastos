# Catálogo de imágenes de tarjetas

Las imágenes están separadas en carpetas por banco dentro de `apps/mobile/assets`.
Cada archivo conserva el nombre del producto y está enlazado en el mapa estático
`IMAGENES_POR_ID` de [`catalogoTarjetas.ts`](../../lib/catalogoTarjetas.ts).

Carpetas organizadas: `Banco Guayaquil Tarjetas` (23), `Diners Club Tarjetas`
(28), `Produbanco Tarjetas` (22) y `Banco Pichincha Tarjetas` (16). La carpeta
`Banco Pacifico Tarjetas` está lista para sus imágenes.

Si un producto no tiene imagen todavía, `TarjetaVisual` sigue mostrando el
diseño genérico (degradado + nombre) para ese banco/marca — no rompe nada.
