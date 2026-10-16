import { getSupabaseClient } from "../client";
import {
  VERSION_LEGAL,
  documentosPendientes,
  esDocumentoLegal,
  esVersionLegal,
  type AceptacionLegal,
  type DocumentoLegal,
  type PlataformaLegal,
} from "../lib/legal";

/**
 * Lo que la persona aceptó (términos y privacidad), de la más antigua a la más
 * nueva. La tabla es de solo lectura: RLS deja ver únicamente lo propio.
 */
export async function listarAceptaciones(): Promise<AceptacionLegal[]> {
  const { data, error } = await getSupabaseClient()
    .from("aceptaciones_legales")
    .select("documento, version, plataforma, origen, aceptado_en")
    .order("aceptado_en")
    .order("documento");
  if (error) throw error;
  return (data ?? [])
    .filter((fila) => esDocumentoLegal(fila.documento) && esVersionLegal(fila.version))
    .map((fila) => ({
      documento: fila.documento as DocumentoLegal,
      version: fila.version,
      plataforma: (fila.plataforma as PlataformaLegal | null) ?? undefined,
      origen: fila.origen === "registro" ? ("registro" as const) : ("app" as const),
      aceptadoEn: fila.aceptado_en,
    }));
}

/**
 * Documentos que la persona debe aceptar para seguir (vacío = al día). Son los
 * de la versión que trae esta app y que aún no aceptó: todos, en una cuenta
 * anterior a los términos; solo el que cambió, tras una actualización.
 */
export async function documentosLegalesPendientes(): Promise<DocumentoLegal[]> {
  return documentosPendientes(await listarAceptaciones());
}

/**
 * Anota que la persona aceptó la versión vigente de un documento. Siempre es
 * la versión que trae esta app (`VERSION_LEGAL`): la pantalla no elige versión,
 * así nadie "acepta" un texto que no vio. La base pone la fecha y no repite:
 * aceptar dos veces la misma versión deja la primera fecha.
 */
export async function registrarAceptacion(documento: DocumentoLegal, plataforma?: PlataformaLegal): Promise<void> {
  if (!esDocumentoLegal(documento)) throw new Error("Documento legal desconocido.");
  const { error } = await getSupabaseClient().rpc("registrar_aceptacion_legal", {
    p_documento: documento,
    p_version: VERSION_LEGAL[documento],
    ...(plataforma ? { p_plataforma: plataforma } : {}),
  });
  if (error) throw error;
}

/**
 * Para el botón «Acepto» de la pantalla de aceptación: registra todos los
 * documentos pendientes y devuelve cuáles fueron. Si algo falla a la mitad, lo
 * ya anotado queda (es idempotente) y se puede reintentar.
 */
export async function aceptarDocumentosPendientes(plataforma?: PlataformaLegal): Promise<DocumentoLegal[]> {
  const pendientes = await documentosLegalesPendientes();
  for (const documento of pendientes) {
    await registrarAceptacion(documento, plataforma);
  }
  return pendientes;
}
