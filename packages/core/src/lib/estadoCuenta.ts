import { fechaIso } from "../schemas/limites";
import { clasificarConsumoEstadoCuenta, normalizarNumero } from "./textoFinanciero";

export interface TransaccionEstadoCuenta {
  fecha: string;
  descripcion: string;
  monto: number;
  categoriaSugerida: "Ocio" | "Salud" | "Otros";
  posiblePago: boolean;
}

export interface OpcionesEstadoCuenta {
  /** Fecha de corte o de referencia, usada solo cuando las filas omiten el año. */
  fechaReferencia?: string;
}

const PAGO = /\b(pago\s+(recibido|realizado)|abono|reembolso|reverso|devoluci[oó]n|cr[eé]dito\s+por)\b/i;
const IGNORAR = /^(saldo|total|subtotal|p[aá]gina|resumen|cupo|l[ií]mite|disponible|fecha de corte|pr[oó]ximo|intereses?|tasa)\b/i;
const FECHA = /(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/g;
const MONTO = /(?:^|[\s(])([-+]?\$?\s?(?:\d{1,3}(?:[.,\s]\d{3})+|\d+)[.,]\d{2})(?!\d)/g;

function fechaValida(fecha: string): boolean {
  return fechaIso().safeParse(fecha).success;
}

function fechaNormalizada(valor: string, referencia: string): string | undefined {
  const partes = valor.includes("-") && /^\d{4}/.test(valor)
    ? valor.split("-").map(Number)
    : valor.split(/[/-]/).map(Number).reverse();
  let [anio, mes, dia] = partes;
  if (partes.length === 2) {
    [mes, dia] = partes;
    anio = Number(referencia.slice(0, 4));
    // Un corte en enero puede contener consumos de diciembre del año anterior.
    if (mes > Number(referencia.slice(5, 7)) + 1) anio--;
  }
  if (anio < 100) anio += 2000;
  const iso = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return fechaValida(iso) ? iso : undefined;
}

function referenciaDe(texto: string, opciones: OpcionesEstadoCuenta): string {
  if (opciones.fechaReferencia && fechaValida(opciones.fechaReferencia)) return opciones.fechaReferencia;
  const corte = texto.match(/(?:fecha\s+de\s+corte|corte|periodo\s+hasta)\s*[:\s]+(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (corte) return fechaNormalizada(corte[1], "2000-01-01") ?? new Date().toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function movimiento(fecha: string | undefined, descripcion: string, montoTexto: string): TransaccionEstadoCuenta | undefined {
  const limpio = descripcion.replace(/[-–|]+$/, "").replace(/\s{2,}/g, " ").trim().slice(0, 200);
  const monto = Math.abs(normalizarNumero(montoTexto.replace(/[$\s]/g, "")));
  if (!fecha || limpio.length < 2 || IGNORAR.test(limpio) || !Number.isFinite(monto) || monto < 0.01 || monto > 999_999) return undefined;
  return { fecha, descripcion: limpio, monto, categoriaSugerida: clasificarConsumoEstadoCuenta(limpio), posiblePago: PAGO.test(limpio) };
}

function filasDelimitadas(texto: string, delimitador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (entreComillas && texto[i + 1] === '"') { campo += '"'; i++; }
      else entreComillas = !entreComillas;
    } else if (c === delimitador && !entreComillas) {
      fila.push(campo.trim()); campo = "";
    } else if ((c === "\n" || c === "\r") && !entreComillas) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo.trim()); campo = "";
      if (fila.some(Boolean)) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo.trim());
  if (fila.some(Boolean)) filas.push(fila);
  return filas;
}

function clave(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parsearTabla(texto: string, referencia: string): TransaccionEstadoCuenta[] | undefined {
  const primera = texto.split(/\r?\n/).find(Boolean) ?? "";
  const delimitador = [";", "\t", ","].find((d) => primera.split(d).length >= 3);
  if (!delimitador) return undefined;
  const filas = filasDelimitadas(texto, delimitador);
  const encabezados = filas[0]?.map(clave) ?? [];
  const indice = (regex: RegExp) => encabezados.findIndex((e) => regex.test(e));
  const fechaConsumo = indice(/fecha (de )?(consumo|compra|transaccion|operacion)/);
  const fecha = fechaConsumo >= 0 ? fechaConsumo : indice(/^fecha$|fecha (de )?(movimiento|proceso|registro|efectiva)/);
  const descripcion = indice(/descripcion|detalle|comercio|establecimiento|concepto/);
  const monto = indice(/^(monto|importe|valor|debito|cargo|consumo)( |$)/);
  if (fecha < 0 || descripcion < 0 || monto < 0) return undefined;
  return filas.slice(1).flatMap((fila) => {
    const item = movimiento(fechaNormalizada(fila[fecha] ?? "", referencia), fila[descripcion] ?? "", fila[monto] ?? "");
    return item ? [item] : [];
  });
}

/** Lee texto extraído de PDF/OCR o CSV de cualquier banco sin depender de su nombre. */
export function parseEstadoCuenta(texto: string, opciones: OpcionesEstadoCuenta = {}): TransaccionEstadoCuenta[] {
  const referencia = referenciaDe(texto, opciones);
  const tabla = parsearTabla(texto, referencia);
  if (tabla) return tabla;
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const encabezado = lineas.find((l) => /fecha/i.test(l) && /consumo|compra|transacci[oó]n/i.test(l));
  const consumoSegundo = !!encabezado && /fecha.*(?:proceso|registro|movimiento).*fecha.*(?:consumo|compra|transacci[oó]n)/i.test(encabezado);
  return lineas.flatMap((linea) => {
    const fechas = [...linea.matchAll(FECHA)].filter((m) => m.index !== undefined);
    if (!fechas.length || fechas[0].index !== 0) return [];
    const elegida = fechas[consumoSegundo && fechas.length > 1 ? 1 : 0];
    const fechasConsecutivas = fechas.length > 1 &&
      !linea.slice(fechas[0][0].length, fechas[1].index).trim();
    const ultima = fechasConsecutivas ? fechas[1] : fechas[0];
    const resto = linea.slice(ultima.index! + ultima[0].length).trim();
    const monto = [...resto.matchAll(MONTO)][0];
    if (!monto || monto.index === undefined) return [];
    const item = movimiento(fechaNormalizada(elegida[0], referencia), resto.slice(0, monto.index).trim(), monto[1]);
    return item ? [item] : [];
  });
}
