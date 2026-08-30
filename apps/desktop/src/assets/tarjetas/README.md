# Imágenes de tarjetas (catálogo Banco Guayaquil)

Poné acá el archivo de imagen de cada producto, con el nombre exacto de su
`id` de [`catalogoTarjetas.ts`](../../lib/catalogoTarjetas.ts) — la app lo
detecta solo, sin tocar código, apenas el archivo existe.

Extensión: `.png`, `.jpg`, `.jpeg` o `.webp` (cualquiera de las cuatro).

```
amex-clasica-consumo.png
amex-clasica-credito.png
amex-gold-consumo.png
amex-gold-credito.png
amex-platinum-credito.png
amex-platinum-metal.png
amex-aadvantage-platinum.png
amex-aadvantage-elite.png
amex-lifemiles-clasica.png
amex-lifemiles-gold.png
amex-lifemiles-platinum.png
amex-lifemiles-elite.png
visa-clasica.png
visa-platinum.png
visa-lifemiles-clasica.png
visa-signature-lifemiles.png
visa-oro-lifemiles.png
latampass-clasica.png
latampass-gold.png
latampass-platinum.png
latampass-black.png
mastercard-clasica.png
```

Si un producto no tiene imagen todavía, `TarjetaVisual` sigue mostrando el
diseño genérico (degradado + nombre) para ese banco/marca — no rompe nada.
