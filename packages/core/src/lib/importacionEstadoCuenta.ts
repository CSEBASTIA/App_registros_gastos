/**
 * Importar un estado de cuenta a una cuenta concreta (al crearla o desde su
 * detalle): qué filas se proponen, cuáles ya parecen registradas, cómo queda
 * el saldo y qué se envía a la base. Sin red ni plataforma, para probarlo.
 */
import type { Categoria, Cuenta, Gasto, Ingreso } from "../types/domain";
import type { TransaccionEstadoCuenta } from "./estadoCuenta";
import { sumarMontos } from "./montos";
import { formatMonto } from "./formatMonto";

/**
 * Un estado de cuenta real trae decenas o cientos de filas (uno de ahorro de un
 * mes puede pasar de 300); muchas más es casi seguro otro archivo.
 */
export const TOPE_FILAS_IMPORTACION = 1000;

export interface FilaImportacion {
  id: number;
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso";
  categoriaSugerida: TransaccionEstadoCuenta["categoriaSugerida"];
  seleccionada: boolean;
  /** Ya hay un movimiento con la misma fecha y el mismo monto (en esta u otra cuenta). */
  posibleDuplicado: boolean;
}

export interface MovimientosExistentes {
  gastos: Pick<Gasto, "fecha" | "monto">[];
  ingresos: Pick<Ingreso, "fecha" | "monto">[];
}

export interface FilasPreparadas {
  filas: FilaImportacion[];
  /** Pagos o abonos a la tarjeta que trae el estado: no son gastos y no se importan. */
  pagosOmitidos: number;
  /** Había más filas que `TOPE_FILAS_IMPORTACION`: se tomaron las primeras. */
  truncado: boolean;
}

const claveMovimiento = (fecha: string, monto: number) => `${fecha}|${Math.round(monto * 100)}`;

function contarPorClave(movimientos: Pick<Gasto, "fecha" | "monto">[]): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const m of movimientos) {
    const clave = claveMovimiento(m.fecha, m.monto);
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  return conteo;
}

/**
 * Convierte lo leído del estado de cuenta en filas para revisar:
 * - En una tarjeta de crédito, los pagos/abonos se omiten (se registran con
 *   «Pagar tarjeta», que también descuenta de la cuenta de origen).
 * - En ahorro/débito, si el estado dice con sus columnas (DÉBITO / CRÉDITO) o
 *   con el saldo de cada fila que entró dinero, es un ingreso y sale marcado.
 *   Si solo lo sugieren las palabras («abono», «pago recibido»), sale como
 *   ingreso pero sin marcar: puede ser una salida. La persona decide.
 * - Una fila con la misma fecha y monto que un movimiento ya registrado sale
 *   desmarcada como «posible duplicado». Cada movimiento existente cubre una
 *   sola fila: dos cafés iguales en el estado y uno registrado → solo uno se
 *   marca como duplicado.
 */
export function prepararFilasImportacion(
  transacciones: TransaccionEstadoCuenta[],
  tipoCuenta: Cuenta["tipo"],
  existentes: MovimientosExistentes = { gastos: [], ingresos: [] }
): FilasPreparadas {
  const esCredito = tipoCuenta === "credito";
  const libres = { gasto: contarPorClave(existentes.gastos), ingreso: contarPorClave(existentes.ingresos) };
  const filas: FilaImportacion[] = [];
  let pagosOmitidos = 0;
  let truncado = false;

  for (const t of transacciones) {
    if (esCredito && t.posiblePago) {
      pagosOmitidos += 1;
      continue;
    }
    if (filas.length >= TOPE_FILAS_IMPORTACION) {
      truncado = true;
      break;
    }
    const tipo = t.sentido ? (t.sentido === "entrada" ? "ingreso" : "gasto") : t.posiblePago ? "ingreso" : "gasto";
    const clave = claveMovimiento(t.fecha, t.monto);
    const quedan = libres[tipo].get(clave) ?? 0;
    const posibleDuplicado = quedan > 0;
    if (posibleDuplicado) libres[tipo].set(clave, quedan - 1);
    filas.push({
      id: filas.length,
      fecha: t.fecha,
      descripcion: t.descripcion,
      monto: t.monto,
      tipo,
      categoriaSugerida: t.categoriaSugerida,
      seleccionada: (tipo === "gasto" || t.sentido === "entrada") && !posibleDuplicado,
      posibleDuplicado,
    });
  }
  return { filas, pagosOmitidos, truncado };
}

/** Rango de fechas que cubre el estado (para buscar duplicados solo en ese periodo). */
export function rangoDeFilas(transacciones: Pick<TransaccionEstadoCuenta, "fecha">[]): { desde: string; hasta: string } | undefined {
  if (transacciones.length === 0) return undefined;
  const fechas = transacciones.map((t) => t.fecha).sort();
  return { desde: fechas[0], hasta: fechas[fechas.length - 1] };
}

export interface ResumenImportacion {
  gastos: number;
  totalGastos: number;
  ingresos: number;
  totalIngresos: number;
  /** Saldo (o cupo disponible, en crédito) que tendrá la cuenta después de importar. */
  disponibleDespues: number;
}

