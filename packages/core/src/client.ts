import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";

let client: SupabaseClient<Database>;

/** Cada app (mobile/desktop) pasa aquí su propio cliente ya configurado. */
export function setSupabaseClient(supabaseClient: SupabaseClient<Database>) {
  client = supabaseClient;
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    throw new Error(
      "Supabase client no inicializado. Llama a setSupabaseClient() primero."
    );
  }
  return client;
}
