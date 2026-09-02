// Este archivo se genera automáticamente con:
//   pnpm supabase:types
// (requiere `supabase start` corriendo localmente)
//
// Mientras tanto se mantiene a mano, reflejando el esquema real de
// supabase/migrations/*.sql, para que el resto del código tipe correctamente.
// Cuando corran `pnpm supabase:types` esto se sobrescribe con la versión real.
//
// Nota: cada tabla lleva `Relationships: []` y el schema `Views`/`Functions`
// vacíos porque @supabase/postgrest-js exige esa forma (GenericTable /
// GenericSchema) para poder tipar `.insert()`/`.update()`; sin ellos el
// cliente cae silenciosamente a `never` y da errores como
// "Object literal may only specify known properties... type 'never[]'".
export type Database = {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: string;
          nombre: string;
          color: string;
          tipo: string;
          usuario_id: string | null;
        };
        Insert: {
          id?: string;
          nombre: string;
          color?: string;
          tipo?: string;
          usuario_id?: string | null;
        };
        Update: {
          id?: string;
          nombre?: string;
          color?: string;
          tipo?: string;
          usuario_id?: string | null;
        };
        Relationships: [];
      };
      gastos: {
        Row: {
          id: string;
          monto: number;
          descripcion: string;
          categoria_id: string | null;
          categoria_detalle: string | null;
          cuenta_id: string | null;
          metodo_pago: string | null;
          factura_path: string | null;
          meses_diferido: number | null;
          fecha: string;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          monto: number;
          descripcion: string;
          categoria_id?: string | null;
          categoria_detalle?: string | null;
          cuenta_id?: string | null;
          metodo_pago?: string | null;
          factura_path?: string | null;
          meses_diferido?: number | null;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          monto?: number;
          descripcion?: string;
          categoria_id?: string | null;
          categoria_detalle?: string | null;
          cuenta_id?: string | null;
          metodo_pago?: string | null;
          factura_path?: string | null;
          meses_diferido?: number | null;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      cuentas: {
        Row: {
          id: string;
          nombre: string;
          tipo: string;
          banco: string;
          marca: string | null;
          estilo: string | null;
          cupo_total: number | null;
          disponible: number;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          tipo: string;
          banco?: string;
          marca?: string | null;
          estilo?: string | null;
          cupo_total?: number | null;
          disponible?: number;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          tipo?: string;
          banco?: string;
          marca?: string | null;
          estilo?: string | null;
          cupo_total?: number | null;
          disponible?: number;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      ingresos: {
        Row: {
          id: string;
          monto: number;
          descripcion: string;
          categoria_id: string | null;
          categoria_detalle: string | null;
          cuenta_id: string | null;
          fecha: string;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          monto: number;
          descripcion: string;
          categoria_id?: string | null;
          categoria_detalle?: string | null;
          cuenta_id?: string | null;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          monto?: number;
          descripcion?: string;
          categoria_id?: string | null;
          categoria_detalle?: string | null;
          cuenta_id?: string | null;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      pagos_tarjeta: {
        Row: {
          id: string;
          cuenta_id: string;
          cuenta_origen_id: string | null;
          monto: number;
          fecha: string;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          cuenta_id: string;
          cuenta_origen_id?: string | null;
          monto: number;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          cuenta_id?: string;
          cuenta_origen_id?: string | null;
          monto?: number;
          fecha?: string;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      deudas: {
        Row: {
          id: string;
          nombre: string;
          tipo: string;
          monto_total: number;
          saldo_pendiente: number;
          cuota_mensual: number;
          tasa_interes: number | null;
          fecha_inicio: string;
          proximo_pago: string | null;
          cuenta_id: string | null;
          gasto_id: string | null;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          tipo: string;
          monto_total: number;
          saldo_pendiente: number;
          cuota_mensual: number;
          tasa_interes?: number | null;
          fecha_inicio?: string;
          proximo_pago?: string | null;
          cuenta_id?: string | null;
          gasto_id?: string | null;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          tipo?: string;
          monto_total?: number;
          saldo_pendiente?: number;
          cuota_mensual?: number;
          tasa_interes?: number | null;
          fecha_inicio?: string;
          proximo_pago?: string | null;
          cuenta_id?: string | null;
          gasto_id?: string | null;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      recordatorios: {
        Row: {
          id: string;
          titulo: string;
          tipo: string;
          monto: number | null;
          fecha: string;
          recurrente: boolean;
          frecuencia: string | null;
          completado: boolean;
          deuda_id: string | null;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          tipo: string;
          monto?: number | null;
          fecha: string;
          recurrente?: boolean;
          frecuencia?: string | null;
          completado?: boolean;
          deuda_id?: string | null;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          titulo?: string;
          tipo?: string;
          monto?: number | null;
          fecha?: string;
          recurrente?: boolean;
          frecuencia?: string | null;
          completado?: boolean;
          deuda_id?: string | null;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