/** Lo que se va a guardar y cómo queda el saldo: la base resta cada gasto y suma cada ingreso. */
export function resumenImportacion(filas: FilaImportacion[], cuenta: Pick<Cuenta, "tipo" | "disponible">): ResumenImportacion {
  const elegidas = filas.filter((f) => f.seleccionada);
  const gastos = elegidas.filter((f) => f.tipo === "gasto");
  // En crédito la base no suma ingresos al cupo (y aquí no se proponen).
  const ingresos = cuenta.tipo === "credito" ? [] : elegidas.filter((f) => f.tipo === "ingreso");
  const totalGastos = sumarMontos(gastos.map((f) => f.monto));
  const totalIngresos = sumarMontos(ingresos.map((f) => f.monto));
  return {
    gastos: gastos.length,
    totalGastos,
    ingresos: ingresos.length,
    totalIngresos,
    disponibleDespues: sumarMontos([cuenta.disponible, -totalGastos, totalIngresos]),
  };
}

function nombreNormalizado(nombre: string): string {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export interface MovimientosParaGuardar {
  gastos: Omit<Gasto, "id" | "createdAt">[];
  ingresos: Omit<Ingreso, "id" | "createdAt">[];
}

/**
 * Arma los gastos e ingresos de las filas marcadas. La categoría sale de la
 * sugerida (Ocio, Salud) o «Otros»; se puede cambiar después en cada
 * movimiento. En crédito el método es «crédito» y en débito «débito», como al
 * registrarlos a mano.
 */
export function movimientosParaGuardar(
  filas: FilaImportacion[],
  cuenta: Pick<Cuenta, "id" | "tipo">,
  categorias: Pick<Categoria, "id" | "nombre" | "tipo">[]
): MovimientosParaGuardar {
  // Solo categorías de gasto: también puede existir un «Otros» de ingresos.
  const porNombre = new Map(
    categorias.filter((c) => c.tipo !== "ingreso").map((c) => [nombreNormalizado(c.nombre), c.id])
  );
  const otros = porNombre.get("otros");
  const metodoPago: Gasto["metodoPago"] =
    cuenta.tipo === "credito" ? "credito" : cuenta.tipo === "debito" ? "debito" : undefined;
  const elegidas = filas.filter((f) => f.seleccionada);

  const gastos = elegidas
    .filter((f) => f.tipo === "gasto")
    .map((f): MovimientosParaGuardar["gastos"][number] => {
      const categoriaId = porNombre.get(nombreNormalizado(f.categoriaSugerida)) ?? otros;
      if (!categoriaId) throw new Error("Falta la categoría «Otros»: créala en Categorías y vuelve a intentarlo.");
      return { monto: f.monto, descripcion: f.descripcion, categoriaId, cuentaId: cuenta.id, metodoPago, fecha: f.fecha };
    });
  const ingresos =
    cuenta.tipo === "credito"
      ? []
      : elegidas
          .filter((f) => f.tipo === "ingreso")
          .map((f) => ({ monto: f.monto, descripcion: f.descripcion, cuentaId: cuenta.id, fecha: f.fecha }));
  return { gastos, ingresos };
}

/**
 * Si con lo elegido una cuenta de ahorro, de débito o el efectivo quedaría en
 * negativo, el mensaje para la persona; si no, `undefined`. Una tarjeta de
 * crédito sí puede pasarse del cupo (sobreendeudamiento): no frena nada.
 * Se guardan primero los ingresos y después los gastos, así la cuenta nunca
 * pasa por un saldo menor que el final.
 */
export function saldoQuedariaNegativo(
  gastos: Pick<Gasto, "monto" | "cuentaId">[],
  ingresos: Pick<Ingreso, "monto" | "cuentaId">[],
  cuentas: Pick<Cuenta, "id" | "nombre" | "tipo" | "disponible">[]
): string | undefined {
  const movimientos = new Map<string, number[]>();
  for (const g of gastos) if (g.cuentaId) movimientos.set(g.cuentaId, [...(movimientos.get(g.cuentaId) ?? []), -g.monto]);
  for (const i of ingresos) if (i.cuentaId) movimientos.set(i.cuentaId, [...(movimientos.get(i.cuentaId) ?? []), i.monto]);
  for (const [id, montos] of movimientos) {
    const cuenta = cuentas.find((c) => c.id === id);
    if (!cuenta || cuenta.tipo === "credito") continue;
    const final = sumarMontos([cuenta.disponible, ...montos]);
    if (final < 0) {
      return (
        `Con lo marcado, «${cuenta.nombre}» quedaría en ${formatMonto(final)}, y una cuenta no puede quedar en negativo ` +
        "(solo una tarjeta de crédito). Desmarca algunos gastos o marca los ingresos que faltan."
      );
    }
  }
  return undefined;
}

/** Texto para la persona después de importar. */
export function textoResultadoImportacion(r: { gastos: number; ingresos: number }): string {
  const partes: string[] = [];
  if (r.gastos > 0) partes.push(`${r.gastos} gasto${r.gastos === 1 ? "" : "s"}`);
  if (r.ingresos > 0) partes.push(`${r.ingresos} ingreso${r.ingresos === 1 ? "" : "s"}`);
  return partes.length ? `Se importaron ${partes.join(" y ")}.` : "No se importó ningún movimiento.";
}
