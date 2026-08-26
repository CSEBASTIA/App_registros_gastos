// Este archivo se genera automáticamente con:
//   pnpm supabase:types
// (requiere `supabase start` corriendo localmente)
//
// Mientras tanto se mantiene a mano, reflejando el esquema real de
// supabase/migrations/*.sql, para que el resto del código tipe correctamente.
// Cuando corran `pnpm supabase:types` esto se sobrescribe con la versión real.
export type Database = {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: string;
          nombre: string;
          color: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          color?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          color?: string;
        };
      };
      gastos: {
        Row: {
          id: string;
          monto: number;
          descripcion: string;
          categoria_id: string | null;
          fecha: string;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          monto: number;
          descripcion: string;
          categoria_id?: string | null;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          monto?: number;
          descripcion?: string;
          categoria_id?: string | null;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
      };
      presupuestos: {
        Row: {
          id: string;
          categoria_id: string | null;
          monto_limite: number;
          mes: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          categoria_id?: string | null;
          monto_limite: number;
          mes: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          categoria_id?: string | null;
          monto_limite?: number;
          mes?: string;
          usuario_id?: string;
        };
      };
    };
  };
};
