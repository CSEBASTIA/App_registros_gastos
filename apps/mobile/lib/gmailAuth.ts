import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { crearFetchConTimeout, esPermisoRetirado, MENSAJE_PERMISO_CORREO_VENCIDO } from "core";

WebBrowser.maybeCompleteAuthSession();

// Mismo motivo que en outlookAuth.ts: expo-secure-store no existe en web.
async function obtenerSeguro(clave: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}
async function guardarSeguro(clave: string, valor: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(clave, valor);
  } catch {
    /* no-op */
  }
}
async function borrarSeguro(clave: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(clave);
  } catch {
    /* no-op */
  }
}

/**
 * Client ID de un OAuth Client (tipo "Web application") creado en Google
 * Cloud Console → APIs & Services → Credentials. Placeholder hasta que
 * exista uno real — ver instrucciones en `app/correo.tsx`.
 */
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: "gastosapp", path: "redirect" });

const CLAVE_REFRESH = "gmail_refresh_token";
const CLAVE_ACCESS = "gmail_access_token";
const CLAVE_EXPIRA = "gmail_access_expira";

export function correoConfigurado(): boolean {
  return CLIENT_ID.length > 0;
}

export async function hayCorreoConectado(): Promise<boolean> {
  const token = await obtenerSeguro(CLAVE_REFRESH);
  return !!token;
}

async function guardarTokens(t: AuthSession.TokenResponse): Promise<void> {
  if (t.refreshToken) await guardarSeguro(CLAVE_REFRESH, t.refreshToken);
  await guardarSeguro(CLAVE_ACCESS, t.accessToken);
  const expiraEn = Date.now() + (t.expiresIn ?? 3600) * 1000;
  await guardarSeguro(CLAVE_EXPIRA, String(expiraEn));
}

/** Abre el login de Google y, si el usuario acepta, guarda los tokens en el dispositivo (nunca en Supabase). */
export async function conectarCorreo(): Promise<void> {
  if (!correoConfigurado()) {
    throw new Error("Falta configurar EXPO_PUBLIC_GOOGLE_CLIENT_ID — ver la pantalla Correo para las instrucciones.");
  }

  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
    // access_type=offline + prompt=consent: sin esto Google no siempre entrega
    // refresh token (solo lo da la primera vez que el usuario da consentimiento).
    extraParams: { access_type: "offline", prompt: "consent" },
  });

  const resultado = await request.promptAsync(DISCOVERY);
  if (resultado.type === "cancel" || resultado.type === "dismiss") {
    throw new Error("Cancelaste la conexión con el correo.");
  }
  if (resultado.type !== "success") {
    throw new Error("No se pudo conectar con Gmail.");
  }

  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: resultado.params.code,
      redirectUri: REDIRECT_URI,
      extraParams: { code_verifier: request.codeVerifier ?? "" },
    },
    DISCOVERY
  );
  await guardarTokens(tokens);
}

// La revocación es una llamada corta: si la red falla, igual se borran los tokens.
const fetchRevocar = crearFetchConTimeout({ ms: 10_000 });

/**
 * Revoca el acceso ante Google (el refresh token deja de servir en sus
 * servidores, no solo en este teléfono) y borra los tokens locales. Es de
 * "mejor esfuerzo": sin internet se borran los tokens igual y la persona puede
 * quitar el permiso en myaccount.google.com/permissions.
 */
export async function desconectarCorreo(): Promise<{ revocado: boolean }> {
  const token = (await obtenerSeguro(CLAVE_REFRESH)) ?? (await obtenerSeguro(CLAVE_ACCESS));
  // Primero se borran del teléfono (al cerrar sesión, quien entre después no
  // debe poder usarlos ni un segundo) y luego se revocan en Google.
  await borrarTokens();
  let revocado = false;
  if (token) {
    try {
      const res = await fetchRevocar("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `token=${encodeURIComponent(token)}`,
      });
      // 400 = el token ya no era válido: el acceso ya estaba revocado.
      revocado = res.ok || res.status === 400;
    } catch {
      revocado = false;
    }
  }
  return { revocado };
}

async function borrarTokens(): Promise<void> {
  await borrarSeguro(CLAVE_REFRESH);
  await borrarSeguro(CLAVE_ACCESS);
  await borrarSeguro(CLAVE_EXPIRA);
}

/** Devuelve un access token vigente para llamar a la API de Gmail, renovándolo solo si ya venció. */
export async function obtenerAccessToken(): Promise<string> {
  const expiraRaw = await obtenerSeguro(CLAVE_EXPIRA);
  const sigueVigente = expiraRaw !== null && Number(expiraRaw) > Date.now() + 30_000;
  if (sigueVigente) {
    const actual = await obtenerSeguro(CLAVE_ACCESS);
    if (actual) return actual;
  }

  const refreshToken = await obtenerSeguro(CLAVE_REFRESH);
  if (!refreshToken) throw new Error("El correo no está conectado.");

  let renovado: AuthSession.TokenResponse;
  try {
    renovado = await AuthSession.refreshAsync({ clientId: CLIENT_ID, refreshToken }, DISCOVERY);
  } catch (err) {
    // Permiso retirado o token caducado: reintentar no sirve. Se borran los
    // tokens (la pantalla pasa a "sin conectar") y se pide reconectar.
    if (esPermisoRetirado(err)) {
      await borrarTokens();
      throw new Error(MENSAJE_PERMISO_CORREO_VENCIDO);
    }
    throw err;
  }
  await guardarTokens(renovado);
  return renovado.accessToken;
}
