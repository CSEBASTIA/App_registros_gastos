import { listarGastos } from "../repositories/gastos.repo";

export interface ResumenMensual {
  mes: string;
  total: number;
  cantidad: number;
  gastos: Awaited<ReturnType<typeof listarGastos>>;
}

export async function resumenMensual(mes: string): Promise<ResumenMensual> {
  const gastos = await listarGastos();
  const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const total = delMes.reduce((acc, g) => acc + g.monto, 0);

  return { mes, total, cantidad: delMes.length, gastos: delMes };
}
