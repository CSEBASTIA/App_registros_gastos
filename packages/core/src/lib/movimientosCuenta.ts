import type { Categoria, Gasto, Ingreso, PagoTarjeta } from "../types/domain";

export interface MovimientoCuenta {
  id: string;
  tipo: "gasto" | "pago" | "ingreso";
  descripcion: string;
  subtitulo: string;
  monto: number;
  fecha: string;
  createdAt: string;
  color: string;
}

/** Combina gastos + pagos de tarjeta + ingresos de una cuenta en una sola línea de tiempo, más reciente primero. */
export function movimientosDe(
  cuentaId: string,
  gastos: Gasto[],
  pagos: PagoTarjeta[],
  ingresos: Ingreso[],
  categorias: Categoria[]
): MovimientoCuenta[] {
  const items: MovimientoCuenta[] = [
    ...gastos
      .filter((g) => g.cuentaId === cuentaId)
      .map((g) => {
        const categoria = categorias.find((c) => c.id === g.categoriaId);
        return {
          id: g.id,
          tipo: "gasto" as const,
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
        descripcion: "Pago",
        subtitulo: "Pago a la tarjeta",
        monto: p.monto,
        fecha: p.fecha,
        createdAt: p.createdAt,
        color: "#16a34a",
      })),
    ...ingresos
      .filter((i) => i.cuentaId === cuentaId)
      .map((i) => ({
        id: i.id,
        tipo: "ingreso" as const,
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

export function etiquetaFecha(fecha: string): string {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (fecha === hoy.toISOString().slice(0, 10)) return "Hoy";
  if (fecha === ayer.toISOString().slice(0, 10)) return "Ayer";
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
