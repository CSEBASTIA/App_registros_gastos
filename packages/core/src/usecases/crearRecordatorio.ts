import { crearRecordatorio as crearRecordatorioRepo } from "../repositories/recordatorios.repo";
import { recordatorioSchema } from "../schemas/recordatorio.schema";
import type { Recordatorio } from "../types/domain";

export async function crearRecordatorio(input: unknown): Promise<Recordatorio> {
  const data = recordatorioSchema.parse(input);
  return crearRecordatorioRepo(data);
}
