import {
  htmlATexto,
  crearFetchConTimeout,
  estadosDeCuentaEnCorreos,
  fechaLocal,
  juntarPaginas,
  DIAS_ESTADOS_EN_CORREO,
  TOPE_CORREOS,
  type CorreoRecibido,
  type CorreosTraidos,
  type EstadoCuentaEnCorreo,
} from "core";
import { obtenerAccessToken } from "./outlookAuth";

// El tipo vive en core (lo comparten Gmail, Outlook y las pruebas).
export type { CorreoRecibido };

// Mismo criterio que Gmail: cada llamada a Graph se corta a los 20 s.
const fetchGraph = crearFetchConTimeout({ ms: 20_000 });

const BASE_GRAPH = "https://graph.microsoft.com/v1.0/";

interface MensajeGraph {
  id: string;
  subject?: string;
  receivedDateTime: string;
  from?: { emailAddress?: { address?: string } };
  body?: { contentType?: string; content?: string };
  hasAttachments?: boolean;
}

async function pedirPagina(url: string): Promise<{ value: MensajeGraph[]; "@odata.nextLink"?: string }> {
  return pedirJson(url);
}

async function pedirJson(url: string): Promise<any> {
  // El token solo viaja a Graph: no se sigue un nextLink que apunte a otro sitio.
  if (!url.startsWith(BASE_GRAPH)) throw new Error("Microsoft Graph devolvió un enlace de página inesperado.");
  const token = await obtenerAccessToken();
  const res = await fetchGraph(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph respondió ${res.status}: ${detalle.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Trae los correos de la bandeja de entrada recibidos desde `desde` (más
 * nuevos primero), página por página hasta `tope`. No filtra por remitente
 * acá — eso lo hace `parsearCorreoBancario` en `core`, así se puede ampliar
 * la lista de bancos conocidos sin tocar esta llamada a Graph.
 */
export async function traerCorreosNuevos(desde: Date, tope = TOPE_CORREOS): Promise<CorreosTraidos> {
  const filtro = encodeURIComponent(`receivedDateTime ge ${desde.toISOString()}`);
  const primera =
    `${BASE_GRAPH}me/mailFolders/inbox/messages` +
    `?$select=id,subject,receivedDateTime,from,body,hasAttachments&$filter=${filtro}&$orderby=receivedDateTime desc&$top=50`;

  const { items, truncado } = await juntarPaginas(async (siguiente) => {
    const pagina = await pedirPagina(siguiente ?? primera);
    return { items: pagina.value ?? [], siguiente: pagina["@odata.nextLink"] };
  }, tope);

  return { correos: items.map(aCorreo), truncado, fallidos: 0 };
}

function aCorreo(m: MensajeGraph): CorreoRecibido {
  return {
    mensajeId: m.id,
    remitente: m.from?.emailAddress?.address ?? "",
    asunto: m.subject ?? "",
    cuerpoTexto: m.body?.content ? htmlATexto(m.body.content) : "",
    // receivedDateTime viene en UTC: el día se toma en la hora local del
    // teléfono (un correo de las 20:00 en Ecuador ya es "mañana" en UTC).
    fecha: fechaLocal(new Date(m.receivedDateTime)),
    // Graph no dice el tipo de adjunto en la lista: se comprueba al descargarlo.
    tienePdf: !!m.hasAttachments,
  };
}

/** Los estados de cuenta con adjunto de los últimos meses (de los 50 correos con adjuntos más recientes). */
export async function buscarEstadosDeCuenta(): Promise<EstadoCuentaEnCorreo[]> {
  const desde = new Date(Date.now() - DIAS_ESTADOS_EN_CORREO * 24 * 60 * 60 * 1000);
  const filtro = encodeURIComponent(`hasAttachments eq true and receivedDateTime ge ${desde.toISOString()}`);
  const pagina = await pedirPagina(
    `${BASE_GRAPH}me/messages?$select=id,subject,receivedDateTime,from,body,hasAttachments&$filter=${filtro}&$orderby=receivedDateTime desc&$top=50`
  );
  return estadosDeCuentaEnCorreos((pagina.value ?? []).map(aCorreo));
}

interface AdjuntoGraph {
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  contentBytes?: string;
}

/** Descarga el PDF adjunto de un correo, en base64. No se guarda en el teléfono. */
export async function descargarPdf(mensajeId: string, tamanoMaximo: number): Promise<{ base64: string; nombre: string }> {
  const base = `${BASE_GRAPH}me/messages/${encodeURIComponent(mensajeId)}/attachments`;
  const lista = (await pedirJson(`${base}?$select=id,name,contentType,size`)) as { value?: AdjuntoGraph[] };
  const pdf = (lista.value ?? []).find((a) => a.contentType === "application/pdf" || /.pdf$/i.test(a.name ?? ""));
  if (!pdf) throw new Error("Ese correo no tiene un PDF adjunto.");
  if ((pdf.size ?? 0) > tamanoMaximo) throw new Error("El PDF del correo pesa más de 10 MB: no parece un estado de cuenta.");
  const completo = (await pedirJson(`${base}/${encodeURIComponent(pdf.id)}`)) as AdjuntoGraph;
  if (!completo.contentBytes) throw new Error("No se pudo descargar el PDF del correo.");
  return { base64: completo.contentBytes, nombre: pdf.name || "estado-de-cuenta.pdf" };
}
