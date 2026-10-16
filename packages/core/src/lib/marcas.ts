import type { Banco, Marca } from "../types/domain";

/**
 * Insignias propias por banco/marca — no son los logos reales (son marca
 * registrada), solo un degradado + texto para diferenciar tarjetas de un
 * vistazo, como hacen muchas apps fintech.
 *
 * Se guardan como stops de color (no como string CSS) para que sirvan tanto
 * a desktop (`cssGradiente` arma el `linear-gradient(...)`) como a mobile
 * (se pasan directo al `colors` de `expo-linear-gradient`).
 */
export const GRADIENTE_BANCO: Record<Banco, [string, string]> = {
  banco_guayaquil: ["#0f4c81", "#1f8a70"],
  pichincha: ["#7a5c00", "#d4a72c"],
  produbanco: ["#1e3a5f", "#3b6ff2"],
  diners_club: ["#0a2f5c", "#0074c2"],
  banco_pacifico: ["#003b5c", "#008fa8"],
  banco_austro: ["#12264c", "#bb8b2c"],
  otro: ["#52525b", "#27272a"],
  comandato: ["#c8102e", "#7a0a1c"],
  artefacta: ["#e4572e", "#9c2a12"],
  marcimex: ["#0055a4", "#00336b"],
  la_ganga: ["#f2b705", "#c4380d"],
  japon: ["#d7263d", "#5c0a16"],
  de_prati: ["#1f1f1f", "#5a5a5a"],
  creditos_economicos: ["#00843d", "#004d24"],
  otra_casa_comercial: ["#6b4e9b", "#3b2a57"],
};

/** Arma el string CSS `linear-gradient(...)` a partir de los stops de `GRADIENTE_BANCO` (uso web/desktop). */
export function cssGradiente(stops: [string, string], anguloGrados = 135): string {
  return `linear-gradient(${anguloGrados}deg, ${stops[0]}, ${stops[1]})`;
}

/**
 * Color sólido por banco para cuentas que no son tarjeta de crédito
 * (ahorro/débito/efectivo) — un tono plano de marca en vez del degradado
 * de las tarjetas, para diferenciarlas de un vistazo.
 */
export const COLOR_CUENTA_BANCO: Record<Banco, string> = {
  banco_guayaquil: "#e6117f",
  pichincha: "#ffd400",
  produbanco: "#0a4f8c",
  diners_club: "#0057a8",
  banco_pacifico: "#006b8f",
  banco_austro: "#17345e",
  otro: "#52525b",
  comandato: "#c8102e",
  artefacta: "#e4572e",
  marcimex: "#0055a4",
  la_ganga: "#c4380d",
  japon: "#d7263d",
  de_prati: "#1f1f1f",
  creditos_economicos: "#00843d",
  otra_casa_comercial: "#6b4e9b",
};

/** Color de texto sobre `COLOR_CUENTA_BANCO` — el amarillo de Pichincha necesita texto oscuro, los demás blanco. */
export const TEXTO_CUENTA_BANCO: Record<Banco, string> = {
  banco_guayaquil: "#ffffff",
  pichincha: "#0a2540",
  produbanco: "#ffffff",
  diners_club: "#ffffff",
  banco_pacifico: "#ffffff",
  banco_austro: "#ffffff",
  otro: "#ffffff",
  comandato: "#ffffff",
  artefacta: "#ffffff",
  marcimex: "#ffffff",
  la_ganga: "#3a1a00",
  japon: "#ffffff",
  de_prati: "#ffffff",
  creditos_economicos: "#ffffff",
  otra_casa_comercial: "#ffffff",
};

export const ETIQUETA_BANCO: Record<Banco, string> = {
  banco_guayaquil: "Banco Guayaquil",
  pichincha: "Banco Pichincha",
  produbanco: "Produbanco",
  diners_club: "Diners Club",
  banco_pacifico: "Banco del Pacífico",
  banco_austro: "Banco del Austro",
  otro: "Otro banco",
  comandato: "Comandato",
  artefacta: "Artefacta",
  marcimex: "Marcimex",
  la_ganga: "La Ganga",
  japon: "Japón",
  de_prati: "De Prati",
  creditos_economicos: "Créditos Económicos",
  otra_casa_comercial: "Otra casa comercial",
};

export const ETIQUETA_MARCA: Record<Marca, string> = {
  amex: "AMEX",
  visa: "VISA",
  mastercard: "Mastercard",
  diners: "Diners Club",
  otro: "",
};

export const OPCIONES_BANCO: Banco[] = ["banco_guayaquil", "pichincha", "produbanco", "diners_club", "banco_pacifico", "banco_austro", "otro"];
/** Casas comerciales y créditos directos: se registran como tarjeta de crédito (cupo y compras a cuotas). */
export const OPCIONES_CASA_COMERCIAL: Banco[] = ["comandato", "artefacta", "marcimex", "la_ganga", "japon", "de_prati", "creditos_economicos", "otra_casa_comercial"];

export function esCasaComercial(banco: Banco): boolean {
  return OPCIONES_CASA_COMERCIAL.includes(banco);
}

/**
 * Iniciales para el ícono de una entidad sin logo (casas comerciales, "otro"):
 * una letra si el nombre es de una palabra, dos si son varias ("La Ganga" → "LG").
 */
export function inicialesDeEntidad(banco: Banco): string {
  const palabras = ETIQUETA_BANCO[banco].replace(/^(Otra?|Banco)\s+(del?\s+)?/i, "").split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  const iniciales = palabras.length === 1 ? palabras[0][0] : palabras[0][0] + palabras[1][0];
  return iniciales.toUpperCase();
}

export const OPCIONES_MARCA: Marca[] = ["amex", "visa", "mastercard", "diners", "otro"];
