import type { ZodType } from "zod";
import { gastoSchema } from "../schemas/gasto.schema";
import { ingresoSchema } from "../schemas/ingreso.schema";
import { crearGastosEnLote, listarGastos } from "../repositories/gastos.repo";
import { crearIngresosEnLote, listarIngresos } from "../repositories/ingresos.repo";
import { listarCuentas } from "../repositories/cuentas.repo";
import { mensajeError } from "../lib/mensajeError";
import type { TransaccionEstadoCuenta } from "../lib/estadoCuenta";
import {
  cupoInsuficiente,
  rangoDeFilas,
  TOPE_FILAS_IMPORTACION,
  type MovimientosExistentes,
  type MovimientosParaGuardar,
} from "../lib/importacionEstadoCuenta";

/** Lo ya registrado en el periodo del estado de cuenta (todas las cuentas), para marcar posibles duplicados. */
export async function movimientosDelPeriodo(transacciones: Pick<TransaccionEstadoCuenta, "fecha">[]): Promise<MovimientosExistentes> {
  const rango = rangoDeFilas(transacciones);
  if (!rango) return { gastos: [], ingresos: [] };
  const [gastos, ingresos] = await Promise.all([listarGastos(rango), listarIngresos(rango)]);
  return { gastos, ingresos };
}

/** Los gastos se guardaron y los ingresos no: reintentar debe mandar solo los ingresos. */
export class ErrorImportacionParcial extends Error {
  readonly gastosGuardados: number;
  constructor(gastosGuardados: number, causa: unknown) {
    super(
      `Se guardaron ${gastosGuardados} gasto(s), pero los ingresos no (${mensajeError(causa)}). ` +
        "Vuelve a intentarlo: solo se enviarán los ingresos."
    );
    this.name = "ErrorImportacionParcial";
    this.gastosGuardados = gastosGuardados;
  }
}

function validarTodas<T>(filas: unknown[], schema: ZodType<T>): T[] {
  return filas.map((fila, i) => {
    const r = schema.safeParse(fila);
    if (r.success) return r.data;
    const descripcion = (fila as { descripcion?: unknown }).descripcion;
    const cual = typeof descripcion === "string" && descripcion.trim() ? `«${descripcion.trim()}»` : `la fila ${i + 1}`;
    throw new Error(`Revisa ${cual}: ${r.error.issues[0]?.message ?? "tiene un dato inválido."}`);
  });
}

/**
 * Guarda lo elegido al importar un estado de cuenta. Primero valida TODAS las
 * filas (si una está mal no se guarda nada) y luego escribe cada tabla en una
 * sola operación: la base guarda todos los gastos o ninguno, y todos los
 * ingresos o ninguno. Los saldos los ajustan los triggers, como al registrar
 * a mano.
 */
export async function importarMovimientos(movimientos: MovimientosParaGuardar): Promise<{ gastos: number; ingresos: number }> {
  const total = movimientos.gastos.length + movimientos.ingresos.length;
  if (total === 0) throw new Error("Elige al menos un movimiento para importar.");
  if (total > TOPE_FILAS_IMPORTACION) {
    throw new Error(`Son ${total} movimientos: el máximo por importación es ${TOPE_FILAS_IMPORTACION}.`);
  }
  const gastos = validarTodas(movimientos.gastos, gastoSchema);
  const ingresos = validarTodas(movimientos.ingresos, ingresoSchema);
  // Con el cupo recién leído (ver `cupoInsuficiente`: en lote la base no lo frena sola).
  if (gastos.some((g) => g.cuentaId)) {
    const excedido = cupoInsuficiente(gastos, await listarCuentas());
    if (excedido) throw new Error(excedido);
  }

  const guardados = (await crearGastosEnLote(gastos)).length;
  try {
    return { gastos: guardados, ingresos: (await crearIngresosEnLote(ingresos)).length };
  } catch (err) {
    if (guardados > 0) throw new ErrorImportacionParcial(guardados, err);
    throw err;
  }
}
