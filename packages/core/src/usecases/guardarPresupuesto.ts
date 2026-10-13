import { guardarPresupuesto as guardarPresupuestoRepo } from "../repositories/presupuestos.repo";
import { presupuestoSchema } from "../schemas/presupuesto.schema";
import type { Presupuesto } from "../types/domain";

/** Valida y crea/actualiza el límite de una categoría en un mes. */
export async function guardarPresupuesto(input: unknown): Promise<Presupuesto> {
  const data = presupuestoSchema.parse(input);
  return guardarPresupuestoRepo(data);
}
