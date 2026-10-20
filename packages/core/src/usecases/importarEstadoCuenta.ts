import type { ZodType } from "zod";
import { gastoSchema } from "../schemas/gasto.schema";
import { ingresoSchema } from "../schemas/ingreso.schema";
import { crearGastosEnLote, listarGastos } from "../repositories/gastos.repo";
import { crearIngresosEnLote, listarIngresos } from "../repositories/ingresos.repo";
import { listarCuentas } from "../repositories/cuentas.repo";
import { listarTransferencias } from "../repositories/transferencias.repo";
import { mensajeError } from "../lib/mensajeError";
import type { TransaccionEstadoCuenta } from "../lib/estadoCuenta";
import {
  saldoQuedariaNegativo,
  rangoDeFilas,
  TOPE_FILAS_IMPORTACION,
  type MovimientosExistentes,
  type MovimientosParaGuardar,
} from "../lib/importacionEstadoCuenta";

/**
 * Lo ya registrado en el periodo del estado de cuenta (todas las cuentas), para
 * marcar posibles duplicados. Una transferencia entre cuentas propias aparece
 * en el estado como salida de una cuenta y entrada en la otra: cuenta para los
 * dos lados, así no se importa otra vez como gasto o ingreso.
 */
export async function movimientosDelPeriodo(transacciones: Pick<TransaccionEstadoCuenta, "fecha">[]): Promise<MovimientosExistentes> {
  const rango = rangoDeFilas(transacciones);
  if (!rango) return { gastos: [], ingresos: [] };
  const [gastos, ingresos, transferencias] = await Promise.all([
    listarGastos(rango),
    listarIngresos(rango),
    listarTransferencias(rango),
  ]);
  return { gastos: [...gastos, ...transferencias], ingresos: [...ingresos, ...transferencias] };
}

/** Los ingresos se guardaron y los gastos no: reintentar debe mandar solo los gastos. */
export class ErrorImportacionParcial extends Error {
  readonly ingresosGuardados: number;
  constructor(ingresosGuardados: number, causa: unknown) {
    super(
      `Se guardaron ${ingresosGuardados} ingreso(s), pero los gastos no (${mensajeError(causa)}). ` +
        "Vuelve a intentarlo: solo se enviarán los gastos."
    );
    this.name = "ErrorImportacionParcial";
    this.ingresosGuardados = ingresosGuardados;
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
 * sola operación: la base guarda todos los ingresos o ninguno, y todos los
 * gastos o ninguno. Los ingresos van primero: una cuenta de ahorro no puede
 * quedar en negativo, ni siquiera a mitad del guardado (con los gastos
 * primero, un estado con muchos débitos y créditos la habría dejado en
 * negativo y la base lo habría rechazado). Los saldos los ajustan los
 * triggers, como al registrar a mano.
 */
export async function importarMovimientos(movimientos: MovimientosParaGuardar): Promise<{ gastos: number; ingresos: number }> {
  const total = movimientos.gastos.length + movimientos.ingresos.length;
  if (total === 0) throw new Error("Elige al menos un movimiento para importar.");
  if (total > TOPE_FILAS_IMPORTACION) {
    throw new Error(`Son ${total} movimientos: el máximo por importación es ${TOPE_FILAS_IMPORTACION}.`);
  }
  const gastos = validarTodas(movimientos.gastos, gastoSchema);
  const ingresos = validarTodas(movimientos.ingresos, ingresoSchema);
  // Con el saldo recién leído: la base rechazaría el lote entero, mejor decirlo antes.
  if (gastos.some((g) => g.cuentaId)) {
    const negativo = saldoQuedariaNegativo(gastos, ingresos, await listarCuentas());
    if (negativo) throw new Error(negativo);
  }

  const guardados = (await crearIngresosEnLote(ingresos)).length;
  try {
    return { gastos: (await crearGastosEnLote(gastos)).length, ingresos: guardados };
  } catch (err) {
    if (guardados > 0) throw new ErrorImportacionParcial(guardados, err);
    throw err;
  }
}
