// Documentos legales que la persona acepta (términos y política de privacidad).
// Los textos viven en apps/mobile/public/{terminos,privacidad}.html y se
// publican con la versión web. Ver docs/legal/README.md.

export const DOCUMENTOS_LEGALES = ["terminos", "privacidad"] as const;
export type DocumentoLegal = (typeof DOCUMENTOS_LEGALES)[number];

/**
 * Versión vigente de cada texto: la fecha de su última revisión de fondo.
 *
 * Deben coincidir con la etiqueta `<meta name="version-legal">` de cada página
 * (una prueba lo comprueba). Cuando cambie el fondo de un texto, se cambia
 * aquí y en la página: la app vuelve a pedir la aceptación. Una errata no
 * cambia la versión.
 */
export const VERSION_LEGAL: Readonly<Record<DocumentoLegal, string>> = {
  terminos: "2026-10-16",
  privacidad: "2026-10-16",
};

export const PLATAFORMAS_LEGALES = ["android", "ios", "web"] as const;
export type PlataformaLegal = (typeof PLATAFORMAS_LEGALES)[number];

/** Una aceptación guardada: qué documento, qué versión, desde dónde y cuándo. */
export interface AceptacionLegal {
  documento: DocumentoLegal;
  version: string;
  plataforma?: PlataformaLegal;
  /** 'registro': al crear la cuenta. 'app': después, desde la pantalla de aceptación. */
  origen: "registro" | "app";
  aceptadoEn: string;
}

const FORMATO_VERSION = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Es una fecha real con forma AAAA-MM-DD? (`2026-13-45` no.) */
export function esVersionLegal(version: string): boolean {
  if (!FORMATO_VERSION.test(version)) return false;
  const fecha = new Date(`${version}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === version;
}

export function esDocumentoLegal(valor: string): valor is DocumentoLegal {
  return (DOCUMENTOS_LEGALES as readonly string[]).includes(valor);
}

/** Convierte `Platform.OS` de React Native (o equivalente) a la plataforma que guarda la base. */
export function plataformaLegal(sistema: string | undefined): PlataformaLegal | undefined {
  return (PLATAFORMAS_LEGALES as readonly string[]).includes(sistema ?? "") ? (sistema as PlataformaLegal) : undefined;
}

/**
 * Documentos cuya versión vigente la persona todavía no aceptó. Cuenta como
 * aceptada una versión igual o MÁS NUEVA: si ya aceptó una versión posterior
 * (desde una app más reciente), una app más vieja no se lo vuelve a pedir.
 */
export function documentosPendientes(
  aceptadas: ReadonlyArray<{ documento: string; version: string }>,
  vigentes: Readonly<Record<DocumentoLegal, string>> = VERSION_LEGAL
): DocumentoLegal[] {
  return DOCUMENTOS_LEGALES.filter(
    (doc) => !aceptadas.some((a) => a.documento === doc && esVersionLegal(a.version) && a.version >= vigentes[doc])
  );
}

/** Lo que sabe la app de la aceptación de quien inició sesión. */
export type EstadoAceptacion = "comprobando" | "al-dia" | "pendiente" | "error";

export const RUTA_ACEPTAR_TERMINOS = "/aceptar-terminos";

/**
 * Qué hace la guarda de rutas respecto de la aceptación:
 * - `null`: nada, que sigan las reglas normales (sesión, login…).
 * - `"esperar"`: no navegar todavía (se está comprobando, o ya está en la pantalla de aceptación).
 * - una ruta: llevar a la persona ahí.
 *
 * Con la aceptación exigida, quien ya inició sesión no sale de la pantalla de
 * aceptación hasta aceptar la versión vigente; y si ya está al día, no se
 * queda en ella. Si no se pudo comprobar (`error`), tampoco pasa: no se deja
 * entrar sin saber.
 */
export function destinoPorAceptacion(p: {
  exigir: boolean;
  haySesion: boolean;
  estado: EstadoAceptacion;
  ruta: string;
}): "esperar" | typeof RUTA_ACEPTAR_TERMINOS | "/resumen" | null {
  if (!p.exigir || !p.haySesion) return null;
  const enAceptar = p.ruta === RUTA_ACEPTAR_TERMINOS;
  if (p.estado === "comprobando") return "esperar";
  if (p.estado === "al-dia") return enAceptar ? "/resumen" : null;
  return enAceptar ? "esperar" : RUTA_ACEPTAR_TERMINOS;
}

/**
 * Datos para `supabase.auth.signUp({ email, password, options: { data, … } })`
 * cuando la persona marcó la casilla de aceptación. Con confirmación por
 * correo `signUp` no deja sesión, así que un disparador de la base anota la
 * aceptación con la hora del servidor en el mismo momento de crear la cuenta.
 */
export function datosAceptacionRegistro(plataforma?: PlataformaLegal): Record<string, string> {
  return {
    acepta_terminos: VERSION_LEGAL.terminos,
    acepta_privacidad: VERSION_LEGAL.privacidad,
    ...(plataforma ? { plataforma } : {}),
  };
}
