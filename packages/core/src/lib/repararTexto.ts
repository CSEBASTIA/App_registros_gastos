/**
 * Corrige texto en UTF-8 que alguien leyó como Latin-1 o Windows-1252: el
 * «AsignaciÃ³n» o «rebotÃ³» que llega en el asunto de algunos correos (el
 * remitente declara mal la codificación) y en nombres guardados así.
 *
 * Se rearman los bytes originales (cada carácter es un byte; los de
 * Windows-1252 como «€» o «"» vuelven a su byte) y se leen otra vez como
 * UTF-8. Si el resultado no es UTF-8 válido, el texto se deja como estaba:
 * un «Ã» legítimo (raro en español) no se rompe. Sin TextDecoder ni Buffer,
 * que Hermes no trae de forma confiable.
 */

// Windows-1252: los caracteres de 0x80–0x9F que no son de Latin-1.
const BYTE_CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89,
  "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

// Inicio de una secuencia UTF-8 leída como Latin-1: «Ã³», «Â¿», «â€œ», «ðŸ»…
const PARECE_DANADO = /[ÂÃâð][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;

function bytesDe(texto: string): number[] | undefined {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0)!;
    if (codigo <= 0xff) bytes.push(codigo);
    else if (BYTE_CP1252[caracter] !== undefined) bytes.push(BYTE_CP1252[caracter]);
    else return undefined; // un carácter que no cabe en un byte: el texto no está dañado así
  }
  return bytes;
}

export function repararTexto(texto: string): string {
  if (!texto || !PARECE_DANADO.test(texto)) return texto;
  const bytes = bytesDe(texto);
  if (!bytes) return texto;
  try {
    return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return texto;
  }
}

/** Igual que `repararTexto`, para un valor que puede faltar. */
export function repararTextoOpcional<T extends string | null | undefined>(texto: T): T {
  return (typeof texto === "string" ? repararTexto(texto) : texto) as T;
}
