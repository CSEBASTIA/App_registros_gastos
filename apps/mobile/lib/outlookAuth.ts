import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

// `expo-secure-store` no tiene implementación en web (no hay Keychain/Keystore
// del navegador) — sin este guard, cualquier pantalla que llame a
// `hayCorreoConectado()` en el build web queda en blanco por una promesa
// rechazada sin capturar. En nativo (iOS/Android, el target real de esta
// función) estas llamadas sí usan el almacenamiento seguro del dispositivo.
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
    /* no-op: si el dispositivo no puede guardar el token, la próxima llamada que lo necesite fallará con un mensaje claro */
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
 * Client ID del App Registration en Azure AD (portal.azure.com → Microsoft
 * Entra ID → App registrations). Placeholder hasta que exista uno real —
 * ver instrucciones en `app/correo.tsx`.
 */
const CLIENT_ID = process.env.EXPO_PUBLIC_MS_CLIENT_ID ?? "";

const DISCOVERY = {
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

// offline_access: necesario para recibir un refresh token (si no, hay que volver a loguearse cada ~1h).
const SCOPES = ["openid", "profile", "offline_access", "Mail.Read"];

const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: "gastosapp", path: "redirect" });

const CLAVE_REFRESH = "outlook_refresh_token";
const CLAVE_ACCESS = "outlook_access_token";
const CLAVE_EXPIRA = "outlook_access_expira";

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

/** Abre el login de Microsoft y, si el usuario acepta, guarda los tokens en el dispositivo (nunca en Supabase). */
export async function conectarCorreo(): Promise<void> {
  if (!correoConfigurado()) {
    throw new Error("Falta configurar EXPO_PUBLIC_MS_CLIENT_ID — ver la pantalla Correo para las instrucciones.");
  }

  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });

  const resultado = await request.promptAsync(DISCOVERY);
  if (resultado.type === "cancel" || resultado.type === "dismiss") {
    throw new Error("Cancelaste la conexión con el correo.");
  }
  if (resultado.type !== "success") {
    throw new Error("No se pudo conectar con Outlook.");
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

export async function desconectarCorreo(): Promise<void> {
  await borrarSeguro(CLAVE_REFRESH);
  await borrarSeguro(CLAVE_ACCESS);
  await borrarSeguro(CLAVE_EXPIRA);
}

/** Devuelve un access token vigente para llamar a Microsoft Graph, renovándolo solo si ya venció. */
export async function obtenerAccessToken(): Promise<string> {
  const expiraRaw = await obtenerSeguro(CLAVE_EXPIRA);
  const sigueVigente = expiraRaw !== null && Number(expiraRaw) > Date.now() + 30_000;
  if (sigueVigente) {
    const actual = await obtenerSeguro(CLAVE_ACCESS);
    if (actual) return actual;
  }

  const refreshToken = await obtenerSeguro(CLAVE_REFRESH);
  if (!refreshToken) throw new Error("El correo no está conectado.");

  const renovado = await AuthSession.refreshAsync({ clientId: CLIENT_ID, refreshToken }, DISCOVERY);
  await guardarTokens(renovado);
  return renovado.accessToken;
}
