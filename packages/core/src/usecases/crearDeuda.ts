import { crearDeuda as crearDeudaRepo } from "../repositories/deudas.repo";
import { deudaSchema } from "../schemas/deuda.schema";
import type { Deuda } from "../types/domain";

export async function crearDeuda(input: unknown): Promise<Deuda> {
  const data = deudaSchema.parse(input);
  return crearDeudaRepo(data);
}
