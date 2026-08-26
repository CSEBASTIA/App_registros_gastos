export * from "./client";
export * from "./types/domain";
export * from "./schemas/gasto.schema";
export * from "./schemas/presupuesto.schema";
export * from "./repositories/categorias.repo";

// De gastos.repo/presupuestos.repo NO reexportamos `crearGasto`/`crearPresupuesto`
// (inserts sin validar) para no chocar de nombre con los use cases de abajo,
// que son la forma correcta de crear datos (validan con zod antes de insertar).
export { listarGastos, eliminarGasto } from "./repositories/gastos.repo";
export { listarPresupuestos, eliminarPresupuesto } from "./repositories/presupuestos.repo";

export * from "./usecases/crearGasto";
export * from "./usecases/crearPresupuesto";
export * from "./usecases/resumenMensual";
