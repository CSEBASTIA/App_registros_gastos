import {
  consultaGmail,
  htmlATexto,
  crearFetchConTimeout,
  fechaLocal,
  juntarPaginas,
  enLotes,
  TOPE_CORREOS,
  type CorreoRecibido,
  type CorreosTraidos,
} from "core";
import { obtenerAccessToken } from "./gmailAuth";

interface CabeceraGmail {
  name: string;
  value: string;
}
interface ParteGmail {
  mimeType?: string;
  body?: { data?: string };
  parts?: ParteGmail[];
}
interface MensajeGmail {
  id: string;
  internalDate: string;
  payload: { headers: CabeceraGmail[]; body?: { data?: string }; parts?: ParteGmail[] } & ParteGmail;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Gmail entrega el cuerpo en base64url — sin `atob`/`Buffer` disponibles de forma confiable en Hermes, se decodifica a mano. */
function decodificarBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let binaria = "";
  let buffer = 0;
  let bits = 0;
  for (const char of padded) {
    if (char === "=") break;
    const valor = BASE64_CHARS.indexOf(char);
    if (valor === -1) continue;
    buffer = (buffer << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      binaria += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(
      binaria
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch {
    return binaria;
  }
}

/** Busca la parte de texto (preferí text/plain, si no hay cae a text/html) dentro de un mensaje que puede ser multipart anidado. */
function extraerCuerpo(payload: ParteGmail): string {
  if (payload.body?.data && !payload.parts) {
    return payload.mimeType === "text/html" ? htmlATexto(decodificarBase64Url(payload.body.data)) : decodificarBase64Url(payload.body.data);
  }
  if (!payload.parts) return "";

  const plano = payload.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plano?.body?.data) return decodificarBase64Url(plano.body.data);

  const html = payload.parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html?.body?.data) return htmlATexto(decodificarBase64Url(html.body.data));

  // multipart/alternative o multipart/mixed anidado: buscar en las sub-partes.
  for (const parte of payload.parts) {
    if (parte.parts) {
      const anidado = extraerCuerpo(parte);
      if (anidado) return anidado;
    }
  }
  return "";
}

function cabecera(headers: CabeceraGmail[], nombre: string): string {
  return headers.find((h) => h.name.toLowerCase() === nombre.toLowerCase())?.value ?? "";
}

function extraerDireccion(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

// Cada llamada a Gmail se corta a los 20 s: con mala señal la sincronización
// falla con un mensaje claro en vez de quedarse colgada.
const fetchGmail = crearFetchConTimeout({ ms: 20_000 });

async function llamarGmail(path: string): Promise<any> {
  const token = await obtenerAccessToken();
  const res = await fetchGmail(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Gmail respondió ${res.status}: ${detalle.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Mismo contrato que `traerCorreosNuevos` de graphMail.ts, para que el resto
 * de la app no distinga el proveedor. Pagina la lista (antes solo leía 40 y
 * el resto se perdía) y descarga los mensajes de a 10: uno que falle no tumba
 * la búsqueda, se cuenta en `fallidos`.
 */
export async function traerCorreosNuevos(desde: Date, tope = TOPE_CORREOS): Promise<CorreosTraidos> {
  const q = encodeURIComponent(consultaGmail(desde));
  const { items: ids, truncado } = await juntarPaginas<string>(async (siguiente) => {
    const pagina = await llamarGmail(
      `/messages?q=${q}&maxResults=100${siguiente ? `&pageToken=${encodeURIComponent(siguiente)}` : ""}`
    );
    return { items: (pagina.messages ?? []).map((m: { id: string }) => m.id), siguiente: pagina.nextPageToken };
  }, tope);

  const { resultados: mensajes, fallidos, primerError } = await enLotes(ids, 10, (id) =>
    llamarGmail(`/messages/${encodeURIComponent(id)}?format=full`) as Promise<MensajeGmail>
  );
  // Si no se pudo leer ninguno, el problema es general (red, permiso): se muestra.
  if (mensajes.length === 0 && fallidos > 0) throw primerError;

  const correos = mensajes.map((m): CorreoRecibido => {
    const headers = m.payload.headers ?? [];
    const fecha = fechaLocal(new Date(Number(m.internalDate)));
    return {
      mensajeId: m.id,
      remitente: extraerDireccion(cabecera(headers, "From")),
      asunto: cabecera(headers, "Subject"),
      cuerpoTexto: extraerCuerpo(m.payload),
      fecha,
    };
  });
  return { correos, truncado, fallidos };
}
