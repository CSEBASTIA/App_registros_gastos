import { getSupabaseClient } from "../client";
import type { Categoria } from "../types/domain";

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await getSupabaseClient()
    .from("categorias")
    .select("*")
    .order("nombre");

  if (error) throw error;
  return data as Categoria[];
}
