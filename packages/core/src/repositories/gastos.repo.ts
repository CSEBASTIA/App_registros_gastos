import { getSupabaseClient } from "../client";
import type { Gasto } from "../types/domain";

export async function listarGastos(): Promise<Gasto[]> {
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) throw error;
  return data as Gasto[];
}

export async function crearGasto(
  gasto: Omit<Gasto, "id" | "createdAt">
): Promise<Gasto> {
  const { data, error } = await getSupabaseClient()
    .from("gastos")
    .insert(gasto)
    .select()
    .single();

  if (error) throw error;
  return data as Gasto;
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("gastos").delete().eq("id", id);
  if (error) throw error;
}
