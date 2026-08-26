import { createClient } from "@supabase/supabase-js";
import { setSupabaseClient } from "core";
import type { Database } from "core/src/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});

// Le pasamos el cliente ya configurado a `core` para que los
// repositorios y casos de uso compartidos puedan usarlo.
setSupabaseClient(supabase);
