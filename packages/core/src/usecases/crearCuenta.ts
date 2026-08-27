import { crearCuenta as crearCuentaRepo } from "../repositories/cuentas.repo";
import { cuentaSchema } from "../schemas/cuenta.schema";
import type { Cuenta } from "../types/domain";

export async function crearCuenta(input: unknown): Promise<Cuenta> {
  const data = cuentaSchema.parse(input);
  return crearCuentaRepo(data);
}
