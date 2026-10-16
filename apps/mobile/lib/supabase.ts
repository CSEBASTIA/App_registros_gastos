import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { setSupabaseClient, crearFetchConTimeout } from "core";
import type { Database } from "core/src/types/database";
import { olvidarCorreoDelDispositivo } from "./correoProveedor";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Los enlaces del correo (recuperar contraseña) traen un código que solo
    // se canjea en este dispositivo: nadie puede armar uno que deje a otra
    // persona conectada a una cuenta ajena. Ver sesionDesdeEnlace en core.
    flowType: "pkce",
  },
  // Toda petición a Supabase (datos, auth y Storage) se corta a los 15 s
  // (60 s para subir archivos) en vez de quedarse esperando para siempre.
  global: { fetch: crearFetchConTimeout() as typeof fetch },
});

// Le pasamos el cliente ya configurado a `core` para que los
// repositorios y casos de uso compartidos puedan usarlo.
setSupabaseClient(supabase);

// Al cerrar sesión (o si la sesión caduca), el correo conectado en este
// teléfono se olvida: no debe pasar a la siguiente persona que inicie sesión.
supabase.auth.onAuthStateChange((evento) => {
  if (evento === "SIGNED_OUT") void olvidarCorreoDelDispositivo();
});
