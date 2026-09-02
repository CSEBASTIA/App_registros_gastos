import type { Banco } from "core";

/** Logo real del banco (si existe) — "Otro banco" no tiene, cae al degradado + texto. */
const LOGO_BANCO: Partial<Record<Banco, ReturnType<typeof require>>> = {
  banco_guayaquil: require("../assets/logos/banco_guayaquil.webp"),
  pichincha: require("../assets/logos/pichincha.webp"),
  diners_club: require("../assets/logos/diners_club.webp"),
  produbanco: require("../assets/logos/produbanco.webp"),
};

export function logoDeBanco(banco: Banco) {
  return LOGO_BANCO[banco];
}
