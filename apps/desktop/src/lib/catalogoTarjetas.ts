import type { Banco, Marca } from "core";

/**
 * Catálogo de productos de tarjeta reales (Banco Guayaquil, Diners Club
 * Ecuador, ...). Un `Cuenta.estilo` guarda el `id` de acá; con eso se
 * busca la imagen real en `assets/tarjetas/<id>.(png|jpg|webp)` — ver
 * `imagenDe`. Si esa imagen todavía no existe, `TarjetaVisual` cae al
 * diseño genérico (degradado + texto) usando `banco`/`marca`.
 *
 * `familia` es solo para agrupar visualmente en la galería del selector
 * (ej. separar "TITANIUM Visa" de "TITANIUM Mastercard" de "Discover"
 * dentro de Diners Club) — no tiene efecto en los datos guardados.
 */
export interface ProductoTarjeta {
  id: string;
  nombre: string;
  familia: string;
  banco: Banco;
  marca: Marca;
}

export const CATALOGO_TARJETAS: ProductoTarjeta[] = [
  // ---- Banco Guayaquil ----
  { id: "amex-clasica-consumo", nombre: "American Express® Clásica Consumo", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-clasica-credito", nombre: "American Express® Clásica Crédito", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-gold-consumo", nombre: "American Express® Gold Consumo", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-gold-credito", nombre: "American Express® Gold Crédito", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-platinum-credito", nombre: "American Express® Platinum Crédito", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-platinum-metal", nombre: "American Express® The Platinum Card Metal", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-aadvantage-platinum", nombre: "American Express® AAdvantage Platinum", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-aadvantage-elite", nombre: "American Express® AAdvantage Elite", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-clasica", nombre: "American Express Lifemiles Clásica", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-gold", nombre: "American Express Lifemiles Gold", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-platinum", nombre: "American Express Lifemiles Platinum", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "amex-lifemiles-elite", nombre: "American Express Lifemiles Elite", familia: "American Express", banco: "banco_guayaquil", marca: "amex" },
  { id: "visa-clasica", nombre: "Visa Clásica", familia: "Visa", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-platinum", nombre: "Visa Platinum", familia: "Visa", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-lifemiles-clasica", nombre: "Visa Lifemiles Clásica", familia: "Visa", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-signature-lifemiles", nombre: "Visa Signature Lifemiles", familia: "Visa", banco: "banco_guayaquil", marca: "visa" },
  { id: "visa-oro-lifemiles", nombre: "Visa Oro Lifemiles", familia: "Visa", banco: "banco_guayaquil", marca: "visa" },
  { id: "latampass-clasica", nombre: "LATAM Pass Clásica", familia: "LATAM Pass / Mastercard", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "latampass-gold", nombre: "LATAM Pass Gold", familia: "LATAM Pass / Mastercard", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "latampass-platinum", nombre: "LATAM Pass Platinum", familia: "LATAM Pass / Mastercard", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "latampass-black", nombre: "LATAM Pass Black", familia: "LATAM Pass / Mastercard", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "mastercard-clasica", nombre: "Mastercard® Clásica", familia: "LATAM Pass / Mastercard", banco: "banco_guayaquil", marca: "mastercard" },
  { id: "mastercard-platinum", nombre: "Mastercard® Platinum", familia: "LATAM Pass / Mastercard", banco: "banco_guayaquil", marca: "mastercard" },

  // ---- Diners Club Ecuador ----
  { id: "diners-club-international", nombre: "Diners Club Internacional", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-club-miles", nombre: "Diners Club Miles", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-sphaera", nombre: "Diners Club Sphaera", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-one", nombre: "Diners Club One", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-kids", nombre: "Diners Club Kids", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-freedom-hero", nombre: "Diners Club Freedom Hero", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-table-gourmet", nombre: "Diners Club Table Gourmet", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-gas-club", nombre: "Diners Club Gas Club", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-swiss-club", nombre: "Diners Club Swiss Club", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-hospital-del-rio", nombre: "Diners Club Hospital del Río", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "diners-hilton-colon", nombre: "Diners Club Hilton Colón", familia: "Diners Club", banco: "diners_club", marca: "diners" },
  { id: "titanium-visa-world-card", nombre: "TITANIUM Visa World Card", familia: "TITANIUM Visa", banco: "diners_club", marca: "visa" },
  { id: "titanium-visa-euphoria", nombre: "TITANIUM Visa Euphoria", familia: "TITANIUM Visa", banco: "diners_club", marca: "visa" },
  { id: "titanium-visa-signature", nombre: "TITANIUM Visa Signature", familia: "TITANIUM Visa", banco: "diners_club", marca: "visa" },
  { id: "titanium-visa-platinum", nombre: "TITANIUM Visa Platinum", familia: "TITANIUM Visa", banco: "diners_club", marca: "visa" },
  { id: "titanium-visa-infinite", nombre: "TITANIUM Visa Infinite", familia: "TITANIUM Visa", banco: "diners_club", marca: "visa" },
  { id: "titanium-mastercard", nombre: "TITANIUM Mastercard", familia: "TITANIUM Mastercard", banco: "diners_club", marca: "mastercard" },
  { id: "titanium-mastercard-platinum", nombre: "TITANIUM Mastercard Platinum", familia: "TITANIUM Mastercard", banco: "diners_club", marca: "mastercard" },
  { id: "titanium-mastercard-black", nombre: "TITANIUM Mastercard Black", familia: "TITANIUM Mastercard", banco: "diners_club", marca: "mastercard" },
  { id: "titanium-mastercard-black-beyond", nombre: "TITANIUM Mastercard Black Beyond", familia: "TITANIUM Mastercard", banco: "diners_club", marca: "mastercard" },
  { id: "discover-me", nombre: "Discover Me", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-more", nombre: "Discover More", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-puce", nombre: "Discover PUCE", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-ucg", nombre: "Discover UCG", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-udla", nombre: "Discover UDLA", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-uhe", nombre: "Discover UHE", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-uide", nombre: "Discover UIDE", familia: "Discover", banco: "diners_club", marca: "otro" },
  { id: "discover-utpl", nombre: "Discover UTPL", familia: "Discover", banco: "diners_club", marca: "otro" },

  // ---- Produbanco ----
  { id: "visa-clasica-produbanco", nombre: "Visa Clásica", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "visa-gold-produbanco", nombre: "Visa Gold", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "visa-platinum-produbanco", nombre: "Visa Platinum", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "visa-signature-produbanco", nombre: "Visa Signature", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "visa-infinite-produbanco", nombre: "Visa Infinite", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "visa-pyme-clasica", nombre: "Visa Pyme Clásica", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "visa-corporativa-platinum", nombre: "Visa Corporativa Platinum", familia: "Visa", banco: "produbanco", marca: "visa" },
  { id: "mastercard-black-produbanco", nombre: "Mastercard Black", familia: "Mastercard", banco: "produbanco", marca: "mastercard" },
  { id: "mastercard-gold-produbanco", nombre: "Mastercard Gold", familia: "Mastercard", banco: "produbanco", marca: "mastercard" },
  { id: "mastercard-platinum-produbanco", nombre: "Mastercard Platinum", familia: "Mastercard", banco: "produbanco", marca: "mastercard" },
  { id: "mastercard-black-business", nombre: "Mastercard Black Business", familia: "Mastercard", banco: "produbanco", marca: "mastercard" },
  { id: "visa-copa-platinum", nombre: "Visa Copa Platinum", familia: "Visa Copa", banco: "produbanco", marca: "visa" },
  { id: "visa-copa-infinite", nombre: "Visa Copa Infinite", familia: "Visa Copa", banco: "produbanco", marca: "visa" },
  { id: "visa-iberia-platinum", nombre: "Visa Iberia Platinum", familia: "Visa Iberia", banco: "produbanco", marca: "visa" },
  { id: "visa-iberia-infinite", nombre: "Visa Iberia Infinite", familia: "Visa Iberia", banco: "produbanco", marca: "visa" },
  { id: "visa-avianca-lifemiles-gold", nombre: "Visa Avianca LifeMiles Gold", familia: "Visa Avianca LifeMiles", banco: "produbanco", marca: "visa" },
  { id: "visa-avianca-lifemiles-platinum", nombre: "Visa Avianca LifeMiles Platinum", familia: "Visa Avianca LifeMiles", banco: "produbanco", marca: "visa" },
  { id: "visa-avianca-lifemiles-infinite", nombre: "Visa Avianca LifeMiles Infinite", familia: "Visa Avianca LifeMiles", banco: "produbanco", marca: "visa" },
  { id: "mastercard-supermaxi-clasica", nombre: "Mastercard Supermaxi Clásica", familia: "Mastercard Supermaxi", banco: "produbanco", marca: "mastercard" },
  { id: "mastercard-supermaxi-gold", nombre: "Mastercard Supermaxi Gold", familia: "Mastercard Supermaxi", banco: "produbanco", marca: "mastercard" },
  { id: "mastercard-supermaxi-platinum", nombre: "Mastercard Supermaxi Platinum", familia: "Mastercard Supermaxi", banco: "produbanco", marca: "mastercard" },
  { id: "mastercard-tipti-supermaxi", nombre: "Mastercard Black Tipti Supermaxi Ilimitada", familia: "Mastercard Supermaxi", banco: "produbanco", marca: "mastercard" },
];

export function productoDe(estilo: string | undefined): ProductoTarjeta | undefined {
  return estilo ? CATALOGO_TARJETAS.find((p) => p.id === estilo) : undefined;
}

/** Bancos que tienen catálogo de diseños reales (aunque una imagen puntual todavía no exista). */
export function bancoTieneCatalogo(banco: Banco): boolean {
  return CATALOGO_TARJETAS.some((p) => p.banco === banco);
}

/** Agrupa los productos de un banco por `familia`, en el orden en que aparecen en el catálogo. */
export function gruposDelCatalogo(banco: Banco): { familia: string; items: ProductoTarjeta[] }[] {
  const grupos: { familia: string; items: ProductoTarjeta[] }[] = [];
  for (const producto of CATALOGO_TARJETAS) {
    if (producto.banco !== banco) continue;
    let grupo = grupos.find((g) => g.familia === producto.familia);
    if (!grupo) {
      grupo = { familia: producto.familia, items: [] };
      grupos.push(grupo);
    }
    grupo.items.push(producto);
  }
  return grupos;
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
