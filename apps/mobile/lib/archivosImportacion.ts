import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

/** Más que esto no es un estado de cuenta (suelen pesar menos de 1 MB) y el teléfono sufre al leerlo. */
export const TAMANO_MAXIMO_ESTADO = 10 * 1024 * 1024;

function base64DeBytes(bytes: Uint8Array): string {
  let binario = "";
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(binario);
}

/** El archivo elegido, en base64 (PDF). En la web `uri` es un blob: del navegador. */
export async function leerArchivoBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
    return base64DeBytes(bytes);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** El archivo elegido como texto (CSV o TXT). */
export async function leerArchivoTexto(uri: string): Promise<string> {
  if (Platform.OS === "web") return (await fetch(uri)).text();
  return FileSystem.readAsStringAsync(uri);
}

/**
 * Borra la copia que el selector dejó en la caché de la app: el estado de
 * cuenta no se queda en el teléfono después de leerlo. En la web no hay copia.
 */
export async function borrarCopiaTemporal(uri: string): Promise<void> {
  if (Platform.OS === "web" || !uri.startsWith("file:")) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

// El código de pdf.js va dentro de la app (assets/pdfjs): se lee una sola vez.
let codigoPdfjs: Promise<{ pdf: string; worker: string }> | null = null;

export function cargarCodigoPdfjs(): Promise<{ pdf: string; worker: string }> {
  codigoPdfjs ??= (async () => {
    const [pdf, worker] = await Asset.loadAsync([
      require("../assets/pdfjs/pdf.min.pdfjs"),
      require("../assets/pdfjs/pdf.worker.min.pdfjs"),
    ]);
    const texto = async (a: Asset) =>
      Platform.OS === "web" ? (await fetch(a.uri)).text() : FileSystem.readAsStringAsync(a.localUri ?? a.uri);
    return { pdf: await texto(pdf), worker: await texto(worker) };
  })().catch((err) => {
    codigoPdfjs = null;
    throw err;
  });
  return codigoPdfjs;
}
