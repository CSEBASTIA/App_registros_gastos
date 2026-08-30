import { getSupabaseClient } from "../client";
import type { Categoria } from "../types/domain";
import type { Database } from "../types/database";
import type { CategoriaInput } from "../schemas/categoria.schema";

type CategoriaRow = Database["public"]["Tables"]["categorias"]["Row"];

function filaACategoria(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    nombre: row.nombre,
    color: row.color,
    tipo: row.tipo as Categoria["tipo"],
    usuarioId: row.usuario_id ?? undefined,
  };
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await getSupabaseClient()
    .from("categorias")
    .select("*")
    .order("nombre");

  if (error) throw error;
  return (data ?? []).map(filaACategoria);
}

export async function crearCategoria(categoria: CategoriaInput): Promise<Categoria> {
  const { data: usuario } = await getSupabaseClient().auth.getUser();
  const { data, error } = await getSupabaseClient()
    .from("categorias")
    .insert({
      nombre: categoria.nombre,
      color: categoria.color,
      tipo: categoria.tipo,
      usuario_id: usuario.user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return filaACategoria(data);
}

export async function actualizarCategoria(
  id: string,
  cambios: Partial<Pick<CategoriaInput, "nombre" | "color">>
): Promise<Categoria> {
  const { data, error } = await getSupabaseClient()
    .from("categorias")
    .update({
      ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}),
      ...(cambios.color !== undefined ? { color: cambios.color } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return filaACategoria(data);
}

export async function eliminarCategoria(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("categorias").delete().eq("id", id);
  if (error) throw error;
}
