import type { AbonoDeuda, Categoria, Gasto, Ingreso, PagoTarjeta } from "../types/domain";
import { fechaLocal } from "./semanas";

export interface MovimientoCuenta {
  id: string;
  /** "pago" = pago recibido por la tarjeta; "pago_enviado" = pago a una tarjeta desde esta cuenta; "abono" = abono a una deuda desde esta cuenta. */
  tipo: "gasto" | "pago" | "ingreso" | "pago_enviado" | "abono";
  /**
   * Entrada (suma al disponible) o salida (resta). Usar esto para el signo, no
   * `tipo`. `movimientosDe` siempre lo llena; es opcional solo para no romper
   * las pantallas que arman movimientos a mano (ahí: `tipo !== "gasto"`).
   */
  sentido?: "entrada" | "salida";
  descripcion: string;
  subtitulo: string;
  monto: number;
  fecha: string;
  createdAt: string;
  color: string;
}

/**
 * Línea de tiempo de una cuenta, más reciente primero: sus gastos e ingresos,
 * los pagos que recibió (si es tarjeta) y las salidas por pagar una tarjeta o
 * abonar a una deuda desde ella. Antes esas salidas no aparecían: el saldo
 * bajaba sin ningún movimiento que lo explicara.
 */
export function movimientosDe(
  cuentaId: string,
  gastos: Gasto[],
  pagos: PagoTarjeta[],
  ingresos: Ingreso[],
  categorias: Categoria[],
  abonos: AbonoDeuda[] = []
): MovimientoCuenta[] {
  const items: MovimientoCuenta[] = [
    ...gastos
      .filter((g) => g.cuentaId === cuentaId)
      .map((g) => {
        const categoria = categorias.find((c) => c.id === g.categoriaId);
        return {
          id: g.id,
          tipo: "gasto" as const,
          sentido: "salida" as const,
          descripcion: g.descripcion || categoria?.nombre || "Gasto",
          subtitulo: categoria?.nombre ?? "Sin categoría",
          monto: g.monto,
          fecha: g.fecha,
          createdAt: g.createdAt,
          color: categoria?.color ?? "#6b7280",
        };
      }),
    ...pagos
      .filter((p) => p.cuentaId === cuentaId)
      .map((p) => ({
        id: p.id,
        tipo: "pago" as const,
        sentido: "entrada" as const,
        descripcion: "Pago",
        subtitulo: "Pago a la tarjeta",
        monto: p.monto,
        fecha: p.fecha,
        createdAt: p.createdAt,
        color: "#16a34a",
      })),
    ...pagos
      .filter((p) => p.cuentaOrigenId === cuentaId && p.cuentaId !== cuentaId)
      .map((p) => ({
        id: `${p.id}-origen`,
        tipo: "pago_enviado" as const,
        sentido: "salida" as const,
        descripcion: "Pago de tarjeta",
        subtitulo: "Pago enviado a una tarjeta",
        monto: p.monto,
        fecha: p.fecha,
        createdAt: p.createdAt,
        color: "#6b7280",
      })),
    ...abonos
      .filter((a) => a.cuentaId === cuentaId)
      .map((a) => ({
        id: a.id,
        tipo: "abono" as const,
        sentido: "salida" as const,
        descripcion: "Abono a deuda",
        subtitulo: "Abono",
        monto: a.monto,
        fecha: a.fecha,
        createdAt: a.createdAt,
        color: "#6b7280",
      })),
    ...ingresos
      .filter((i) => i.cuentaId === cuentaId)
      .map((i) => ({
        id: i.id,
        tipo: "ingreso" as const,
        sentido: "entrada" as const,
        descripcion: i.descripcion || "Ingreso",
        subtitulo: "Ingreso",
        monto: i.monto,
        fecha: i.fecha,
        createdAt: i.createdAt,
        color: "#16a34a",
      })),
  ];

  return items.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/** "Hoy", "Ayer" o la fecha larga, según el día LOCAL del teléfono (antes se usaba UTC: a las 20:00 en Ecuador, hoy salía como "Ayer"). */
export function etiquetaFecha(fecha: string, ahora: Date = new Date()): string {
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (fecha === fechaLocal(ahora)) return "Hoy";
  if (fecha === fechaLocal(ayer)) return "Ayer";
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function agruparPorFecha(
  items: MovimientoCuenta[]
): { fecha: string; etiqueta: string; items: MovimientoCuenta[] }[] {
  const grupos: { fecha: string; etiqueta: string; items: MovimientoCuenta[] }[] = [];
  for (const item of items) {
    let grupo = grupos.find((g) => g.fecha === item.fecha);
    if (!grupo) {
      grupo = { fecha: item.fecha, etiqueta: etiquetaFecha(item.fecha), items: [] };
      grupos.push(grupo);
    }
    grupo.items.push(item);
  }
  return grupos;
}
