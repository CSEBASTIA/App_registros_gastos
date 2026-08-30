import { crearCategoria as crearCategoriaRepo } from "../repositories/categorias.repo";
import { categoriaSchema } from "../schemas/categoria.schema";
import type { Categoria } from "../types/domain";

export async function crearCategoria(input: unknown): Promise<Categoria> {
  const data = categoriaSchema.parse(input);
  return crearCategoriaRepo(data);
}
