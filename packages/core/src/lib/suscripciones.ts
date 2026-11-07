import type { Gasto } from "../types/domain";
import { diasEntre } from "./corteTarjeta";
import { sumarMeses } from "./semanas";

/**
 * Detector de suscripciones: busca en los gastos los cobros que se repiten
 * cada mes en el mismo comercio (Netflix, Spotify, el gimnasio…).
 *
 * - Un comercio cuenta como suscripción con 3 cobros mensuales seguidos, o
 *   con 2 si es un servicio conocido (Netflix con dos cobros ya lo es; el
 *   supermercado no, aunque se compre ahí cada mes).
 * - "Mensual" = entre 25 y 35 días entre un cobro y el siguiente.
 * - Si el último cobro es más caro que el anterior, avisa que subió el precio.
 * - Si pasan más de 10 días de la fecha esperada sin cobro, se da por cancelada.
 */
export type EstadoSuscripcion = "activa" | "cancelada";

export interface Suscripcion {
  /** Nombre del comercio normalizado (sin tildes, números ni referencias). */
  clave: string;
  /** Cómo se muestra: el servicio conocido o la descripción del último cobro. */
  nombre: string;
  /** Monto del último cobro. */
  monto: number;
  /** Monto del cobro anterior, solo cuando el último fue más caro. */
  montoAnterior?: number;
  subioPrecio: boolean;
  /** Cobros mensuales seguidos (el último tramo sin saltos). */
  cobros: number;
  ultimoCobro: string;
  /** Un mes después del último cobro. */
  proximoCobro: string;
  categoriaId: string;
  cuentaId?: string;
  estado: EstadoSuscripcion;
  /** Días pasados de la fecha esperada sin cobro (0 si aún no toca). */
  diasAtraso: number;
  /** Ids de los gastos que forman la suscripción. */
  gastoIds: string[];
}

export const DIAS_PARA_CANCELADA = 10;
const MIN_DIAS_ENTRE_COBROS = 25;
const MAX_DIAS_ENTRE_COBROS = 35;

/** Servicios que casi siempre son suscripción: con 2 cobros basta. El orden importa ("apple music" antes que "apple"). */
const SERVICIOS_CONOCIDOS: [patron: RegExp, nombre: string][] = [
  [/netflix/, "Netflix"],
  [/spotify/, "Spotify"],
  [/disney/, "Disney+"],
  [/\bhbo\b|\bmax\.com\b|\bhbomax\b/, "Max"],
  [/prime ?video|amazon ?prime/, "Amazon Prime"],
  [/youtube/, "YouTube Premium"],
  [/paramount/, "Paramount+"],
  [/star ?plus|\bstar\+/, "Star+"],
  [/crunchyroll/, "Crunchyroll"],
  [/deezer/, "Deezer"],
  [/apple ?music/, "Apple Music"],
  [/icloud/, "iCloud"],
  [/apple\.com|apple ?one/, "Apple"],
  [/google ?one|google ?storage/, "Google One"],
  [/chatgpt|openai/, "ChatGPT"],
  [/anthropic|claude\.ai/, "Claude"],
  [/microsoft ?365|office ?365|\bxbox\b/, "Microsoft"],
  [/playstation|\bpsn\b/, "PlayStation"],
  [/adobe/, "Adobe"],
  [/canva/, "Canva"],
  [/dropbox/, "Dropbox"],
  [/smart ?fit/, "Smart Fit"],
];

function textoSinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** El servicio conocido al que corresponde una descripción, si alguno. */
export function servicioConocido(descripcion: string): string | undefined {
  const t = textoSinAcentos(descripcion);
  return SERVICIOS_CONOCIDOS.find(([patron]) => patron.test(t))?.[1];
}

/**
 * Clave para agrupar cobros del mismo comercio: "NETFLIX.COM 8829-221" y
 * "Netflix.com" son lo mismo. Los servicios conocidos usan su nombre; el
 * resto, la descripción sin números, puntuación ni palabras de relleno.
 */
export function claveComercio(descripcion: string): string {
  const conocido = servicioConocido(descripcion);
  if (conocido) return conocido.toLowerCase();
  return textoSinAcentos(descripcion)
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((p) => p.length > 1 && !["com", "www", "pago", "compra", "cobro", "consumo", "ec", "sa"].includes(p))
    .join(" ");
}

function esMensual(desde: string, hasta: string): boolean {
  const dias = diasEntre(desde, hasta);
  return dias >= MIN_DIAS_ENTRE_COBROS && dias <= MAX_DIAS_ENTRE_COBROS;
}

/** El último tramo de cobros mensuales seguidos (ordenados por fecha). */
function tramoMensual(cobros: Gasto[]): Gasto[] {
  let inicio = cobros.length - 1;
  while (inicio > 0 && esMensual(cobros[inicio - 1].fecha, cobros[inicio].fecha)) inicio--;
  return cobros.slice(inicio);
}

/** Suscripciones encontradas en los gastos, las activas primero y luego por monto. */
export function detectarSuscripciones(gastos: Gasto[], hoy: string): Suscripcion[] {
  const porComercio = new Map<string, Gasto[]>();
  for (const g of gastos) {
    if (g.monto <= 0 || g.fecha > hoy) continue;
    const clave = claveComercio(g.descripcion);
    if (!clave) continue;
    porComercio.set(clave, [...(porComercio.get(clave) ?? []), g]);
  }

  const resultado: Suscripcion[] = [];
  for (const [clave, lista] of porComercio) {
    // Dos cobros el mismo día (un reintento, una compra doble) cuentan como uno: el último registrado.
    const porDia = new Map<string, Gasto>();
    for (const g of [...lista].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) porDia.set(g.fecha, g);
    const cobros = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const tramo = tramoMensual(cobros);
    const conocido = servicioConocido(tramo[tramo.length - 1].descripcion);
    if (tramo.length < (conocido ? 2 : 3)) continue;

    const ultimo = tramo[tramo.length - 1];
    const anterior = tramo[tramo.length - 2];
    const subioPrecio = Math.round(ultimo.monto * 100) > Math.round(anterior.monto * 100);
    const proximoCobro = sumarMeses(ultimo.fecha, 1);
    const diasAtraso = Math.max(0, diasEntre(proximoCobro, hoy));

    resultado.push({
      clave,
      nombre: conocido ?? ultimo.descripcion.trim(),
      monto: ultimo.monto,
      ...(subioPrecio ? { montoAnterior: anterior.monto } : {}),
      subioPrecio,
      cobros: tramo.length,
      ultimoCobro: ultimo.fecha,
      proximoCobro,
      categoriaId: ultimo.categoriaId,
      ...(ultimo.cuentaId ? { cuentaId: ultimo.cuentaId } : {}),
      estado: diasAtraso > DIAS_PARA_CANCELADA ? "cancelada" : "activa",
      diasAtraso,
      gastoIds: tramo.map((g) => g.id),
    });
  }

  return resultado.sort((a, b) =>
    a.estado !== b.estado ? (a.estado === "activa" ? -1 : 1) : b.monto - a.monto,
  );
}

/** Lo que suman al mes las suscripciones activas. */
export function totalMensualSuscripciones(suscripciones: Suscripcion[]): number {
  return suscripciones
    .filter((s) => s.estado === "activa")
    .reduce((acc, s) => acc + Math.round(s.monto * 100), 0) / 100;
}
