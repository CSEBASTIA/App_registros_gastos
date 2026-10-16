import { getSupabaseClient } from "../client";
import { z } from "zod";

/**
 * Una clave de captura: lo que el atajo del iPhone usa para dejar pagos en la
 * bandeja. La clave en sí solo se ve al crearla; la lista muestra el nombre,
 * el prefijo (para reconocerla) y cuándo se usó por última vez.
 */
export interface ClaveCaptura {
  id: string;
  nombre: string;
  /** Primeros 6 caracteres después de "ft_". */
  prefijo: string;
  createdAt: string;
  ultimoUso?: string;
}

export const MAXIMO_CLAVES_CAPTURA = 5;

const nombreClaveSchema = z
  .string()
  .trim()
  .min(1, "Ponle un nombre, por ejemplo «Mi iPhone».")
  .max(40, "Máximo 40 caracteres.");

/**
 * Crea una clave para un dispositivo y la devuelve. **Es la única vez que se
 * puede ver**: la base guarda solo su huella. Mostrarla con un botón de copiar
 * y no guardarla en ningún lado de la app.
 */
export async function crearClaveCaptura(nombre: string): Promise<string> {
  const limpio = nombreClaveSchema.parse(nombre);
  const { data, error } = await getSupabaseClient().rpc("crear_clave_captura", { p_nombre: limpio });
  if (error) throw error;
  return data as string;
}

/** Las claves del usuario, la más nueva primero. (La huella no se puede leer.) */
export async function listarClavesCaptura(): Promise<ClaveCaptura[]> {
  const { data, error } = await getSupabaseClient()
    .from("claves_captura")
    .select("id, nombre, prefijo, created_at, ultimo_uso")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    prefijo: r.prefijo,
    createdAt: r.created_at,
    ultimoUso: r.ultimo_uso ?? undefined,
  }));
}

/** Revoca una clave: el atajo que la usa deja de funcionar. Los avisos que ya llegaron se quedan. */
export async function revocarClaveCaptura(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("claves_captura").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Lo que hay que poner en la acción «Obtener contenido de URL» del atajo.
 * La clave pública de Supabase va en el encabezado `apikey` (es pública por
 * diseño); la clave de captura va en el CUERPO, nunca en la URL, para que no
 * quede en registros de servidores ni en el historial.
 */
export function configuracionAtajo(supabaseUrl: string, clavePublica: string) {
  return {
    url: `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/registrar_pago_billetera`,
    metodo: "POST" as const,
    encabezados: { apikey: clavePublica, "Content-Type": "application/json" },
    /** Campos del cuerpo JSON. Solo `p_clave` y `p_monto` son obligatorios. */
    campos: ["p_clave", "p_monto", "p_comercio", "p_tarjeta", "p_latitud", "p_longitud", "p_precision"] as const,
  };
}

/** La app de Google Wallet en Android: solo sus notificaciones se leen. */
export const PAQUETE_GOOGLE_WALLET = "com.google.android.apps.walletnfcrel";

/**
 * Para la app de Android (y para MacroDroid o Tasker): se envían el título y
 * el texto de la notificación de Google Wallet, y la base lee el monto, el
 * comercio y la tarjeta. Como en el atajo, la clave de captura va en el cuerpo.
 */
export function configuracionGoogleWallet(supabaseUrl: string, clavePublica: string) {
  return {
    url: `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/registrar_aviso_billetera`,
    metodo: "POST" as const,
    encabezados: { apikey: clavePublica, "Content-Type": "application/json" },
    /** `p_clave` es obligatorio; `p_cuando` es la hora de la notificación en milisegundos. */
    campos: ["p_clave", "p_titulo", "p_texto", "p_paquete", "p_cuando"] as const,
    paquete: PAQUETE_GOOGLE_WALLET,
  };
}
