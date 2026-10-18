import { fechaIso } from "../schemas/limites";
import { clasificarConsumoEstadoCuenta, normalizarNumero } from "./textoFinanciero";
import { fechaLocal } from "./semanas";

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
// Meses con letras («15-OCT-2026», «12 oct.»): en español y las abreviaturas
// en inglés que imprimen algunos sistemas bancarios.
const NOMBRE_MES = "ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?|jan|apr|aug|dec";
const NUMERO_MES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};
// 2026-10-15 · 2026/10/15 · 15/10/2026 · 15-10-26 · 15/10 · 15-OCT-2026 · 15 oct 2026 · 15OCT
const PATRON_FECHA = `(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?|\\d{1,2}[\\s/-]?(?:${NOMBRE_MES})\\.?(?:[/-]\\d{2,4}|\\s\\d{4}|\\d{4})?)(?![\\p{L}\\d])`;
const FECHA = new RegExp(PATRON_FECHA, "giu");
const FECHA_CON_NOMBRE = new RegExp(`^(\\d{1,2})[\\s/-]?(${NOMBRE_MES})\\.?(?:[\\s/-]?(\\d{2,4}))?$`, "iu");
const CORTE = new RegExp(`(?:fecha\\s+de\\s+corte|corte|periodo\\s+hasta)\\s*[:\\s]+(${PATRON_FECHA})`, "iu");
// Lo que puede ir antes de la fecha en una fila: un número de referencia o de documento.
const PREFIJO_FILA = /^[\d#.\-\s]{0,14}$/;
// Fragmentos de un PDF a menos de esta distancia vertical son la misma línea visual.
const TOLERANCIA_LINEA_PT = 2.5;
const MONTO = /(?:^|[\s(])([-+]?\$?\s?(?:\d{1,3}(?:[.,\s]\d{3})+|\d+)[.,]\d{2})(?!\d)/g;

function fechaValida(fecha: string): boolean {
  return fechaIso().safeParse(fecha).success;
}

function fechaNormalizada(valor: string, referencia: string): string | undefined {
  let anio: number | undefined;
  let mes: number;
  let dia: number;
  const conNombre = valor.trim().match(FECHA_CON_NOMBRE);
  if (conNombre) {
    dia = Number(conNombre[1]);
    mes = NUMERO_MES[conNombre[2].slice(0, 3).toLowerCase()];
    anio = conNombre[3] ? Number(conNombre[3]) : undefined;
  } else if (/^\d{4}[-/]/.test(valor)) {
    [anio, mes, dia] = valor.split(/[-/]/).map(Number);
  } else {
    [dia, mes, anio] = valor.split(/[/-]/).map(Number);
  }
  if (anio === undefined || Number.isNaN(anio)) {
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
  const corte = texto.match(CORTE);
  if (corte) return fechaNormalizada(corte[1], "2000-01-01") ?? fechaLocal();
  return fechaLocal();
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

/** Un trozo de texto de una página de PDF con su posición (coordenadas de PDF: Y crece hacia arriba). */
export interface FragmentoTextoPdf {
  texto: string;
  x: number;
  y: number;
}

/**
 * pdf.js entrega fragmentos sueltos con su posición, no líneas armadas: se
 * juntan los que están a menos de 2,5 pt de altura (misma línea visual) y se
 * ordenan por X para reconstruir el orden de lectura. Se agrupa por cercanía y
 * no redondeando la altura: con el redondeo, 700,9 y 701,1 caían en líneas
 * distintas y la fila quedaba partida (fecha por un lado, monto por otro).
 * Lo usan la web (pdf.js directo) y el teléfono (pdf.js dentro de un WebView).
 */
export function lineasDeTextoPdf(fragmentos: FragmentoTextoPdf[]): string[] {
  const visibles = fragmentos.filter((f) => f.texto.trim()).sort((a, b) => b.y - a.y); // de arriba hacia abajo
  const lineas: { y: number; fragmentos: FragmentoTextoPdf[] }[] = [];
  for (const f of visibles) {
    const actual = lineas[lineas.length - 1];
    if (actual && actual.y - f.y <= TOLERANCIA_LINEA_PT) actual.fragmentos.push(f);
    else lineas.push({ y: f.y, fragmentos: [f] });
  }
  return lineas.map((l) =>
    l.fragmentos
      .sort((a, b) => a.x - b.x)
      .map((f) => f.texto)
      .join(" ")
  );
}

/** Una página escaneada (solo imagen) casi no trae texto: hace falta OCR para leerla. */
export function paginaSinTexto(fragmentos: Pick<FragmentoTextoPdf, "texto">[]): boolean {
  return fragmentos.map((f) => f.texto).join("").trim().length < 8;
}

/** Lee texto extraído de PDF/OCR o CSV de cualquier banco sin depender de su nombre. */
export function parseEstadoCuenta(texto: string, opciones: OpcionesEstadoCuenta = {}): TransaccionEstadoCuenta[] {
  const referencia = referenciaDe(texto, opciones);
  const tabla = parsearTabla(texto, referencia);
  if (tabla) return tabla;
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const encabezado = lineas.find((l) => /fecha/i.test(l) && /consumo|compra|transacci[oó]n/i.test(l));
  const consumoSegundo = !!encabezado && /fecha.*(?:proceso|registro|movimiento).*fecha.*(?:consumo|compra|transacci[oó]n)/i.test(encabezado);
  const fechasDe = (linea: string) => {
    const fechas = [...linea.matchAll(FECHA)].filter((m) => m.index !== undefined);
    // La fila empieza con la fecha (antes, a lo sumo, un número de referencia).
    return fechas.length && PREFIJO_FILA.test(linea.slice(0, fechas[0].index)) ? fechas : [];
  };
  const resultado: TransaccionEstadoCuenta[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const fechas = fechasDe(linea);
    if (!fechas.length) continue;
    const elegida = fechas[consumoSegundo && fechas.length > 1 ? 1 : 0];
    const fechasConsecutivas = fechas.length > 1 &&
      !linea.slice(fechas[0].index! + fechas[0][0].length, fechas[1].index).trim();
    const ultima = fechasConsecutivas ? fechas[1] : fechas[0];
    let resto = linea.slice(ultima.index! + ultima[0].length).trim();
    let monto = [...resto.matchAll(MONTO)][0];
    // El monto quedó solo en la línea de abajo (otra altura u otra columna).
    const siguiente = lineas[i + 1];
    if (!monto && siguiente && !fechasDe(siguiente).length && !IGNORAR.test(siguiente)) {
      const montoAbajo = [...siguiente.matchAll(MONTO)][0];
      if (montoAbajo?.index !== undefined && montoAbajo.index <= 40) {
        resto = `${resto} ${siguiente}`;
        monto = [...resto.matchAll(MONTO)][0];
        i++;
      }
    }
    if (!monto || monto.index === undefined) continue;
    const item = movimiento(fechaNormalizada(elegida[0], referencia), resto.slice(0, monto.index).trim(), monto[1]);
    if (item) resultado.push(item);
  }
  return resultado;
}
