import { z } from "zod";

export const categoriaSchema = z.object({
  nombre: z.string().min(1),
  color: z.string().min(1).default("#6b7280"),
  tipo: z.enum(["gasto", "ingreso"]),
});

export type CategoriaInput = z.infer<typeof categoriaSchema>;
