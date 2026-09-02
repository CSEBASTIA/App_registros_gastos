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
  otro: ["#52525b", "#27272a"],
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
  otro: "#52525b",
};

/** Color de texto sobre `COLOR_CUENTA_BANCO` — el amarillo de Pichincha necesita texto oscuro, los demás blanco. */
export const TEXTO_CUENTA_BANCO: Record<Banco, string> = {
  banco_guayaquil: "#ffffff",
  pichincha: "#0a2540",
  produbanco: "#ffffff",
  diners_club: "#ffffff",
  otro: "#ffffff",
};

export const ETIQUETA_BANCO: Record<Banco, string> = {
  banco_guayaquil: "Banco Guayaquil",
  pichincha: "Banco Pichincha",
  produbanco: "Produbanco",
  diners_club: "Diners Club",
  otro: "Otro banco",
};

export const ETIQUETA_MARCA: Record<Marca, string> = {
  amex: "AMEX",
  visa: "VISA",
  mastercard: "Mastercard",
  diners: "Diners Club",
  otro: "",
};

export const OPCIONES_BANCO: Banco[] = ["banco_guayaquil", "pichincha", "produbanco", "diners_club", "otro"];
export const OPCIONES_MARCA: Marca[] = ["amex", "visa", "mastercard", "diners", "otro"];
