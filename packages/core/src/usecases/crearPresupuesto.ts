import { crearPresupuesto as crearPresupuestoRepo } from "../repositories/presupuestos.repo";
import { presupuestoSchema } from "../schemas/presupuesto.schema";
import type { Presupuesto } from "../types/domain";

export async function crearPresupuesto(input: unknown): Promise<Presupuesto> {
  const data = presupuestoSchema.parse(input);
  return crearPresupuestoRepo(data);
}
