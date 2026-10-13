/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Login automático de desarrollo (ver App.tsx). Opcionales. */
  readonly VITE_DEV_EMAIL?: string;
  readonly VITE_DEV_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
