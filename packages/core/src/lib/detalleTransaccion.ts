import type { Categoria, Cuenta, Gasto, Ingreso, Lugar, TransaccionDetectada, Ubicacion } from "../types/domain";
import { ETIQUETA_BILLETERA, ETIQUETA_METODO_PAGO, ETIQUETA_ORIGEN_TRANSACCION } from "./metodoPago";
import { ETIQUETA_BANCO } from "./marcas";

/**
 * Los datos que muestra la «isla» de detalle de una transacción: una fila
 * por dato, solo los que existen. Las fechas salen en español y en la zona
 * horaria del teléfono (o la indicada en `zona`, para las pruebas).
 */
export interface FilaDetalle {
  clave: string;
  etiqueta: string;
  valor: string;
  /** Mostrar con letra monoespaciada (ids, coordenadas). */
  mono?: boolean;
}

export interface OpcionesDetalle {
  /** Zona horaria IANA; sin ella, la del dispositivo. */
  zona?: string;
}

/** "viernes, 16 de octubre de 2026". La fecha es de calendario: sin zona horaria. */
export function fechaLarga(fechaIso: string): string {
  const [a, m, d] = fechaIso.split("-").map(Number);
  if (!a || !m || !d) return fechaIso;
  return new Date(a, m - 1, d).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "16 oct 2026, 14:32" a partir de un instante (created_at). */
export function fechaHora(instanteIso: string, opciones: OpcionesDetalle = {}): string {
  const fecha = new Date(instanteIso);
  if (Number.isNaN(fecha.getTime())) return instanteIso;
  const zona = opciones.zona ? { timeZone: opciones.zona } : {};
  const dia = fecha.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric", ...zona });
  const hora = fecha.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...zona });
  return `${dia}, ${hora}`;
}

/** "-0.1807, -78.4678 (±12 m)". */
export function textoUbicacion(u: Ubicacion): string {
  const precision = u.precisionM !== undefined ? ` (±${Math.round(u.precisionM)} m)` : "";
  return `${u.latitud.toFixed(4)}, ${u.longitud.toFixed(4)}${precision}`;
}

function nombreCategoria(categoria?: Categoria, detalle?: string): string | undefined {
  if (!categoria) return undefined;
  return categoria.nombre === "Otros" && detalle ? `${categoria.nombre} · ${detalle}` : categoria.nombre;
}

function sinVacias(filas: Array<FilaDetalle | false | undefined>): FilaDetalle[] {
  return filas.filter((f): f is FilaDetalle => !!f && f.valor.trim() !== "");
}

export function filasDetalleGasto(
  g: Gasto,
  ctx: { categoria?: Categoria; cuenta?: Cuenta; lugar?: Lugar },
  opciones: OpcionesDetalle = {},
): FilaDetalle[] {
  const metodo = g.metodoPago ? ETIQUETA_METODO_PAGO[g.metodoPago] : undefined;
  const billetera = g.billetera ? ETIQUETA_BILLETERA[g.billetera] : undefined;
  const diferido =
    g.metodoPago === "diferido" && g.mesesDiferido
      ? `${g.mesesDiferido} meses · ${g.tasaInteres ? `${g.tasaInteres}% anual` : "sin interés"}`
      : undefined;
  return sinVacias([
    { clave: "id", etiqueta: "ID de la transacción", valor: g.id, mono: true },
    { clave: "fecha", etiqueta: "Fecha", valor: fechaLarga(g.fecha) },
    { clave: "registrado", etiqueta: "Registrado", valor: fechaHora(g.createdAt, opciones) },
    !!ctx.lugar && { clave: "lugar", etiqueta: "Lugar", valor: ctx.lugar.nombre },
    !!g.ubicacion && { clave: "ubicacion", etiqueta: "Ubicación", valor: textoUbicacion(g.ubicacion), mono: true },
    { clave: "categoria", etiqueta: "Categoría", valor: nombreCategoria(ctx.categoria, g.categoriaDetalle) ?? "Sin categoría" },
    (!!metodo || !!billetera) && {
      clave: "metodo",
      etiqueta: "Método de pago",
      valor: [metodo, billetera && `con ${billetera}`].filter(Boolean).join(" "),
    },
    { clave: "cuenta", etiqueta: "Cuenta", valor: ctx.cuenta?.nombre ?? "Sin cuenta" },
    !!diferido && { clave: "diferido", etiqueta: "Diferido", valor: diferido },
    !!g.facturaPath && { clave: "factura", etiqueta: "Factura", valor: "Adjunta" },
  ]);
}

export function filasDetalleIngreso(
  i: Ingreso,
  ctx: { categoria?: Categoria; cuenta?: Cuenta },
  opciones: OpcionesDetalle = {},
): FilaDetalle[] {
  return sinVacias([
    { clave: "id", etiqueta: "ID de la transacción", valor: i.id, mono: true },
    { clave: "fecha", etiqueta: "Fecha", valor: fechaLarga(i.fecha) },
    { clave: "registrado", etiqueta: "Registrado", valor: fechaHora(i.createdAt, opciones) },
    { clave: "categoria", etiqueta: "Fuente", valor: nombreCategoria(ctx.categoria, i.categoriaDetalle) ?? "Sin fuente" },
    { clave: "cuenta", etiqueta: "Cuenta", valor: ctx.cuenta?.nombre ?? "Sin cuenta" },
  ]);
}

/** Un aviso de la bandeja: su `createdAt` es la hora en que llegó (para Apple Pay o Google Wallet, la del pago). */
export function filasDetalleAviso(
  t: TransaccionDetectada,
  ctx: { cuenta?: Cuenta },
  opciones: OpcionesDetalle = {},
): FilaDetalle[] {
  const esBilletera = t.origen !== "correo";
  return sinVacias([
    { clave: "id", etiqueta: "ID del aviso", valor: t.id, mono: true },
    { clave: "origen", etiqueta: "Detectado por", valor: ETIQUETA_ORIGEN_TRANSACCION[t.origen] },
    { clave: "llego", etiqueta: esBilletera ? "Hora del pago" : "Llegó", valor: fechaHora(t.createdAt, opciones) },
    { clave: "fecha", etiqueta: "Fecha", valor: fechaLarga(t.fecha) },
    !!t.comercio && { clave: "comercio", etiqueta: "Comercio", valor: t.comercio },
    !!t.ubicacion && { clave: "ubicacion", etiqueta: "Ubicación", valor: textoUbicacion(t.ubicacion), mono: true },
    !!t.banco && { clave: "banco", etiqueta: "Banco", valor: ETIQUETA_BANCO[t.banco] },
    !!t.tarjetaFinal && { clave: "tarjeta", etiqueta: "Tarjeta", valor: `•••• ${t.tarjetaFinal}`, mono: true },
    { clave: "cuenta", etiqueta: "Cuenta", valor: ctx.cuenta?.nombre ?? "Por elegir" },
    !!t.correoAsunto && { clave: "asunto", etiqueta: "Asunto del correo", valor: t.correoAsunto },
  ]);
}
