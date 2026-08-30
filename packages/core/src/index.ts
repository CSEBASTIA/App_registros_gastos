export * from "./client";
export * from "./types/domain";
export * from "./schemas/gasto.schema";
export * from "./schemas/presupuesto.schema";
export * from "./schemas/cuenta.schema";
export * from "./schemas/ingreso.schema";
export * from "./schemas/pagoTarjeta.schema";
export * from "./schemas/deuda.schema";
export * from "./schemas/recordatorio.schema";
export * from "./schemas/categoria.schema";

// De gastos.repo/presupuestos.repo (y las demás) NO reexportamos los
// `crear*` (inserts sin validar) para no chocar de nombre con los use cases
// de abajo, que son la forma correcta de crear datos (validan con zod antes
// de insertar).
export {
  listarCategorias,
  actualizarCategoria,
  eliminarCategoria,
} from "./repositories/categorias.repo";
export {
  listarGastos,
  actualizarGasto,
  eliminarGasto,
  type CambiosGasto,
} from "./repositories/gastos.repo";
export { listarPresupuestos, eliminarPresupuesto } from "./repositories/presupuestos.repo";
export { listarCuentas, eliminarCuenta } from "./repositories/cuentas.repo";
export { listarIngresos, eliminarIngreso } from "./repositories/ingresos.repo";
export { listarPagosTarjeta } from "./repositories/pagosTarjeta.repo";
export {
  listarDeudas,
  eliminarDeuda,
  registrarAbonoDeuda,
} from "./repositories/deudas.repo";
export {
  listarRecordatorios,
  eliminarRecordatorio,
  marcarCompletado,
} from "./repositories/recordatorios.repo";

export * from "./usecases/crearCategoria";
export * from "./usecases/crearGasto";
export * from "./usecases/crearPresupuesto";
export * from "./usecases/crearCuenta";
export * from "./usecases/crearIngreso";
export * from "./usecases/crearDeuda";
export * from "./usecases/crearRecordatorio";
export * from "./usecases/registrarPagoTarjeta";
export * from "./usecases/resumenMensual";
export * from "./usecases/balanceGeneral";
export * from "./usecases/calcularEndeudamiento";
export * from "./usecases/generarRecomendaciones";
