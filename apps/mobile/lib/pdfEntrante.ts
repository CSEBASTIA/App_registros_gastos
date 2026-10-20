import * as FileSystem from "expo-file-system";
import { TAMANO_MAXIMO_ESTADO } from "./archivosImportacion";

/**
 * Un PDF que llegó desde otra app («Abrir con» o «Compartir → FinTrack» en
 * WhatsApp, Archivos, Descargas…). Se guarda solo la dirección (content://),
 * en memoria, hasta que la pantalla de importar lo lee; nunca en disco.
 */
let pendiente: string | null = null;

export function guardarPdfEntrante(uri: string): void {
  if (/^content:\/\//i.test(uri)) pendiente = uri;
}

/** La dirección del PDF que llegó, una sola vez (al tomarla se olvida). */
export function tomarPdfEntrante(): string | null {
  const uri = pendiente;
  pendiente = null;
  return uri;
}

/**
 * Lee el PDF de otra app en base64. expo-file-system no lee en base64 un
 * content:// de cualquier app (solo los del almacenamiento del teléfono), así
 * que se copia a la caché, se lee y la copia se borra enseguida.
 */
export async function leerPdfEntrante(uri: string): Promise<string> {
  const copia = `${FileSystem.cacheDirectory}pdf-entrante-${Date.now()}.pdf`;
  try {
    await FileSystem.copyAsync({ from: uri, to: copia });
    const info = await FileSystem.getInfoAsync(copia);
    if (info.exists && info.size > TAMANO_MAXIMO_ESTADO) {
      throw new Error("El archivo pesa más de 10 MB: no parece un estado de cuenta.");
    }
    return await FileSystem.readAsStringAsync(copia, { encoding: FileSystem.EncodingType.Base64 });
  } finally {
    await FileSystem.deleteAsync(copia, { idempotent: true }).catch(() => {});
  }
}
