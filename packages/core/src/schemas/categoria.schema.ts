import { z } from "zod";
import { LIMITES, textoRequerido } from "./limites";

export const categoriaSchema = z.object({
  nombre: textoRequerido(LIMITES.nombre),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").default("#6b7280"),
  tipo: z.enum(["gasto", "ingreso"]),
});

export type CategoriaInput = z.infer<typeof categoriaSchema>;
