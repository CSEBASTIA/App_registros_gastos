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
          tasa_interes: number | null;
          fecha: string;
          created_at: string;
          billetera: string | null;
          latitud: number | null;
          longitud: number | null;
          precision_m: number | null;
          lugar_id: string | null;
          pagado_en: string | null;
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
          tasa_interes?: number | null;
          fecha?: string;
          created_at?: string;
          billetera?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          precision_m?: number | null;
          lugar_id?: string | null;
          pagado_en?: string | null;
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
          tasa_interes?: number | null;
          fecha?: string;
          created_at?: string;
          billetera?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          precision_m?: number | null;
          lugar_id?: string | null;
          pagado_en?: string | null;
          usuario_id?: string;
        };
        Relationships: [];
      };
      lugares: {
        Row: {
          id: string;
          nombre: string;
          latitud: number;
          longitud: number;
          radio_m: number;
          created_at: string;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          latitud: number;
          longitud: number;
          radio_m?: number;
          created_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          latitud?: number;
          longitud?: number;
          radio_m?: number;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      claves_captura: {
        Row: {
          id: string;
          usuario_id: string;
          nombre: string;
          prefijo: string;
          created_at: string;
          ultimo_uso: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // Solo se lee: se escribe con `registrar_aceptacion_legal` (y en el registro, con un disparador).
      aceptaciones_legales: {
        Row: {
          id: string;
          usuario_id: string;
          documento: string;
          version: string;
          plataforma: string | null;
          origen: string;
          aceptado_en: string;
        };
        Insert: never;
        Update: never;
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
          identificador: string | null;
          dia_corte: number | null;
          dia_pago: number | null;
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
          identificador?: string | null;
          dia_corte?: number | null;
          dia_pago?: number | null;
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
          identificador?: string | null;
          dia_corte?: number | null;
          dia_pago?: number | null;
          disponible?: number;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      transacciones_detectadas: {
        Row: {
          id: string;
          mensaje_id: string;
          tipo: string;
          monto: number;
          descripcion: string;
          banco: string | null;
          cuenta_id: string | null;
          categoria_id: string | null;
          fecha: string;
          correo_asunto: string | null;
          estado: string;
          created_at: string;
          origen: string;
          comercio: string | null;
          latitud: number | null;
          longitud: number | null;
          precision_m: number | null;
          tarjeta_final: string | null;
          clave_captura_id: string | null;
          pagado_en: string | null;
          usuario_id: string;
        };
        Insert: {
          id?: string;
          mensaje_id: string;
          tipo: string;
          monto: number;
          descripcion: string;
          banco?: string | null;
          cuenta_id?: string | null;
          categoria_id?: string | null;
          fecha: string;
          correo_asunto?: string | null;
          estado?: string;
          created_at?: string;
          origen?: string;
          comercio?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          precision_m?: number | null;
          tarjeta_final?: string | null;
          clave_captura_id?: string | null;
          pagado_en?: string | null;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          mensaje_id?: string;
          tipo?: string;
          monto?: number;
          descripcion?: string;
          banco?: string | null;
          cuenta_id?: string | null;
          categoria_id?: string | null;
          fecha?: string;
          correo_asunto?: string | null;
          estado?: string;
          created_at?: string;
          origen?: string;
          comercio?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          precision_m?: number | null;
          tarjeta_final?: string | null;
          clave_captura_id?: string | null;
          pagado_en?: string | null;
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
          interes_cuota_pendiente: number;
          capital_cuota_pendiente: number;
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
          interes_cuota_pendiente?: number;
          capital_cuota_pendiente?: number;
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
          interes_cuota_pendiente?: number;
          capital_cuota_pendiente?: number;
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
          automatico: boolean;
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
          automatico?: boolean;
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
          automatico?: boolean;
          created_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      abonos_deuda: {
        Row: {
          id: string;
          usuario_id: string;
          deuda_id: string;
          cuenta_id: string | null;
          monto: number;
          fecha: string;
          created_at: string;
        };
        // Solo se escribe vía la función registrar_abono_deuda.
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      registrar_abono_deuda: {
        Args: {
          p_deuda_id: string;
          p_monto: number;
          p_cuenta_id?: string | null;
          p_fecha?: string | null;
        };
        Returns: Database["public"]["Tables"]["deudas"]["Row"];
      };
      confirmar_transaccion_detectada: {
        Args: {
          p_id: string;
          p_monto: number;
          p_descripcion: string;
          p_categoria_id?: string | null;
          p_cuenta_id?: string | null;
        };
        /** Id del gasto/ingreso creado, o null si el aviso ya estaba confirmado. */
        Returns: string | null;
      };
      eliminar_mi_cuenta: {
        Args: { p_confirmacion: string };
        Returns: undefined;
      };
      registrar_aceptacion_legal: {
        Args: { p_documento: string; p_version: string; p_plataforma?: string };
        Returns: undefined;
      };
      totales_por_mes: {
        Args: { p_desde: string; p_hasta: string };
        Returns: { mes: string; total_gastos: number; total_ingresos: number }[];
      };
      borrar_mis_ubicaciones: {
        Args: Record<PropertyKey, never>;
        Returns: { gastos: number; avisos: number; lugares: number };
      };
      crear_clave_captura: {
        Args: { p_nombre: string };
        /** La clave, que solo se ve esta vez. */
        Returns: string;
      };
      resumen_por_lugar: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          lugar_id: string;
          nombre: string;
          latitud: number;
          longitud: number;
          pagos: number;
          total: number;
          promedio: number;
          porcentaje: number | null;
          primer_pago: string;
          ultimo_pago: string;
          categoria_id: string | null;
          billetera: string | null;
        }[];
      };
      resumen_por_comercio: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          comercio: string;
          locales: number;
          pagos: number;
          total: number;
          promedio: number;
          ultimo_pago: string;
          lugar_ids: string[] | null;
        }[];
      };
      fusionar_lugares: {
        Args: { p_origen: string; p_destino: string };
        /** Cuántos pagos se movieron. */
        Returns: number;
      };
    };
  };
};
