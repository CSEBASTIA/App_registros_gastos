import { guardarPdfEntrante } from "../lib/pdfEntrante";

/**
 * Enlaces que abren la app desde fuera. Un PDF abierto con «Abrir con
 * FinTrack» llega como content://… (no es una ruta de la app): se recuerda y
 * se abre la pantalla de importar. Lo demás (gastosapp://…) sigue igual.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/^content:\/\//i.test(path)) {
      guardarPdfEntrante(path);
      return "/importar-estado";
    }
    return path;
  } catch {
    return "/";
  }
}
