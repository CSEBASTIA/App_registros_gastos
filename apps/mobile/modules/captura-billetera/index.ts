// Captura de pagos con Google Wallet (Android). El módulo nativo solo existe
// en el APK desde la versión 1.1.0; en Expo Go, iPhone o la web no está, y
// `capturaGoogleWallet` es null.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export type ResultadoCaptura = {
  /** Milisegundos desde 1970. */
  cuando: number;
  /** "registrado": la base reconoció la tarjeta y guardó el gasto sola (APK 1.4.0+). */
  estado: "registrado" | "recibido" | "repetido" | "ignorado" | "pendiente" | "error";
  monto?: number;
  mensaje?: string;
};

export type EstadoCaptura = {
  conectado: boolean;
  /** Los 6 caracteres de la clave que se ven en la lista de claves. */
  prefijo: string | null;
  permiso: boolean;
  pendientes: number;
  ultimo: ResultadoCaptura | null;
};

/** Qué notificaciones muestra el módulo al enviar un pago. */
export type AvisosCaptura = { pagos: boolean; bandeja: boolean; presupuestos: boolean };

type Nativo = {
  estado(): { conectado: boolean; prefijo: string | null; permiso: boolean; pendientes: number; ultimo: string | null };
  conectar(url: string, apikey: string, clave: string): void;
  desconectar(): void;
  abrirPermiso(): void;
  reintentar(): void;
  /** Desde el APK 1.4.0: en uno anterior no existe. */
  ajustarAvisos?: (pagos: boolean, bandeja: boolean, presupuestos: boolean) => void;
};

const nativo = Platform.OS === "android" ? requireOptionalNativeModule<Nativo>("CapturaBilletera") : null;

function leerUltimo(json: string | null): ResultadoCaptura | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ResultadoCaptura;
  } catch {
    return null;
  }
}

export const capturaGoogleWallet = nativo
  ? {
      estado(): EstadoCaptura {
        const e = nativo.estado();
        return { ...e, ultimo: leerUltimo(e.ultimo) };
      },
      conectar: (url: string, apikey: string, clave: string) => nativo.conectar(url, apikey, clave),
      desconectar: () => nativo.desconectar(),
      abrirPermiso: () => nativo.abrirPermiso(),
      reintentar: () => nativo.reintentar(),
      /** Devuelve false si el APK es anterior a 1.4.0 (no sabe mostrar notificaciones). */
      ajustarAvisos(avisos: AvisosCaptura): boolean {
        if (typeof nativo.ajustarAvisos !== "function") return false;
        nativo.ajustarAvisos(avisos.pagos, avisos.bandeja, avisos.presupuestos);
        return true;
      },
    }
  : null;
