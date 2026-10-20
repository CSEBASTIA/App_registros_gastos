// «Compartir → FinTrack» con un PDF (Android). El módulo nativo solo existe en
// el APK desde la versión 1.5.0; en uno anterior, en iPhone o en la web no
// está y no hace nada. «Abrir con FinTrack» no lo necesita: llega como enlace
// (ver app/+native-intent.tsx).
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

type Nativo = { tomar(): string | null };

const nativo = Platform.OS === "android" ? requireOptionalNativeModule<Nativo>("PdfCompartido") : null;

/** La dirección (content://) del PDF que se compartió con la app, una sola vez; o null. */
export function tomarPdfCompartido(): string | null {
  try {
    return nativo?.tomar() ?? null;
  } catch {
    return null;
  }
}
