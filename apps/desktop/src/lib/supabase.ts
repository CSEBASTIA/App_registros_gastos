import { createClient } from "@supabase/supabase-js";
import { setSupabaseClient, crearFetchConTimeout } from "core";
import type { Database } from "core/src/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
  // Toda petición a Supabase (datos, auth y Storage) se corta a los 15 s
  // (60 s para subir archivos) en vez de quedarse esperando para siempre.
  global: { fetch: crearFetchConTimeout() as typeof fetch },
});

// Le pasamos el cliente ya configurado a `core` para que los
// repositorios y casos de uso compartidos puedan usarlo.
setSupabaseClient(supabase);
