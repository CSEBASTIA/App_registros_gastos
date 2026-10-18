import type { Banco } from "core";

/** Logo real del banco (si existe) — "Otro banco" no tiene, cae al degradado + texto. */
const LOGO_BANCO: Partial<Record<Banco, ReturnType<typeof require>>> = {
  banco_guayaquil: require("../assets/logos/banco_guayaquil.webp"),
  pichincha: require("../assets/logos/pichincha.webp"),
  diners_club: require("../assets/logos/diners_club.webp"),
  produbanco: require("../assets/logos/produbanco.webp"),
  banco_pacifico: require("../assets/logos/banco_pacifico.png"),
  banco_austro: require("../assets/logos/banco_austro.png"),
};

export function logoDeBanco(banco: Banco) {
  return LOGO_BANCO[banco];
}

// Logos con letras oscuras sobre fondo transparente: sobre el degradado de la
// tarjeta no se ven (Produbanco era verde sobre azul) y van sobre blanco. Los
// cuadrados con fondo propio (Guayaquil, Pichincha, Diners) se muestran tal cual.
const LOGO_SOBRE_BLANCO: Partial<Record<Banco, true>> = {
  produbanco: true,
  banco_pacifico: true,
  banco_austro: true,
};

export function logoVaSobreBlanco(banco: Banco): boolean {
  return LOGO_SOBRE_BLANCO[banco] === true;
}
