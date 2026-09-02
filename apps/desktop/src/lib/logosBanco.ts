import type { Banco } from "core";
import guayaquil from "../assets/logos/banco_guayaquil.webp";
import pichincha from "../assets/logos/pichincha.webp";
import dinersClub from "../assets/logos/diners_club.webp";
import produbanco from "../assets/logos/produbanco.webp";

const LOGO_BANCO: Partial<Record<Banco, string>> = {
  banco_guayaquil: guayaquil,
  pichincha,
  diners_club: dinersClub,
  produbanco,
};

/** Logo real del banco (si existe) — "Otro banco" no tiene, cae al texto. */
export function logoDeBanco(banco: Banco): string | undefined {
  return LOGO_BANCO[banco];
}
