import { createContext } from "react";
import * as WebBrowser from "expo-web-browser";
import type { DocumentoLegal, EstadoAceptacion } from "core";

// Cada EXPO_PUBLIC_* debe escribirse tal cual para que Expo lo reemplace al armar la app.
export const URL_TERMINOS = process.env.EXPO_PUBLIC_URL_TERMINOS || undefined;
export const URL_PRIVACIDAD = process.env.EXPO_PUBLIC_URL_PRIVACIDAD || undefined;
export const CORREO_PRIVACIDAD = process.env.EXPO_PUBLIC_CORREO_PRIVACIDAD || undefined;

/**
 * Mientras no sea "1", la app NO pide ni exige la aceptación de términos y
 * privacidad. Se enciende cuando la base ya tiene la migración de aceptación
 * y las páginas legales están completas (docs/legal/README.md): sin la
 * migración, la pantalla de aceptación bloquearía a todos. `build:play` y
 * `update:produccion` exigen que esté en "1".
 */
export const EXIGIR_ACEPTACION = process.env.EXPO_PUBLIC_EXIGIR_ACEPTACION === "1";

export const DOCUMENTOS: Record<DocumentoLegal, { titulo: string; subtitulo: string; url?: string }> = {
  terminos: { titulo: "Términos y condiciones", subtitulo: "Las reglas de uso de la app", url: URL_TERMINOS },
  privacidad: { titulo: "Política de privacidad", subtitulo: "Qué datos guardamos y para qué", url: URL_PRIVACIDAD },
};

/** Abre un documento legal en el navegador; si falla, no rompe la pantalla. */
export function abrirDocumento(url: string): Promise<unknown> {
  return WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

/** Lo que `app/_layout.tsx` comprueba tras iniciar sesión y las pantallas consultan. */
export interface Aceptacion {
  estado: EstadoAceptacion;
  /** Documentos que faltan de aceptar (con `estado: "pendiente"`). */
  pendientes: DocumentoLegal[];
  /** Por qué no se pudo comprobar (con `estado: "error"`). */
  error?: string;
  reintentar: () => void;
  /** La pantalla de aceptación avisa que ya se aceptó. */
  alDia: () => void;
}

export const AceptacionContext = createContext<Aceptacion>({
  estado: "al-dia",
  pendientes: [],
  reintentar: () => {},
  alDia: () => {},
});
