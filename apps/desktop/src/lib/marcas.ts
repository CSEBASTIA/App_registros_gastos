import type { Banco, Marca } from "core";

/**
 * Insignias propias por banco/marca — no son los logos reales (son marca
 * registrada), solo un gradiente + texto para diferenciar tarjetas de un
 * vistazo, como hacen muchas apps fintech.
 */
export const GRADIENTE_BANCO: Record<Banco, string> = {
  banco_guayaquil: "linear-gradient(135deg, #0f4c81, #1f8a70)",
  pichincha: "linear-gradient(135deg, #7a5c00, #d4a72c)",
  produbanco: "linear-gradient(135deg, #1e3a5f, #3b6ff2)",
  otro: "linear-gradient(135deg, #52525b, #27272a)",
};

export const ETIQUETA_BANCO: Record<Banco, string> = {
  banco_guayaquil: "Banco Guayaquil",
  pichincha: "Banco Pichincha",
  produbanco: "Produbanco",
  otro: "Otro banco",
};

export const ETIQUETA_MARCA: Record<Marca, string> = {
  amex: "AMEX",
  visa: "VISA",
  mastercard: "Mastercard",
  diners: "Diners Club",
  otro: "",
};

export const OPCIONES_BANCO: Banco[] = ["banco_guayaquil", "pichincha", "produbanco", "otro"];
export const OPCIONES_MARCA: Marca[] = ["amex", "visa", "mastercard", "diners", "otro"];
