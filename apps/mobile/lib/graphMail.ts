import { htmlATexto, crearFetchConTimeout } from "core";
import { obtenerAccessToken } from "./outlookAuth";

// Mismo criterio que Gmail: la llamada a Graph se corta a los 20 s.
const fetchGraph = crearFetchConTimeout({ ms: 20_000 });

export interface CorreoRecibido {
  mensajeId: string;
  remitente: string;
  asunto: string;
  cuerpoTexto: string;
  fecha: string; // YYYY-MM-DD
}

interface MensajeGraph {
  id: string;
  subject?: string;
  receivedDateTime: string;
  from?: { emailAddress?: { address?: string } };
  body?: { contentType?: string; content?: string };
}

/**
 * Trae los correos de la bandeja de entrada recibidos desde `desde`
 * (más nuevos primero). No filtra por remitente acá — eso lo hace
 * `parsearCorreoBancario` en `core`, así se puede ampliar la lista de
 * bancos conocidos sin tocar esta llamada a Graph.
 */
export async function traerCorreosNuevos(desde: Date, limite = 40): Promise<CorreoRecibido[]> {
  const token = await obtenerAccessToken();
  const filtro = encodeURIComponent(`receivedDateTime ge ${desde.toISOString()}`);
  const select = "id,subject,receivedDateTime,from,body";
  const url =
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages` +
    `?$select=${select}&$filter=${filtro}&$orderby=receivedDateTime desc&$top=${limite}`;

  const res = await fetchGraph(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph respondió ${res.status}: ${detalle.slice(0, 200)}`);
  }
  const data = (await res.json()) as { value: MensajeGraph[] };

  return data.value.map((m) => ({
    mensajeId: m.id,
    remitente: m.from?.emailAddress?.address ?? "",
    asunto: m.subject ?? "",
    cuerpoTexto: m.body?.content ? htmlATexto(m.body.content) : "",
    fecha: m.receivedDateTime.slice(0, 10),
  }));
}
