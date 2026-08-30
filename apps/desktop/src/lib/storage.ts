import { getSupabaseClient } from "core";

const BUCKET_FACTURAS = "facturas";

/**
 * Sube una factura (PDF o imagen) al bucket privado "facturas", bajo
 * "<usuario_id>/<archivo>" — ese primer segmento es lo que usan las RLS
 * policies del bucket para que cada quien solo vea/suba/borre lo suyo.
 * Devuelve la ruta (no una URL pública: el bucket es privado).
 */
export async function subirFactura(archivo: File): Promise<string> {
  const { data: usuario, error: errorUsuario } = await getSupabaseClient().auth.getUser();
  if (errorUsuario) throw errorUsuario;
  if (!usuario.user) throw new Error("No hay sesión activa.");

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "";
  const nombreUnico = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const ruta = `${usuario.user.id}/${nombreUnico}`;

  const { error } = await getSupabaseClient()
    .storage.from(BUCKET_FACTURAS)
    .upload(ruta, archivo, { contentType: archivo.type || undefined });

  if (error) throw error;
  return ruta;
}

/** Genera una URL temporal (1 hora) para ver/descargar una factura ya subida. */
export async function urlFactura(ruta: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from(BUCKET_FACTURAS)
    .createSignedUrl(ruta, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarFactura(ruta: string): Promise<void> {
  const { error } = await getSupabaseClient().storage.from(BUCKET_FACTURAS).remove([ruta]);
  if (error) throw error;
}
