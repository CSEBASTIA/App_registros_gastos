export * from "./client";
export * from "./types/domain";
export * from "./lib/semanas";
export * from "./lib/movimientosCuenta";
export * from "./lib/marcas";
export * from "./lib/mensajeError";
export * from "./lib/formatMonto";
export * from "./lib/montos";
export * from "./lib/diferidos";
export * from "./lib/repararTexto";
export * from "./lib/categorias";
export * from "./lib/metodoPago";
export * from "./lib/textoFinanciero";
export * from "./lib/estadoCuenta";
export * from "./lib/correoBancario";
export * from "./lib/sincronizacionCorreo";
export * from "./lib/fetchConTimeout";
export * from "./lib/ubicacion";
export * from "./lib/ubicacionDispositivo";
export * from "./lib/corteTarjeta";
export * from "./lib/recordatorios";
export * from "./lib/detalleTransaccion";
export * from "./lib/mapaEstatico";
export * from "./lib/legal";
export { FILAS_POR_PAGINA, type RangoFechas } from "./lib/paginacion";
export * from "./schemas/limites";
export * from "./schemas/gasto.schema";
export * from "./schemas/ubicacion.schema";
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
  listarGastosDeLugar,
  actualizarGasto,
  eliminarGasto,
  type CambiosGasto,
} from "./repositories/gastos.repo";
export { listarPresupuestos, eliminarPresupuesto } from "./repositories/presupuestos.repo";
export { listarCuentas, eliminarCuenta, actualizarFechasTarjeta } from "./repositories/cuentas.repo";
export { listarIngresos, actualizarIngreso, eliminarIngreso } from "./repositories/ingresos.repo";
export { listarPagosTarjeta } from "./repositories/pagosTarjeta.repo";
export {
  listarDeudas,
  eliminarDeuda,
  registrarAbonoDeuda,
  listarAbonosDeuda,
  type OpcionesAbono,
} from "./repositories/deudas.repo";
export {
  listarRecordatorios,
  eliminarRecordatorio,
  marcarCompletado,
  completarRecordatorio,
} from "./repositories/recordatorios.repo";
export {
  listarTransaccionesPendientes,
  insertarTransaccionesDetectadas,
  marcarTransaccionDetectada,
  confirmarTransaccionDetectada,
  eliminarTransaccionesDetectadas,
  avisoGuardable,
  type TransaccionDetectadaInsert,
  type DatosConfirmacion,
} from "./repositories/transaccionesDetectadas.repo";
export {
  listarLugares,
  borrarMisUbicaciones,
  resumenPorLugar,
  resumenPorComercio,
  renombrarLugar,
  eliminarLugar,
  fusionarLugares,
  validarRangoResumen,
  DIAS_MAXIMOS_RESUMEN,
  type UbicacionesBorradas,
  type ResumenLugar,
  type ResumenComercio,
} from "./repositories/lugares.repo";
export {
  crearClaveCaptura,
  listarClavesCaptura,
  revocarClaveCaptura,
  configuracionAtajo,
  configuracionGoogleWallet,
  PAQUETE_GOOGLE_WALLET,
  MAXIMO_CLAVES_CAPTURA,
  type ClaveCaptura,
} from "./repositories/clavesCaptura.repo";
export { eliminarMiCuenta, CONFIRMACION_ELIMINAR_CUENTA } from "./repositories/cuentaUsuario.repo";
export {
  listarAceptaciones,
  documentosLegalesPendientes,
  registrarAceptacion,
  aceptarDocumentosPendientes,
} from "./repositories/legal.repo";
export { totalesPorMes, type TotalMes } from "./repositories/totales.repo";
export {
  contrasenaSchema,
  validarContrasena,
  solicitarRecuperacion,
  sesionDesdeEnlace,
  cambiarContrasena,
  parametrosDeEnlace,
  MENSAJE_RECUPERACION_ENVIADA,
} from "./repositories/acceso.repo";

export * from "./usecases/crearCategoria";
export * from "./usecases/crearGasto";
export * from "./usecases/guardarPresupuesto";
export * from "./usecases/crearCuenta";
export * from "./usecases/crearIngreso";
export * from "./usecases/crearDeuda";
export * from "./usecases/crearRecordatorio";
export * from "./usecases/registrarPagoTarjeta";
export * from "./usecases/resumenMensual";
export * from "./usecases/balanceGeneral";
export * from "./usecases/calcularEndeudamiento";
export * from "./usecases/generarRecomendaciones";
export * from "./usecases/eliminarTodosLosDatos";
export * from "./usecases/estadoPresupuestos";
export * from "./usecases/planDeudas";
export * from "./usecases/scoreFinanciero";
