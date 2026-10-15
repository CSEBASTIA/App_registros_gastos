/** Corrige nombres guardados con UTF-8 interpretado como Latin-1. */
export function repararTexto(texto: string): string {
  const reemplazos: Record<string, string> = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú", "Ã±": "ñ", "Ã¼": "ü",
    "Ã": "Á", "Ã‰": "É", "Ã": "Í", "Ã“": "Ó", "Ãš": "Ú", "Ã‘": "Ñ", "Ãœ": "Ü",
    "Â®": "®", "Â©": "©", "Â°": "°", "Â¿": "¿", "Â¡": "¡", "Â·": "·",
  };
  return texto.replace(/Ã.|Â[®©°¿¡·]/g, (parte) => reemplazos[parte] ?? parte);
}
