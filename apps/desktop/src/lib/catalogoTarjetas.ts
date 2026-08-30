import type { Banco, Marca } from "core";

/**
 * Catálogo de productos de tarjeta de Banco Guayaquil (nombre público +
 * banco/marca). Un `Cuenta.estilo` guarda el `id` de acá; con eso se busca
 * la imagen real en `assets/tarjetas/<id>.(png|jpg|webp)` — ver `imagenDe`.
 * Si esa imagen todavía no existe, `TarjetaVisual` cae al diseño genérico
 * (degradado + texto) usando `banco`/`marca`.
 */
export interface ProductoTarjeta {
  id: string;
  nombre: string;
  banco: Banco;
  marca: Marca;
}

export const CATALOGO_TARJETAS: ProductoTarjeta[] = [
  { id: "amex-clasica-consumo", nombre: "American Express® Clásica Consumo", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-clasica-credito", nombre: "American Express® Clásica Crédito", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-gold-consumo", nombre: "American Express® Gold Consumo", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-gold-credito", nombre: "American Express® Gold Crédito", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-platinum-credito", nombre: "American Express® Platinum Crédito", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-platinum-metal", nombre: "American Express® The Platinum Card Metal", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-aadvantage-platinum", nombre: "American Express® AAdvantage Platinum", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-aadvantage-elite", nombre: "American Express® AAdvantage Elite", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-clasica", nombre: "American Express Lifemiles Clásica", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-gold", nombre: "American Express Lifemiles Gold", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-platinum", nombre: "American Express Lifemiles Platinum", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-elite", nombre: "American Express Lifemiles Elite", banco: "banco_guayaquil", marca: "amex" },
  { id: "visa-clasica", nombre: "Visa Clásica", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-platinum", nombre: "Visa Platinum", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-lifemiles-clasica", nombre: "Visa Lifemiles Clásica", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-signature-lifemiles", nombre: "Visa Signature Lifemiles", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-oro-lifemiles", nombre: "Visa Oro Lifemiles", banco: "banco_guayaquil", marca: "visa" },
  { id: "latampass-clasica", nombre: "LATAM Pass Clásica", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "latampass-gold", nombre: "LATAM Pass Gold", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "latampass-platinum", nombre: "LATAM Pass Platinum", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "latampass-black", nombre: "LATAM Pass Black", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "mastercard-clasica", nombre: "Mastercard® Clásica", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "mastercard-platinum", nombre: "Mastercard® Platinum", banco: "banco_guayaquil", marca: "mastercard" },
];

export function productoDe(estilo: string | undefined): ProductoTarjeta | undefined {
  return estilo ? CATALOGO_TARJETAS.find((p) => p.id === estilo) : undefined;
}

// Cualquier imagen puesta en assets/tarjetas/<id-del-producto>.(png|jpg|jpeg|webp)
// aparece acá automáticamente. Si todavía no existe, no pasa nada — el
// producto sigue disponible en el catálogo con el diseño de respaldo.
const modulosImagen = import.meta.glob("../assets/tarjetas/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const IMAGENES_POR_ID: Record<string, string> = {};
for (const [ruta, url] of Object.entries(modulosImagen)) {
  const id = ruta.split("/").pop()?.replace(/\.(png|jpe?g|webp)$/i, "");
  if (id) IMAGENES_POR_ID[id] = url;
}

export function imagenDe(estilo: string | undefined): string | undefined {
  return estilo ? IMAGENES_POR_ID[estilo] : undefined;
}
