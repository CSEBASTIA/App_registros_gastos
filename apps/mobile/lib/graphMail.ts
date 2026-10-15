import {
  htmlATexto,
  crearFetchConTimeout,
  fechaLocal,
  juntarPaginas,
  TOPE_CORREOS,
  type CorreoRecibido,
  type CorreosTraidos,
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
}

async function pedirPagina(url: string): Promise<{ value: MensajeGraph[]; "@odata.nextLink"?: string }> {
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
    `?$select=id,subject,receivedDateTime,from,body&$filter=${filtro}&$orderby=receivedDateTime desc&$top=50`;

  const { items, truncado } = await juntarPaginas(async (siguiente) => {
    const pagina = await pedirPagina(siguiente ?? primera);
    return { items: pagina.value ?? [], siguiente: pagina["@odata.nextLink"] };
  }, tope);

  const correos = items.map((m) => ({
    mensajeId: m.id,
    remitente: m.from?.emailAddress?.address ?? "",
    asunto: m.subject ?? "",
    cuerpoTexto: m.body?.content ? htmlATexto(m.body.content) : "",
    // receivedDateTime viene en UTC: el día se toma en la hora local del
    // teléfono (un correo de las 20:00 en Ecuador ya es "mañana" en UTC).
    fecha: fechaLocal(new Date(m.receivedDateTime)),
  }));
  return { correos, truncado, fallidos: 0 };
}
