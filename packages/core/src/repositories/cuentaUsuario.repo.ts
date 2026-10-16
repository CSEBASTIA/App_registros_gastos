import { getSupabaseClient } from "../client";

/** Lo que la persona debe escribir para confirmar. La base exige lo mismo. */
export const CONFIRMACION_ELIMINAR_CUENTA = "ELIMINAR";

const BUCKET_FACTURAS = "facturas";

/**
 * Elimina la cuenta de quien tiene la sesión y TODOS sus datos (Google Play
 * lo exige y la ley de protección de datos de Ecuador da ese derecho).
 *
 * 1. Borra sus facturas con la API de Storage: Supabase no deja borrar
 *    archivos con SQL, y la base se niega a seguir si queda alguna.
 * 2. La función `eliminar_mi_cuenta` borra al usuario; sus datos de las 10
 *    tablas se van en cascada.
 * 3. Cierra la sesión en este dispositivo (en el teléfono eso también olvida
 *    el correo conectado).
 *
 * No se puede deshacer. Si falla a mitad (por ejemplo, sin internet tras
 * borrar las facturas), la cuenta sigue existiendo y se puede reintentar.
 */
export async function eliminarMiCuenta(confirmacion: string): Promise<void> {
  if (confirmacion !== CONFIRMACION_ELIMINAR_CUENTA) {
    throw new Error(`Escribe ${CONFIRMACION_ELIMINAR_CUENTA} para confirmar.`);
  }
  const cliente = getSupabaseClient();
  const { data: sesion } = await cliente.auth.getSession();
  const usuario = sesion.session?.user.id;
  if (!usuario) throw new Error("Necesitas iniciar sesión.");

  const facturas = cliente.storage.from(BUCKET_FACTURAS);
  for (let vuelta = 0; vuelta < 100; vuelta++) {
    const { data: archivos, error } = await facturas.list(usuario, { limit: 100 });
    if (error) throw error;
    // Las entradas sin id son carpetas, no archivos.
    const rutas = (archivos ?? []).filter((a) => a.id).map((a) => `${usuario}/${a.name}`);
    if (rutas.length === 0) break;
    const { error: errorBorrar } = await facturas.remove(rutas);
    if (errorBorrar) throw errorBorrar;
  }

  const { error } = await cliente.rpc("eliminar_mi_cuenta", { p_confirmacion: confirmacion });
  if (error) throw error;

  // El usuario ya no existe en el servidor: basta con olvidar la sesión local.
  await cliente.auth.signOut({ scope: "local" });
}
