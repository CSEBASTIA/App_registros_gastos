import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAXIMO_TARJETAS_FAVORITAS } from "core";
import { supabase } from "./supabase";

/**
 * Las tarjetas que la persona marcó con estrella para verlas en el Resumen.
 * Es una preferencia de pantalla: se guarda en el teléfono, por persona (solo
 * los ids de las tarjetas, ningún dato de ellas).
 */
async function clave(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  return id ? `tarjetas_favoritas:${id}` : null;
}

export async function leerTarjetasFavoritas(): Promise<string[]> {
  try {
    const k = await clave();
    if (!k) return [];
    const guardado = JSON.parse((await AsyncStorage.getItem(k)) ?? "[]");
    return Array.isArray(guardado) ? guardado.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Marca o desmarca una tarjeta. Devuelve la lista nueva (como mucho 4). */
export async function cambiarTarjetaFavorita(id: string, favorita: boolean): Promise<string[]> {
  const actuales = await leerTarjetasFavoritas();
  const nuevas = favorita
    ? [...actuales.filter((x) => x !== id), id].slice(-MAXIMO_TARJETAS_FAVORITAS)
    : actuales.filter((x) => x !== id);
  try {
    const k = await clave();
    if (k) await AsyncStorage.setItem(k, JSON.stringify(nuevas));
  } catch {
    // Es solo una preferencia de pantalla.
  }
  return nuevas;
}
