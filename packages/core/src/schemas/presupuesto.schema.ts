import { z } from "zod";
import { MES_ISO, montoPositivo } from "./limites";

export const presupuestoSchema = z.object({
  categoriaId: z.string().uuid(),
  montoLimite: montoPositivo(),
  mes: z.string().regex(MES_ISO, "Formato esperado: YYYY-MM"),
});

export type PresupuestoInput = z.infer<typeof presupuestoSchema>;
