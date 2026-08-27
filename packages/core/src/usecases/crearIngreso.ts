import { crearIngreso as crearIngresoRepo } from "../repositories/ingresos.repo";
import { ingresoSchema } from "../schemas/ingreso.schema";
import type { Ingreso } from "../types/domain";

export async function crearIngreso(input: unknown): Promise<Ingreso> {
  const data = ingresoSchema.parse(input);
  return crearIngresoRepo(data);
}
