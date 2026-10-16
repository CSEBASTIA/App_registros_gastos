import { z } from "zod";
import { getSupabaseClient } from "../client";

/**
 * Contraseñas: al menos 8 caracteres, con letras y números; máximo 72 (el
 * límite de bcrypt, que es lo que usa Supabase). Configurar lo mismo en
 * Supabase → Authentication → Providers → Email → Password requirements, para
 * que la regla no dependa solo de la app.
 */
export const contrasenaSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede pasar de 72 caracteres.")
  .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, "La contraseña debe tener al menos una letra.")
  .regex(/\d/, "La contraseña debe tener al menos un número.");

/** Mensaje del primer requisito que no cumple, o null si es válida. */
export function validarContrasena(contrasena: string): string | null {
  const r = contrasenaSchema.safeParse(contrasena);
  return r.success ? null : r.error.issues[0].message;
}

const correoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un correo válido.")
  .max(254, "Escribe un correo válido.");

/**
 * Siempre el mismo mensaje, exista o no la cuenta: decir "ese correo no está
 * registrado" le permitiría a cualquiera averiguar quién usa la app.
 */
export const MENSAJE_RECUPERACION_ENVIADA =
  "Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Ábrelo en este mismo teléfono.";

/**
 * Envía el correo para crear una contraseña nueva. `redirectTo` es la
 * dirección a la que vuelve el enlace: en el teléfono
 * `Linking.createURL("/restablecer")` (da gastosapp://restablecer, o exp://…
 * en Expo Go); en la web, `${location.origin}/restablecer`. Debe estar en
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export async function solicitarRecuperacion(correo: string, redirectTo: string): Promise<string> {
  const email = correoSchema.parse(correo);
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
  return MENSAJE_RECUPERACION_ENVIADA;
}

/** Lee los parámetros de un enlace (consulta y fragmento). Sin `URL`, que en React Native está incompleto. */
export function parametrosDeEnlace(enlace: string): Record<string, string> {
  const parametros: Record<string, string> = {};
  const [sinFragmento, fragmento = ""] = enlace.split("#");
  const consulta = sinFragmento.includes("?") ? sinFragmento.slice(sinFragmento.indexOf("?") + 1) : "";
  for (const parte of [consulta, fragmento]) {
    for (const par of parte.split("&")) {
      if (!par) continue;
      const i = par.indexOf("=");
      const clave = decodeURIComponent(i === -1 ? par : par.slice(0, i));
      const valor = i === -1 ? "" : decodeURIComponent(par.slice(i + 1).replace(/\+/g, " "));
      parametros[clave] = valor;
    }
  }
  return parametros;
}

/**
 * Abre la sesión que trae el enlace del correo de recuperación. Solo acepta el
 * flujo PKCE (`?code=`): ese código solo se puede canjear en el dispositivo que
 * pidió el correo. Los enlaces con la sesión en el fragmento (`#access_token=`)
 * se rechazan: cualquiera podría armar uno para dejar a otra persona conectada
 * a una cuenta ajena y que cargue ahí sus datos. Requiere `flowType: "pkce"` en
 * el cliente de Supabase. No registrar nunca la URL: lleva el código.
 */
export async function sesionDesdeEnlace(enlace: string): Promise<void> {
  const p = parametrosDeEnlace(enlace);
  if (p.error || p.error_code) {
    throw new Error(
      p.error_code === "otp_expired"
        ? "El enlace venció o ya se usó. Pide uno nuevo."
        : "El enlace no es válido. Pide uno nuevo."
    );
  }
  if (!p.code) throw new Error("El enlace no es válido. Pide uno nuevo desde este teléfono.");
  const { error } = await getSupabaseClient().auth.exchangeCodeForSession(p.code);
  if (error) throw error;
}

/** Cambia la contraseña de la sesión actual (tras abrir el enlace, o desde la app). */
export async function cambiarContrasena(nueva: string, confirmacion: string): Promise<void> {
  const problema = validarContrasena(nueva);
  if (problema) throw new Error(problema);
  if (nueva !== confirmacion) throw new Error("Las contraseñas no coinciden.");
  const { error } = await getSupabaseClient().auth.updateUser({ password: nueva });
  if (error) throw error;
}
