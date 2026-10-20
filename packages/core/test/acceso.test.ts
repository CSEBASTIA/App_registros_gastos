import { test } from "node:test";
import assert from "node:assert/strict";
import { setSupabaseClient } from "../src/client.ts";
import { mensajeError } from "../src/lib/mensajeError.ts";
import {
  cambiarContrasena,
  MENSAJE_RECUPERACION_ENVIADA,
  parametrosDeEnlace,
  sesionDesdeEnlace,
  solicitarRecuperacion,
  validarContrasena,
} from "../src/repositories/acceso.repo.ts";

/** Cliente falso de Auth: anota cada llamada. */
function authFalso(respuestas: Record<string, unknown> = {}) {
  const llamadas: [string, unknown][] = [];
  const responder = (nombre: string) => async (...args: unknown[]) => {
    llamadas.push([nombre, args.length === 1 ? args[0] : args]);
    return { data: {}, error: respuestas[nombre] ?? null };
  };
  setSupabaseClient({
    auth: {
      resetPasswordForEmail: responder("resetPasswordForEmail"),
      exchangeCodeForSession: responder("exchangeCodeForSession"),
      setSession: responder("setSession"),
      updateUser: responder("updateUser"),
    },
  } as any);
  return llamadas;
}

test("validarContrasena: 8 caracteres o más, con letras y números", () => {
  assert.equal(validarContrasena("corta1"), "La contraseña debe tener al menos 8 caracteres.");
  assert.equal(validarContrasena("solamenteletras"), "La contraseña debe tener al menos un número.");
  assert.equal(validarContrasena("12345678"), "La contraseña debe tener al menos una letra.");
  assert.equal(validarContrasena("x".repeat(70) + "123"), "La contraseña no puede pasar de 72 caracteres.");
  assert.equal(validarContrasena("Quito2026"), null);
  assert.equal(validarContrasena("ñandú2026"), null);
});

test("solicitarRecuperacion: normaliza el correo, manda la dirección de vuelta y responde siempre lo mismo", async () => {
  const llamadas = authFalso();
  const mensaje = await solicitarRecuperacion("  Ana@Correo.COM ", "gastosapp://restablecer");
  assert.equal(mensaje, MENSAJE_RECUPERACION_ENVIADA);
  assert.deepEqual(llamadas, [["resetPasswordForEmail", ["ana@correo.com", { redirectTo: "gastosapp://restablecer" }]]]);
});

test("solicitarRecuperacion: un correo inválido no llega a Supabase", async () => {
  const llamadas = authFalso();
  await assert.rejects(solicitarRecuperacion("no-es-correo", "gastosapp://restablecer"), (err) => {
    assert.equal(mensajeError(err), "Escribe un correo válido.");
    return true;
  });
  assert.equal(llamadas.length, 0);
});

test("parametrosDeEnlace: lee la consulta y el fragmento, también en enlaces de Expo Go", () => {
  assert.deepEqual(parametrosDeEnlace("gastosapp://restablecer?code=abc%2B1"), { code: "abc+1" });
  assert.deepEqual(parametrosDeEnlace("exp://192.168.100.16:8081/--/restablecer?code=xyz"), { code: "xyz" });
  assert.deepEqual(parametrosDeEnlace("https://app.vercel.app/restablecer#error=access_denied&error_code=otp_expired"), {
    error: "access_denied",
    error_code: "otp_expired",
  });
});

test("sesionDesdeEnlace: canjea el código PKCE del enlace", async () => {
  const llamadas = authFalso();
  await sesionDesdeEnlace("gastosapp://restablecer?code=codigo-123");
  assert.deepEqual(llamadas, [["exchangeCodeForSession", "codigo-123"]]);
});

test("sesionDesdeEnlace: rechaza enlaces con la sesión en el fragmento (no deja a nadie conectado a una cuenta ajena)", async () => {
  const llamadas = authFalso();
  await assert.rejects(
    sesionDesdeEnlace("gastosapp://restablecer#access_token=del-atacante&refresh_token=x&type=recovery"),
    /no es válido/
  );
  assert.equal(llamadas.length, 0, "no se abre ninguna sesión");
});

test("sesionDesdeEnlace: un enlace vencido da un mensaje claro", async () => {
  authFalso();
  await assert.rejects(sesionDesdeEnlace("gastosapp://restablecer#error=access_denied&error_code=otp_expired"), /venció o ya se usó/);
});

test("sesionDesdeEnlace: si el código es de otro dispositivo, Supabase lo rechaza y se explica", async () => {
  authFalso({ exchangeCodeForSession: { name: "AuthApiError", code: "flow_state_not_found", message: "invalid flow state" } });
  await assert.rejects(sesionDesdeEnlace("gastosapp://restablecer?code=ajeno"), (err) => {
    assert.match(mensajeError(err), /otro dispositivo/);
    return true;
  });
});

test("cambiarContrasena: valida y confirma antes de llamar a Supabase", async () => {
  const llamadas = authFalso();
  await assert.rejects(cambiarContrasena("corta1", "corta1"), /al menos 8/);
  await assert.rejects(cambiarContrasena("Quito2026", "Quito2027"), /no coinciden/);
  assert.equal(llamadas.length, 0);
  await cambiarContrasena("Quito2026", "Quito2026");
  assert.deepEqual(llamadas, [["updateUser", { password: "Quito2026" }]]);
});

test("mensajeError: los errores de inicio de sesión de Supabase salen en español", () => {
  const authError = (code: string | undefined, message: string) => Object.assign(new Error(message), { name: "AuthApiError", code, status: 400 });
  assert.equal(mensajeError(authError("invalid_credentials", "Invalid login credentials")), "Correo o contraseña incorrectos.");
  assert.equal(mensajeError(authError(undefined, "Invalid login credentials")), "Correo o contraseña incorrectos.");
  assert.match(mensajeError(authError("email_not_confirmed", "Email not confirmed")), /confirmaste tu correo/);
  assert.match(mensajeError(authError("over_email_send_rate_limit", "For security purposes...")), /Espera unos minutos/);
  assert.match(mensajeError(authError("same_password", "New password should be different")), /distinta de la anterior/);
  // Un mensaje desconocido sigue pasando tal cual.
  assert.equal(mensajeError(authError("algo_nuevo", "Mensaje nuevo")), "Mensaje nuevo");
});

test("mensajeError: un fallo del servidor nunca muestra su texto interno", () => {
  const fallo = (status: number, code: string | undefined, message: string) => Object.assign(new Error(message), { name: "AuthApiError", code, status });
  const generico = "El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.";
  assert.equal(mensajeError(fallo(500, "unexpected_failure", "Database error querying schema")), generico);
  assert.equal(mensajeError(fallo(500, undefined, 'pq: password authentication failed for user "usuario_prueba" at 10.0.0.1:5432')), generico);
  assert.equal(mensajeError(fallo(503, undefined, "upstream connect error")), generico);
  // Lo conocido se sigue traduciendo aunque venga con 429.
  assert.match(mensajeError(fallo(429, "over_request_rate_limit", "Request rate limit reached")), /Demasiados intentos/);
  // Sin red sigue siendo "sin conexión".
  assert.match(mensajeError(Object.assign(new Error("Failed to fetch"), { status: 0 })), /conexión a internet/);
});
