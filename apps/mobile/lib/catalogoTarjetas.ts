import type { Banco, Marca } from "core";
import type { ImageSourcePropType } from "react-native";

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
  /** Ajuste excepcional para artes oficiales que incluyen aire o fondo promocional alrededor de la tarjeta. */
  ajusteImagen?: "cover" | "contain";
}

export const CATALOGO_TARJETAS: ProductoTarjeta[] = [
  // ---- Banco del Pacífico / PacifiCard: solo tarjetas de crédito ----
  { id: "pacifico-mastercard-clasica-internacional", nombre: "Mastercard Clásica Internacional PacifiCard", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-mi-comisariato", nombre: "Mastercard Clásica Mi Comisariato", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-cash", nombre: "Mastercard Clásica Cash", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-asia-javier", nombre: "Mastercard Clásica Asia Javier", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-zamorano", nombre: "Mastercard Clásica Zamorano", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-aldeas-sos", nombre: "Mastercard Clásica Aldeas S.O.S.", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-monte-sinai", nombre: "Mastercard Clásica Monte Sinaí", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-clasica-psmart", nombre: "Mastercard Clásica PSmart", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-black", nombre: "Mastercard Black PacifiCard", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-business", nombre: "Mastercard Business PacifiCard", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-dp-world", nombre: "Mastercard DP World", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-platinum", nombre: "Mastercard Platinum PacifiCard", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-mileageplus-platinum", nombre: "Mastercard MileagePlus Platinum", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-gold", nombre: "Mastercard Gold PacifiCard", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-mileageplus-gold", nombre: "Mastercard MileagePlus Gold", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-mi-comisariato-gold", nombre: "Mastercard Mi Comisariato Gold", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-intisana-gold", nombre: "Mastercard Colegio Intisana Gold", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-stiehle-cuenca-gold", nombre: "Mastercard Colegio Stiehle Cuenca Gold", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-colegio-los-pinos-gold", nombre: "Mastercard Colegio Los Pinos Gold", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-mastercard-zamorano-gold", nombre: "Mastercard Zamorano Gold", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  // PacifiCard Legend es un producto de crédito, pero su web no publica un frente limpio de tarjeta.
  { id: "pacifico-mastercard-legend", nombre: "Mastercard Legend", familia: "Mastercard", banco: "banco_pacifico", marca: "mastercard" },
  { id: "pacifico-visa-clasica-internacional", nombre: "Visa Clásica Internacional PacifiCard", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-clasica-mi-comisariato", nombre: "Visa Clásica Mi Comisariato", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-clasica-cash", nombre: "Visa Clásica Cash", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-infinite", nombre: "Visa Infinite PacifiCard", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-corporativa", nombre: "Visa Corporativa PacifiCard", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-platinum", nombre: "Visa Platinum PacifiCard", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-mileageplus-platinum", nombre: "Visa MileagePlus Platinum", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-amcham-platinum", nombre: "Visa Cámara Ecuatoriana Americana Platinum", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-oro", nombre: "Visa Oro PacifiCard", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-mileageplus-oro", nombre: "Visa MileagePlus Oro", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-mi-comisariato-oro", nombre: "Visa Mi Comisariato Oro", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-amcham-oro", nombre: "Visa Cámara Ecuatoriana Americana Oro", familia: "Visa", banco: "banco_pacifico", marca: "visa" },
  { id: "pacifico-visa-colegio-aleman-humboldt-gye-oro", nombre: "Visa Colegio Alemán Humboldt Guayaquil Oro", familia: "Visa", banco: "banco_pacifico", marca: "visa" },

  // ---- Banco del Austro: tarjetas de crédito ----
  { id: "austro-visa-internacional", nombre: "Visa Internacional Banco del Austro", familia: "Visa", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-gold", nombre: "Visa Gold Banco del Austro", familia: "Visa", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-platinum", nombre: "Visa Platinum Banco del Austro", familia: "Visa", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-signature", nombre: "Visa Signature Banco del Austro", familia: "Visa", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-infinite", nombre: "Visa Infinite Banco del Austro", familia: "Visa", banco: "banco_austro", marca: "visa" },
  { id: "austro-mastercard-internacional", nombre: "Mastercard Internacional Banco del Austro", familia: "Mastercard", banco: "banco_austro", marca: "mastercard", ajusteImagen: "cover" },
  { id: "austro-mastercard-gold", nombre: "Mastercard Gold Banco del Austro", familia: "Mastercard", banco: "banco_austro", marca: "mastercard", ajusteImagen: "cover" },
  { id: "austro-mastercard-platinum", nombre: "Mastercard Platinum Banco del Austro", familia: "Mastercard", banco: "banco_austro", marca: "mastercard", ajusteImagen: "cover" },
  { id: "austro-mastercard-black", nombre: "Mastercard Black Banco del Austro", familia: "Mastercard", banco: "banco_austro", marca: "mastercard", ajusteImagen: "cover" },
  { id: "austro-visa-hyundai", nombre: "Visa Hyundai Banco del Austro", familia: "Visa especiales", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-kia", nombre: "Visa KIA Banco del Austro", familia: "Visa especiales", banco: "banco_austro", marca: "visa", ajusteImagen: "cover" },
  { id: "austro-visa-mundial", nombre: "Visa Mundial Banco del Austro", familia: "Visa especiales", banco: "banco_austro", marca: "visa" },
  { id: "austro-mastercard-futbol-gold", nombre: "Mastercard Fútbol Gold", familia: "Mastercard Fútbol", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-futbol-platinum", nombre: "Mastercard Fútbol Platinum", familia: "Mastercard Fútbol", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-futbol-black", nombre: "Mastercard Fútbol Black", familia: "Mastercard Fútbol", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-visa-warner-gold-batman", nombre: "Visa Warner Gold Batman", familia: "Visa Warner", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-warner-platinum-batman", nombre: "Visa Warner Platinum Batman", familia: "Visa Warner", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-warner-platinum-superman", nombre: "Visa Warner Platinum Superman", familia: "Visa Warner", banco: "banco_austro", marca: "visa" },
  { id: "austro-visa-warner-platinum-wonder-woman", nombre: "Visa Warner Platinum Wonder Woman", familia: "Visa Warner", banco: "banco_austro", marca: "visa" },
  { id: "austro-mastercard-warner-gold-batman", nombre: "Mastercard Warner Gold Batman", familia: "Mastercard Warner", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-liga-justicia-batman", nombre: "Mastercard Liga de la Justicia Batman", familia: "Mastercard Warner", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-liga-justicia-superman", nombre: "Mastercard Liga de la Justicia Superman", familia: "Mastercard Warner", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-liga-justicia-wonder-woman", nombre: "Mastercard Liga de la Justicia Wonder Woman", familia: "Mastercard Warner", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-game-of-thrones-lannister", nombre: "Mastercard Game of Thrones Lannister", familia: "Mastercard Game of Thrones", banco: "banco_austro", marca: "mastercard" },
  { id: "austro-mastercard-game-of-thrones-targaryen", nombre: "Mastercard Game of Thrones Targaryen", familia: "Mastercard Game of Thrones", banco: "banco_austro", marca: "mastercard" },

  // ---- Banco Pichincha: tarjetas de crédito personales ----
  { id: "pichincha-visa-infinite-miles", nombre: "Visa Infinite Pichincha Miles", familia: "Visa Pichincha Miles", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-signature-miles", nombre: "Visa Signature Pichincha Miles", familia: "Visa Pichincha Miles", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-platinum-miles", nombre: "Visa Platinum Pichincha Miles", familia: "Visa Pichincha Miles", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-gold-miles", nombre: "Visa Gold Pichincha Miles", familia: "Visa Pichincha Miles", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-premium-miles", nombre: "Visa Premium Pichincha Miles", familia: "Visa Pichincha Miles", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-joven", nombre: "Visa Joven Pichincha Miles", familia: "Visa Pichincha Miles", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-universidad-catolica", nombre: "Visa Universidad Católica de Guayaquil", familia: "Tarjetas afines", banco: "pichincha", marca: "visa" },
  { id: "pichincha-mastercard-black-miles", nombre: "Mastercard Black Pichincha Miles", familia: "Mastercard Pichincha Miles", banco: "pichincha", marca: "mastercard" },
  { id: "pichincha-mastercard-platinum-miles", nombre: "Mastercard Platinum Pichincha Miles", familia: "Mastercard Pichincha Miles", banco: "pichincha", marca: "mastercard" },
  { id: "pichincha-mastercard-gold-miles", nombre: "Mastercard Gold Pichincha Miles", familia: "Mastercard Pichincha Miles", banco: "pichincha", marca: "mastercard" },
  { id: "pichincha-mastercard-premium-miles", nombre: "Mastercard Premium Pichincha Miles", familia: "Mastercard Pichincha Miles", banco: "pichincha", marca: "mastercard" },
  { id: "pichincha-mastercard-joven-miles", nombre: "Mastercard Joven Pichincha Miles", familia: "Mastercard Pichincha Miles", banco: "pichincha", marca: "mastercard" },
  // Banco Pichincha también publica tarjetas de crédito para microempresas.
  { id: "pichincha-visa-premium-microfinanzas", nombre: "Visa Premium Microfinanzas", familia: "Microfinanzas Visa", banco: "pichincha", marca: "visa" },
  { id: "pichincha-visa-premium-microfinanzas-miles", nombre: "Visa Premium Microfinanzas Pichincha Miles", familia: "Microfinanzas Visa", banco: "pichincha", marca: "visa" },
  { id: "pichincha-mastercard-premium-microfinanzas", nombre: "Mastercard Premium Microfinanzas", familia: "Microfinanzas Mastercard", banco: "pichincha", marca: "mastercard" },
  { id: "pichincha-mastercard-premium-microfinanzas-miles", nombre: "Mastercard Premium Pichincha Miles Microfinanzas", familia: "Microfinanzas Mastercard", banco: "pichincha", marca: "mastercard" },
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


// Metro necesita referencias estáticas para incluir las imágenes locales.
const IMAGENES_POR_ID: Record<string, ImageSourcePropType> = {
  "austro-visa-internacional": require("../assets/Banco del Austro Tarjetas/austro-visa-internacional.png"),
  "austro-visa-gold": require("../assets/Banco del Austro Tarjetas/austro-visa-gold.png"),
  "austro-visa-platinum": require("../assets/Banco del Austro Tarjetas/austro-visa-platinum.png"),
  "austro-visa-signature": require("../assets/Banco del Austro Tarjetas/austro-visa-signature.png"),
  "austro-visa-infinite": require("../assets/Banco del Austro Tarjetas/austro-visa-infinite.png"),
  "austro-mastercard-internacional": require("../assets/Banco del Austro Tarjetas/austro-mastercard-internacional.png"),
  "austro-mastercard-gold": require("../assets/Banco del Austro Tarjetas/austro-mastercard-gold.png"),
  "austro-mastercard-platinum": require("../assets/Banco del Austro Tarjetas/austro-mastercard-platinum.png"),
  "austro-mastercard-black": require("../assets/Banco del Austro Tarjetas/austro-mastercard-black.png"),
  "austro-visa-hyundai": require("../assets/Banco del Austro Tarjetas/austro-visa-hyundai.png"),
  "austro-visa-kia": require("../assets/Banco del Austro Tarjetas/austro-visa-kia.jpg"),
  "austro-visa-mundial": require("../assets/Banco del Austro Tarjetas/austro-visa-mundial.png"),
  "austro-mastercard-futbol-gold": require("../assets/Banco del Austro Tarjetas/austro-mastercard-futbol-gold.jpg"),
  "austro-mastercard-futbol-platinum": require("../assets/Banco del Austro Tarjetas/austro-mastercard-futbol-platinum.jpg"),
  "austro-mastercard-futbol-black": require("../assets/Banco del Austro Tarjetas/austro-mastercard-futbol-black.jpg"),
  "austro-visa-warner-gold-batman": require("../assets/Banco del Austro Tarjetas/austro-visa-warner-gold-batman.png"),
  "austro-visa-warner-platinum-batman": require("../assets/Banco del Austro Tarjetas/austro-visa-warner-platinum-batman.png"),
  "austro-visa-warner-platinum-superman": require("../assets/Banco del Austro Tarjetas/austro-visa-warner-platinum-superman.png"),
  "austro-visa-warner-platinum-wonder-woman": require("../assets/Banco del Austro Tarjetas/austro-visa-warner-platinum-wonder-woman.png"),
  "austro-mastercard-warner-gold-batman": require("../assets/Banco del Austro Tarjetas/austro-mastercard-warner-gold-batman.png"),
  "austro-mastercard-liga-justicia-batman": require("../assets/Banco del Austro Tarjetas/austro-mastercard-liga-justicia-batman.png"),
  "austro-mastercard-liga-justicia-superman": require("../assets/Banco del Austro Tarjetas/austro-mastercard-liga-justicia-superman.png"),
  "austro-mastercard-liga-justicia-wonder-woman": require("../assets/Banco del Austro Tarjetas/austro-mastercard-liga-justicia-wonder-woman.png"),
  "austro-mastercard-game-of-thrones-lannister": require("../assets/Banco del Austro Tarjetas/austro-mastercard-game-of-thrones-lannister.png"),
  "austro-mastercard-game-of-thrones-targaryen": require("../assets/Banco del Austro Tarjetas/austro-mastercard-game-of-thrones-targaryen.png"),
  "amex-aadvantage-elite": require("../assets/Banco Guayaquil Tarjetas/amex-aadvantage-elite.webp"),
  "amex-aadvantage-platinum": require("../assets/Banco Guayaquil Tarjetas/amex-aadvantage-platinum.webp"),
  "amex-clasica-consumo": require("../assets/Banco Guayaquil Tarjetas/amex-clasica-consumo.webp"),
  "amex-clasica-credito": require("../assets/Banco Guayaquil Tarjetas/amex-clasica-credito.webp"),
  "amex-gold-consumo": require("../assets/Banco Guayaquil Tarjetas/amex-gold-consumo.webp"),
  "amex-gold-credito": require("../assets/Banco Guayaquil Tarjetas/amex-gold-credito.webp"),
  "amex-lifemiles-clasica": require("../assets/Banco Guayaquil Tarjetas/amex-lifemiles-clasica.webp"),
  "amex-lifemiles-elite": require("../assets/Banco Guayaquil Tarjetas/amex-lifemiles-elite.webp"),
  "amex-lifemiles-gold": require("../assets/Banco Guayaquil Tarjetas/amex-lifemiles-gold.webp"),
  "amex-lifemiles-platinum": require("../assets/Banco Guayaquil Tarjetas/amex-lifemiles-platinum.webp"),
  "amex-platinum-credito": require("../assets/Banco Guayaquil Tarjetas/amex-platinum-credito.webp"),
  "amex-platinum-metal": require("../assets/Banco Guayaquil Tarjetas/amex-platinum-metal.webp"),
  "diners-club-international": require("../assets/Diners Club Tarjetas/diners-club-international.png"),
  "diners-club-miles": require("../assets/Diners Club Tarjetas/diners-club-miles.png"),
  "diners-freedom-hero": require("../assets/Diners Club Tarjetas/diners-freedom-hero.png"),
  "diners-gas-club": require("../assets/Diners Club Tarjetas/diners-gas-club.png"),
  "diners-hilton-colon": require("../assets/Diners Club Tarjetas/diners-hilton-colon.png"),
  "diners-hospital-del-rio": require("../assets/Diners Club Tarjetas/diners-hospital-del-rio.png"),
  "diners-kids": require("../assets/Diners Club Tarjetas/diners-kids.png"),
  "diners-one": require("../assets/Diners Club Tarjetas/diners-one.png"),
  "diners-sphaera": require("../assets/Diners Club Tarjetas/diners-sphaera.png"),
  "diners-swiss-club": require("../assets/Diners Club Tarjetas/diners-swiss-club.png"),
  "diners-table-gourmet": require("../assets/Diners Club Tarjetas/diners-table-gourmet.png"),
  "discover-me": require("../assets/Diners Club Tarjetas/discover-me.png"),
  "discover-more": require("../assets/Diners Club Tarjetas/discover-more.png"),
  "discover-puce": require("../assets/Diners Club Tarjetas/discover-puce.png"),
  "discover-ucg": require("../assets/Diners Club Tarjetas/discover-ucg.png"),
  "discover-udla": require("../assets/Diners Club Tarjetas/discover-udla.png"),
  "discover-uhe": require("../assets/Diners Club Tarjetas/discover-uhe.png"),
  "discover-uide": require("../assets/Diners Club Tarjetas/discover-uide.png"),
  "discover-utpl": require("../assets/Diners Club Tarjetas/discover-utpl.png"),
  "latampass-black": require("../assets/Banco Guayaquil Tarjetas/latampass-black.png"),
  "latampass-clasica": require("../assets/Banco Guayaquil Tarjetas/latampass-clasica.png"),
  "latampass-gold": require("../assets/Banco Guayaquil Tarjetas/latampass-gold.png"),
  "latampass-platinum": require("../assets/Banco Guayaquil Tarjetas/latampass-platinum.png"),
  "mastercard-black-business": require("../assets/Produbanco Tarjetas/mastercard-black-business.png"),
  "mastercard-black-produbanco": require("../assets/Produbanco Tarjetas/mastercard-black-produbanco.png"),
  "mastercard-clasica": require("../assets/Banco Guayaquil Tarjetas/mastercard-clasica.webp"),
  "mastercard-gold-produbanco": require("../assets/Produbanco Tarjetas/mastercard-gold-produbanco.png"),
  "mastercard-platinum-produbanco": require("../assets/Produbanco Tarjetas/mastercard-platinum-produbanco.png"),
  "mastercard-platinum": require("../assets/Banco Guayaquil Tarjetas/mastercard-platinum.webp"),
  "mastercard-supermaxi-clasica": require("../assets/Produbanco Tarjetas/mastercard-supermaxi-clasica.png"),
  "mastercard-supermaxi-gold": require("../assets/Produbanco Tarjetas/mastercard-supermaxi-gold.png"),
  "mastercard-supermaxi-platinum": require("../assets/Produbanco Tarjetas/mastercard-supermaxi-platinum.png"),
  "mastercard-tipti-supermaxi": require("../assets/Produbanco Tarjetas/mastercard-tipti-supermaxi.png"),
  "pichincha-mastercard-black-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-mastercard-black-miles.png"),
  "pichincha-mastercard-gold-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-mastercard-gold-miles.png"),
  // "pichincha-mastercard-joven-miles": imagen pendiente (assets/Banco Pichincha Tarjetas/pichincha-mastercard-joven-miles.jpg no existe todavía; TarjetaVisual usa el degradado del banco)
  "pichincha-mastercard-platinum-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-mastercard-platinum-miles.png"),
  // "pichincha-mastercard-premium-microfinanzas": imagen pendiente (assets/Banco Pichincha Tarjetas/pichincha-mastercard-premium-microfinanzas.jpg no existe todavía; TarjetaVisual usa el degradado del banco)
  // "pichincha-mastercard-premium-microfinanzas-miles": imagen pendiente (assets/Banco Pichincha Tarjetas/pichincha-mastercard-premium-microfinanzas-miles.jpg no existe todavía; TarjetaVisual usa el degradado del banco)
  "pichincha-mastercard-premium-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-mastercard-premium-miles.jpg"),
  "pichincha-visa-gold-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-gold-miles.png"),
  "pichincha-visa-infinite-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-infinite-miles.png"),
  "pichincha-visa-joven": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-joven.png"),
  "pichincha-visa-platinum-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-platinum-miles.jpg"),
  "pichincha-visa-premium-microfinanzas": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-premium-microfinanzas.jpg"),
  "pichincha-visa-premium-microfinanzas-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-premium-microfinanzas-miles.jpg"),
  "pichincha-visa-signature-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-signature-miles.jpg"),
  "pichincha-visa-universidad-catolica": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-universidad-catolica.jpg"),
  "pichincha-visa-premium-miles": require("../assets/Banco Pichincha Tarjetas/pichincha-visa-premium-miles.webp"),
  "pacifico-mastercard-clasica-internacional": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-internacional.png"),
  "pacifico-mastercard-clasica-mi-comisariato": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-mi-comisariato.png"),
  "pacifico-mastercard-clasica-cash": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-cash.png"),
  "pacifico-mastercard-clasica-asia-javier": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-asia-javier.png"),
  "pacifico-mastercard-clasica-zamorano": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-zamorano.png"),
  "pacifico-mastercard-clasica-aldeas-sos": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-aldeas-sos.png"),
  "pacifico-mastercard-clasica-monte-sinai": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-monte-sinai.png"),
  "pacifico-mastercard-clasica-psmart": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-clasica-psmart.png"),
  "pacifico-mastercard-black": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-black.png"),
  "pacifico-mastercard-business": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-business.png"),
  "pacifico-mastercard-dp-world": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-dp-world.png"),
  "pacifico-mastercard-platinum": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-platinum.png"),
  "pacifico-mastercard-mileageplus-platinum": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-mileageplus-platinum.png"),
  "pacifico-mastercard-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-gold.png"),
  "pacifico-mastercard-mileageplus-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-mileageplus-gold.png"),
  "pacifico-mastercard-mi-comisariato-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-mi-comisariato-gold.png"),
  "pacifico-mastercard-intisana-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-intisana-gold.png"),
  "pacifico-mastercard-stiehle-cuenca-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-stiehle-cuenca-gold.png"),
  "pacifico-mastercard-colegio-los-pinos-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-colegio-los-pinos-gold.png"),
  "pacifico-mastercard-zamorano-gold": require("../assets/Banco Pacifico Tarjetas/pacifico-mastercard-zamorano-gold.png"),
  "pacifico-visa-clasica-internacional": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-clasica-internacional.png"),
  "pacifico-visa-clasica-mi-comisariato": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-clasica-mi-comisariato.png"),
  "pacifico-visa-clasica-cash": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-clasica-cash.png"),
  "pacifico-visa-infinite": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-infinite.png"),
  "pacifico-visa-corporativa": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-corporativa.png"),
  "pacifico-visa-platinum": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-platinum.png"),
  "pacifico-visa-mileageplus-platinum": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-mileageplus-platinum.png"),
  "pacifico-visa-amcham-platinum": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-amcham-platinum.png"),
  "pacifico-visa-oro": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-oro.png"),
  "pacifico-visa-mileageplus-oro": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-mileageplus-oro.png"),
  "pacifico-visa-mi-comisariato-oro": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-mi-comisariato-oro.png"),
  "pacifico-visa-amcham-oro": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-amcham-oro.png"),
  "pacifico-visa-colegio-aleman-humboldt-gye-oro": require("../assets/Banco Pacifico Tarjetas/pacifico-visa-colegio-aleman-humboldt-gye-oro.png"),
  "titanium-mastercard-black-beyond": require("../assets/Diners Club Tarjetas/titanium-mastercard-black-beyond.png"),
  "titanium-mastercard-black": require("../assets/Diners Club Tarjetas/titanium-mastercard-black.png"),
  "titanium-mastercard-platinum": require("../assets/Diners Club Tarjetas/titanium-mastercard-platinum.png"),
  "titanium-mastercard": require("../assets/Diners Club Tarjetas/titanium-mastercard.png"),
  "titanium-visa-euphoria": require("../assets/Diners Club Tarjetas/titanium-visa-euphoria.png"),
  "titanium-visa-infinite": require("../assets/Diners Club Tarjetas/titanium-visa-infinite.png"),
  "titanium-visa-platinum": require("../assets/Diners Club Tarjetas/titanium-visa-platinum.png"),
  "titanium-visa-signature": require("../assets/Diners Club Tarjetas/titanium-visa-signature.png"),
  "titanium-visa-world-card": require("../assets/Diners Club Tarjetas/titanium-visa-world-card.png"),
  "visa-avianca-lifemiles-gold": require("../assets/Produbanco Tarjetas/visa-avianca-lifemiles-gold.png"),
  "visa-avianca-lifemiles-infinite": require("../assets/Produbanco Tarjetas/visa-avianca-lifemiles-infinite.png"),
  "visa-avianca-lifemiles-platinum": require("../assets/Produbanco Tarjetas/visa-avianca-lifemiles-platinum.png"),
  "visa-clasica-produbanco": require("../assets/Produbanco Tarjetas/visa-clasica-produbanco.png"),
  "visa-clasica": require("../assets/Banco Guayaquil Tarjetas/visa-clasica.webp"),
  "visa-copa-infinite": require("../assets/Produbanco Tarjetas/visa-copa-infinite.png"),
  "visa-copa-platinum": require("../assets/Produbanco Tarjetas/visa-copa-platinum.png"),
  "visa-corporativa-platinum": require("../assets/Produbanco Tarjetas/visa-corporativa-platinum.png"),
  "visa-gold-produbanco": require("../assets/Produbanco Tarjetas/visa-gold-produbanco.png"),
  "visa-iberia-infinite": require("../assets/Produbanco Tarjetas/visa-iberia-infinite.png"),
  "visa-iberia-platinum": require("../assets/Produbanco Tarjetas/visa-iberia-platinum.png"),
  "visa-infinite-produbanco": require("../assets/Produbanco Tarjetas/visa-infinite-produbanco.png"),
  "visa-lifemiles-clasica": require("../assets/Banco Guayaquil Tarjetas/visa-lifemiles-clasica.webp"),
  "visa-oro-lifemiles": require("../assets/Banco Guayaquil Tarjetas/visa-oro-lifemiles.webp"),
  "visa-platinum-produbanco": require("../assets/Produbanco Tarjetas/visa-platinum-produbanco.png"),
  "visa-platinum": require("../assets/Banco Guayaquil Tarjetas/visa-platinum.webp"),
  "visa-pyme-clasica": require("../assets/Produbanco Tarjetas/visa-pyme-clasica.png"),
  "visa-signature-lifemiles": require("../assets/Banco Guayaquil Tarjetas/visa-signature-lifemiles.webp"),
  "visa-signature-produbanco": require("../assets/Produbanco Tarjetas/visa-signature-produbanco.png"),
};

export function imagenDe(estilo: string | undefined): ImageSourcePropType | undefined {
  return estilo ? IMAGENES_POR_ID[estilo] : undefined;
}
