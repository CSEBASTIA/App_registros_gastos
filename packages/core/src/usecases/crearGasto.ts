import { crearGasto as crearGastoRepo } from "../repositories/gastos.repo";
import { gastoSchema } from "../schemas/gasto.schema";
import type { Gasto } from "../types/domain";

export async function crearGasto(input: unknown): Promise<Gasto> {
  const data = gastoSchema.parse(input);
  return crearGastoRepo(data);
}
