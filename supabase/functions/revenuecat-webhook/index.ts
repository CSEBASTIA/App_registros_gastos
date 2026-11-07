// Recibe los avisos de RevenueCat (compras, renovaciones, cancelaciones y
// vencimientos de los planes Plus y Pro) y los aplica con
// `registrar_evento_revenuecat` (migración 20261025120000_planes_usuario).
//
// RevenueCat no manda la sesión de Supabase: esta función se publica sin
// verificar JWT y en su lugar exige la clave secreta que se configura en
// RevenueCat como "Authorization header":
//
//   supabase secrets set REVENUECAT_WEBHOOK_SECRETO=<clave larga al azar>
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// En RevenueCat → Integrations → Webhooks: la URL de esta función y, como
// Authorization header, "Bearer <la misma clave>".
//
// Si la base falla se responde 500 y RevenueCat reintenta; los avisos
// repetidos no se aplican dos veces.
import { createClient } from "jsr:@supabase/supabase-js@2";

/** Compara sin cortar en el primer carácter distinto, para no filtrar la clave por el tiempo de respuesta. */
function igualSeguro(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diferencia = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferencia === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const secreto = Deno.env.get("REVENUECAT_WEBHOOK_SECRETO");
  if (!secreto || secreto.length < 32) {
    console.error("Falta REVENUECAT_WEBHOOK_SECRETO (o es demasiado corta)");
    return new Response("No configurado", { status: 500 });
  }
  if (!igualSeguro(req.headers.get("authorization") ?? "", `Bearer ${secreto}`)) {
    return new Response("No autorizado", { status: 401 });
  }

  const cuerpo = await req.json().catch(() => null);
  const evento = cuerpo?.event;
  if (!evento || typeof evento.id !== "string" || typeof evento.type !== "string") {
    return new Response("Aviso inválido", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("registrar_evento_revenuecat", { p_evento: evento });
  if (error) {
    // Sin el contenido del aviso en el registro: lleva el id de la persona.
    console.error("registrar_evento_revenuecat:", error.code, error.message);
    return new Response("Error al registrar", { status: 500 });
  }
  return Response.json({ resultado: data });
});
