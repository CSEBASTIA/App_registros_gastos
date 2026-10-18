import { getSupabaseClient } from "../client";
import type { AjustesUsuario } from "../types/domain";
import { faltaEnLaBase } from "../lib/mensajeError";

/** Sin fila guardada, todo está como viene: el registro automático, encendido. */
export const AJUSTES_POR_DEFECTO: AjustesUsuario = { registroAutomatico: true };

/**
 * Los ajustes que la base necesita conocer (el registro automático lo decide
 * la base, con el teléfono cerrado). En una base sin la migración, los de
 * siempre: ahí tampoco existe el registro automático.
 */
export async function obtenerAjustes(): Promise<AjustesUsuario> {
  const { data, error } = await getSupabaseClient().from("ajustes_usuario").select("registro_automatico").maybeSingle();
  if (error) {
    if (faltaEnLaBase(error)) return { ...AJUSTES_POR_DEFECTO };
    throw error;
  }
  return { registroAutomatico: data?.registro_automatico ?? AJUSTES_POR_DEFECTO.registroAutomatico };
}

/**
 * Guarda los ajustes de quien tiene la sesión (una fila por usuario: la crea
 * la primera vez). `usuario_id` no se envía: lo pone la base con auth.uid().
 */
export async function guardarAjustes(cambios: Partial<AjustesUsuario>): Promise<AjustesUsuario> {
  const actuales = await obtenerAjustes();
  const nuevos: AjustesUsuario = { ...actuales, ...cambios };
  if (typeof nuevos.registroAutomatico !== "boolean") throw new Error("Ajuste inválido.");
  const { data, error } = await getSupabaseClient()
    .from("ajustes_usuario")
    .upsert(
      { registro_automatico: nuevos.registroAutomatico, updated_at: new Date().toISOString() },
      { onConflict: "usuario_id" }
    )
    .select("registro_automatico")
    .single();
  if (error) throw error;
  return { registroAutomatico: data.registro_automatico };
}
