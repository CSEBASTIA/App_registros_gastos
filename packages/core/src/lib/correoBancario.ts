import type { Banco } from "../types/domain";
import { normalizarNumero, sugerirCategoria } from "./textoFinanciero";
import { fechaIso } from "../schemas/limites";

/**
 * Direcciones desde las que cada banco envía avisos de movimientos, para saber
 * de qué banco vino un aviso. Salieron de una bandeja real (16-oct-2026; solo
 * se miraron remitente y asunto, nunca montos ni datos personales).
 *
 * Son direcciones EXACTAS y no dominios, a propósito: el mismo dominio manda
 * también publicidad (info@email.bancoguayaquil.com, comunicados@pichincha.com)
 * y avisos de ingreso a la banca (logininfo@pichincha.com) que no son
 * movimientos y no deben quedar atribuidos al banco.
 *
 * Sin muestras todavía: Produbanco, Diners Club y Banco del Austro. Un aviso
 * de un remitente que no está aquí igual llega a la Bandeja (con
 * `banco: undefined`); la persona elige banco y cuenta a mano.
 */
export const REMITENTES_BANCO: Partial<Record<Banco, string[]>> = {
  pichincha: ["banco@pichincha.com"],
  banco_guayaquil: ["bancoguayaquil@bancoguayaquil.com", "bancavirtual@bancoguayaquil.com"],
  banco_pacifico: ["intermail@bancopacifico.ec"],
};

const PALABRAS_GASTO =
  /\b(compra|consumo|d[eé]bito|retiro|pago\s+(?:realizado|enviado|exitoso)|tu\s+pago\s+con\s+tu\s+tarjeta|transferencia\s+(?:enviada|realizada|exitosa)|realizaste\s+una\s+transferencia|env[ií]o\s+de\s+dinero)\b/i;
const PALABRAS_INGRESO =
  /\b(dep[oó]sito|abono\s+(?:recibido)?|acreditaci[oó]n|transferencia\s+recibida|pago\s+recibido|has\s+recibido\s+dinero|sueldo|rol\s+de\s+pagos)\b/i;

// Transferencia (enviada o recibida): la base intenta juntarla con el aviso de
// la otra cuenta propia, en vez de contarla como gasto e ingreso a la vez.
const ES_TRANSFERENCIA =
  /\b(transferencia|transferiste|te\s+transfiri[oó]|env[ií]o\s+de\s+dinero|has\s+recibido\s+dinero)\b/i;

// Monto con 2 decimales, con o sin separador de miles ("1.234,56", "1,234.56",
// "1234.56"). Debe empezar al inicio o tras algo que no sea dígito ni separador:
// sin esa condición, "$1234.56" se leía como 234.56.
const REGEX_MONTO = /(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?!\d)/;
// Con la moneda delante se acepta también "USD 7.5" o "$ 5" (sin ceros de más).
const REGEX_MONTO_CON_MONEDA = /(?:USD|US\$|\$)\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/i;
// Pago a la tarjeta propia: es una salida de dinero, no un ingreso (aunque diga "abono").
const PAGO_A_TARJETA = /\b(?:(?:abono|pago)\s+(?:a|de)\s+(?:tu|su)\s+tarjeta|pago\s+tarjeta\s+propia)\b/i;
// "cuenta ****1234" / "tarjeta terminada en 5678" / "cta. 1234"
const REGEX_IDENTIFICADOR = /(?:cuenta|tarjeta|cta\.?)[^\d]{0,18}(\d{3,4})\b/i;
// Fechas que NO son la del movimiento: el corte, el vencimiento, el límite de pago.
const CONTEXTO_FECHA_AJENA = /(?:corte|vence|vencimiento|l[ií]mite|hasta|pr[oó]ximo)[^\d]{0,24}$/i;

export type ClaseCorreo = "consumo" | "pago_tarjeta" | "transferencia";

export interface CorreoParseado {
  tipo: "gasto" | "ingreso" | undefined;
  monto: number | undefined;
  fecha: string | undefined;
  descripcion: string;
  banco: Banco | undefined;
  identificadorCuenta: string | undefined;
  categoriaSugerida: string | undefined;
  /** Habla de una transferencia: puede ser entre cuentas propias (la base busca la otra mitad). */
  esTransferencia: boolean;
  /**
   * Qué es, si el formato del aviso se reconoció con seguridad (plantilla de un
   * banco). Solo estos avisos pueden registrarse solos; el resto va a la Bandeja.
   */
  clase?: ClaseCorreo;
  /** Comercio de un consumo con tarjeta. */
  comercio?: string;
  /** Últimos dígitos de la tarjeta (consumo, pago) o de la cuenta de origen (transferencia). */
  tarjetaFinal?: string;
  /** Pago de tarjeta: dígitos de la cuenta que pagó. Transferencia: dígitos de la cuenta destino. */
  contraparteFinal?: string;
  /** Banco de la cuenta destino de una transferencia, si el aviso lo dice. */
  contraparteBanco?: Banco;
  /** Comisión que cobró el banco por la operación (aparte del monto). */
  comision?: number;
  /** Fecha y hora exactas del movimiento (hora de Ecuador), si el aviso las trae. */
  pagadoEn?: string;
}

/** "Banco X <avisos@banco.com>" → "avisos@banco.com". Se usa la dirección real, nunca el nombre visible. */
function direccionDe(remitente: string): string {
  const entreAngulos = remitente.match(/<([^>]+)>/);
  return (entreAngulos ? entreAngulos[1] : remitente).trim().toLowerCase();
}

/**
 * Coincidencia estricta para que un remitente falso no pase por banco:
 * con "@" se exige la dirección exacta; sin "@" se exige el dominio exacto
 * o un subdominio suyo. Antes se usaba `includes`, que aceptaba por ejemplo
 * "avisos@bancoguayaquil.com.estafa.net".
 * (No reemplaza una verificación DKIM/SPF: un From falsificado con el
 * dominio real seguiría pasando; por eso lo reconocido por plantilla solo se
 * registra solo si la persona ya anotó los dígitos de esa cuenta o tarjeta.)
 */
function remitenteCoincide(direccion: string, patron: string): boolean {
  const p = patron.trim().toLowerCase();
  if (p.includes("@")) return direccion === p;
  const dominio = direccion.split("@")[1] ?? "";
  return dominio === p || dominio.endsWith(`.${p}`);
}

export function bancoDeRemitente(
  remitente: string,
  remitentes: Partial<Record<Banco, string[]>> = REMITENTES_BANCO
): Banco | undefined {
  const direccion = direccionDe(remitente);
  for (const [banco, patrones] of Object.entries(remitentes) as [Banco, string[]][]) {
    if (patrones.some((p) => remitenteCoincide(direccion, p))) return banco;
  }
  return undefined;
}

/** «BANCO PICHINCHA», «BANCO DE GUAYAQUIL SA»… → el banco de la app; «DE UNA» y otros → undefined. */
export function bancoDeNombre(nombre: string): Banco | undefined {
  const t = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/pichincha/.test(t)) return "pichincha";
  if (/guayaquil/.test(t)) return "banco_guayaquil";
  if (/pacifico/.test(t)) return "banco_pacifico";
  if (/produbanco/.test(t)) return "produbanco";
  if (/diners/.test(t)) return "diners_club";
  if (/austro/.test(t)) return "banco_austro";
  return undefined;
}

function fechaValida(anio: string, mes: string, dia: string): string | undefined {
  const fecha = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  return fechaIso().safeParse(fecha).success ? fecha : undefined;
}

/**
 * Fecha del movimiento. Antes se tomaba la primera fecha del texto, y en el
 * aviso de un consumo con tarjeta eso era «Fecha de corte 2026-11-17»: el gasto
 * quedaba un mes en el futuro y nadie lo veía. Ahora se saltan las fechas que
 * siguen a «corte», «vence», «límite»… y solo se devuelven fechas que existen
 * en el calendario (una imposible hacía fallar el lote entero al guardarse).
 */
function extraerFecha(texto: string): string | undefined {
  const patrones: { regex: RegExp; armar: (m: RegExpMatchArray) => string | undefined }[] = [
    { regex: /(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/g, armar: (m) => fechaValida(m[1], m[2], m[3]) },
    {
      regex: /(?<![\d/-])(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?![\d/-])/g,
      armar: (m) => fechaValida(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1]),
    },
  ];
  let primera: { posicion: number; fecha: string } | undefined;
  for (const { regex, armar } of patrones) {
    for (const m of texto.matchAll(regex)) {
      const posicion = m.index ?? 0;
      if (CONTEXTO_FECHA_AJENA.test(texto.slice(Math.max(0, posicion - 34), posicion))) continue;
      const fecha = armar(m);
      if (fecha && (!primera || posicion < primera.posicion)) primera = { posicion, fecha };
    }
  }
  return primera?.fecha;
}

/**
 * Heurística de asunto + palabras clave: no distingue perfecto (un correo
 * de "pago recibido" de una tarjeta ajena podría no ser un ingreso propio),
 * así que esto siempre pasa por la cola de revisión — nunca se guarda solo.
 */
function tipoDeCorreo(texto: string): "gasto" | "ingreso" | undefined {
  if (PAGO_A_TARJETA.test(texto)) return "gasto";
  if (PALABRAS_INGRESO.test(texto)) return "ingreso";
  if (PALABRAS_GASTO.test(texto)) return "gasto";
  return undefined;
}

// ---------------------------------------------------------------------------
// Plantillas de los avisos reales de cada banco (muestras del 17–19-oct-2026)
// ---------------------------------------------------------------------------

/** El texto sin la maquinaria de tablas, enlaces y asteriscos: etiquetas y valores quedan en una sola línea. */
function plano(texto: string): string {
  return texto
    .replace(/[ ​-‏⁠﻿͏]/g, " ")
    .replace(/[|#*_>[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function monto(texto: string | undefined): number | undefined {
  if (!texto) return undefined;
  const n = Math.abs(normalizarNumero(texto.trim().replace(/[.,]+$/, "")));
  return Number.isFinite(n) && n >= 0.01 && n < 1_000_000 ? n : undefined;
}

/** El número que sigue a una etiqueta («Monto: USD 7.5», «Valor Pagado $ 50.00»). */
function montoTrasEtiqueta(texto: string, etiqueta: string): number | undefined {
  const m = texto.match(new RegExp(`(?:${etiqueta})\\s*:?\\s*(?:Concepto\\s*)?(?:USD|US\\$|\\$)?\\s*(\\d[\\d.,]*)`, "i"));
  return monto(m?.[1]);
}

/** Últimos dígitos de un número enmascarado («123456-XXXXX-1234», «XXXXXXX321», «0000-XXXX-21», «1111»). */
function ultimosDigitos(token: string | undefined): string | undefined {
  return token?.match(/(\d{2,4})\D*$/)?.[1];
}

/** `12/10/2026`, `2026/10/17`… → `YYYY-MM-DD` (solo si existe en el calendario). */
function soloFecha(texto: string | undefined): string | undefined {
  if (!texto) return undefined;
  const a = texto.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (a) return fechaValida(a[1], a[2], a[3]);
  const b = texto.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return b ? fechaValida(b[3], b[2], b[1]) : undefined;
}

/** «2026/10/17 A LAS 12:34:56», «17/10/2026 13:45:00», «17/10/2026 a la(s) 10:30»: fecha y hora de Ecuador. */
function fechaYHora(texto: string): { fecha: string; pagadoEn?: string } | undefined {
  const m =
    texto.match(/(?<!\d)(\d{4})[/-](\d{2})[/-](\d{2})\s+(?:a\s+las\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?/i) ??
    texto.match(/(?<!\d)(\d{1,2})[/-](\d{2})[/-](\d{4})\s+(?:a\s+la\(?s\)?\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (!m) return undefined;
  const [anio, mes, dia] = m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  const fecha = fechaValida(anio, mes, dia);
  if (!fecha) return undefined;
  const hora = Number(m[4]);
  const minuto = Number(m[5]);
  if (hora > 23 || minuto > 59) return { fecha };
  return { fecha, pagadoEn: `${fecha}T${String(hora).padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}-05:00` };
}

interface Contexto {
  asunto: string;
  /** Todo el texto (asunto + cuerpo) ya aplanado. */
  t: string;
}

type Plantilla = (c: Contexto) => Partial<CorreoParseado> | undefined;

/** Guayaquil — «X realizó un consumo por $ 12.34 en TIENDA PRUEBA S A» (tarjeta de crédito o de débito). */
const guayaquilConsumo: Plantilla = ({ asunto, t }) => {
  if (!/consumo/i.test(t)) return undefined;
  const enAsunto = plano(asunto).match(/consumo\s+por\s+\$?\s*(\d[\d.,]*)\s+en\s+(.+)$/i);
  const enCuerpo = t.match(
    /Detalle de tu consumo\s*\$?\s*(\d[\d.,]*)\s+(.+?)\s+(?:AMEX|VISA|MASTER(?:CARD)?|DINERS|DISCOVER)\b/i
  );
  const fuente = enAsunto ?? enCuerpo;
  const valor = monto(fuente?.[1]);
  const comercio = fuente?.[2]?.trim();
  if (!valor || !comercio) return undefined;
  const tarjeta =
    t.match(/(?:AMEX|VISA|MASTER(?:CARD)?|DINERS|DISCOVER)[^\d]{0,6}\d{4,6}[-\sXx•]+(\d{3,4})(?!\d)/i)?.[1] ??
    t.match(/\d{4,6}[-\s]*[Xx•]{3,}[-\sXx•]*(\d{3,4})(?!\d)/)?.[1];
  return {
    clase: "consumo",
    tipo: "gasto",
    monto: valor,
    comercio,
    descripcion: comercio,
    tarjetaFinal: tarjeta,
    // «Fecha de corte» no es la del consumo.
    ...fechaYHora(t.replace(/Fecha de corte\s*\S+/i, " ")),
  };
};

/** Pichincha — «Pago exitoso … tu pago con tu Tarjeta de Débito … Monto $ 50.00 Comercio Supermaxi Número de tarjeta 1111». */
const pichinchaTarjeta: Plantilla = ({ t }) => {
  const valor = montoTrasEtiqueta(t, "Monto");
  const comercio = t.match(/Comercio\s*:?\s*(.+?)\s+(?:Fecha|N[uú]mero de tarjeta|Monto)\b/i)?.[1]?.trim();
  const tarjeta = t.match(/N[uú]mero de tarjeta\s*:?\s*(\d{3,4})(?!\d)/i)?.[1];
  if (!valor || !comercio || !tarjeta) return undefined;
  return {
    clase: "consumo",
    tipo: "gasto",
    monto: valor,
    comercio,
    descripcion: comercio,
    tarjetaFinal: tarjeta,
    ...fechaYHora(t),
  };
};

/** Guayaquil — «Gracias por el pago de tu tarjeta»: pago con débito a la cuenta. */
const guayaquilPagoTarjeta: Plantilla = ({ t }) => {
  if (!/pago de tu tarjeta|Agradecemos el pago/i.test(t)) return undefined;
  const valor = montoTrasEtiqueta(t, "Pago realizado");
  const tarjeta = ultimosDigitos(t.match(/Tarjeta de cr[eé]dito\s+\S+\s+N[uú]mero\s+(\S+)/i)?.[1]);
  const cuenta = ultimosDigitos(t.match(/Pago con d[eé]bito en\s+\S+\s+N[uú]mero\s+(\S+)/i)?.[1]);
  if (!valor || !tarjeta) return undefined;
  return {
    clase: "pago_tarjeta",
    tipo: "gasto",
    monto: valor,
    descripcion: `Pago de la tarjeta ••${tarjeta}`,
    tarjetaFinal: tarjeta,
    contraparteFinal: cuenta,
    ...fechaYHora(t.match(/Fecha de d[eé]bito\s+(\S+\s+\S+)/i)?.[1] ?? ""),
  };
};

/** Guayaquil (banca virtual) — comprobantes: pago de tarjeta propia y transferencias. */
const guayaquilComprobante: Plantilla = ({ asunto, t }) => {
  if (!/Comprobante/i.test(t) || !/Datos del Ordenante/i.test(t)) return undefined;
  const numeros = [...t.matchAll(/No\.\s*de\s*(Cuenta|Tarjeta)\s*:?\s*(\S+)/gi)].map((m) => ({
    clase: m[1].toLowerCase(),
    digitos: ultimosDigitos(m[2]),
  }));
  const ordenante = numeros.find((n) => n.clase === "cuenta")?.digitos;
  const hora = fechaYHora(t.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/)?.[0] ?? "");
  const resumen = `${asunto} ${t}`;

  if (/PAGO TARJETA PROPIA/i.test(resumen)) {
    const valor = montoTrasEtiqueta(t, "Valor Pagado") ?? montoTrasEtiqueta(t, "Total Debitado");
    const tarjeta = numeros.find((n) => n.clase === "tarjeta")?.digitos;
    if (!valor || !tarjeta) return undefined;
    return {
      clase: "pago_tarjeta",
      tipo: "gasto",
      monto: valor,
      descripcion: `Pago de la tarjeta ••${tarjeta}`,
      tarjetaFinal: tarjeta,
      contraparteFinal: ordenante,
      ...hora,
    };
  }

  if (/Transferencia/i.test(resumen)) {
    const valor = montoTrasEtiqueta(t, "Valor Transferido");
    const destino = numeros.filter((n) => n.clase === "cuenta")[1]?.digitos;
    const bancoDestino = bancoDeNombre(t.match(/Banco de la Cuenta\s*:?\s*(.+?)\s+(?:Valor|Total|Concepto)\b/i)?.[1] ?? "");
    if (!valor || !ordenante) return undefined;
    return {
      clase: "transferencia",
      tipo: "gasto",
      esTransferencia: true,
      monto: valor,
      comision: montoTrasEtiqueta(t, "Valor Comisi[oó]n"),
      descripcion: `Transferencia a ${destino ? `la cuenta ••${destino}` : "otra cuenta"}`,
      tarjetaFinal: ordenante,
      contraparteFinal: destino,
      contraparteBanco: bancoDestino,
      ...hora,
    };
  }
  return undefined;
};

/** Pichincha — «Transferencia exitosa» / «Pago realizado correctamente» con cuenta de origen y destino. */
const pichinchaTransferencia: Plantilla = ({ t }) => {
  if (!/Cuenta de origen/i.test(t) || !/Cuenta (?:destino|acreditada)/i.test(t)) return undefined;
  // «La transferencia solicitada será debitada…» es el aviso previo; el definitivo llega después.
  if (/ser[aá]\s+debitada/i.test(t)) return undefined;
  const valor = montoTrasEtiqueta(t, "Monto");
  const origen = ultimosDigitos(t.match(/Cuenta de origen\s*:?\s*(?:N[uú]mero de cuenta\s*:?\s*)?(\S+)/i)?.[1]);
  const destino =
    ultimosDigitos(t.match(/Cuenta acreditada\s*:?\s*(\S+)/i)?.[1]) ??
    t.match(/Cuenta destino[^\d]*?(\d{3,4})(?!\d)/i)?.[1];
  const bancoTexto = t.match(/Banco destino\s*:?\s*(.+?)\s+Cuenta acreditada/i)?.[1]?.trim();
  if (!valor || !origen) return undefined;
  return {
    clase: "transferencia",
    tipo: "gasto",
    esTransferencia: true,
    monto: valor,
    descripcion: `Transferencia${bancoTexto ? ` a ${bancoTexto.toLowerCase()}` : ""}${destino ? ` ••${destino}` : ""}`,
    tarjetaFinal: origen,
    contraparteFinal: destino,
    // Sin «Banco destino» es una transferencia dentro del mismo banco.
    contraparteBanco: bancoTexto ? bancoDeNombre(bancoTexto) : "pichincha",
    fecha: soloFecha(t.match(/Fecha\s*:?\s*(?:\d{5,}\s+)?(\d{1,2}\/\d{2}\/\d{4})/i)?.[1]),
  };
};

const PLANTILLAS: Plantilla[] = [
  guayaquilConsumo,
  guayaquilPagoTarjeta,
  guayaquilComprobante,
  pichinchaTransferencia,
  pichinchaTarjeta,
];

/**
 * Intenta extraer una transacción de un correo bancario. Nunca lanza si no
 * encuentra algo — devuelve lo que pudo, con el resto en `undefined` para
 * que el usuario lo complete en la pantalla de revisión ("Bandeja").
 *
 * Los formatos conocidos de cada banco se leen con una plantilla y llevan
 * `clase`: la app puede registrarlos sola si reconoce la cuenta. Todo lo demás
 * se lee con palabras clave y siempre pasa por la Bandeja.
 */
export function parsearCorreoBancario(remitente: string, asunto: string, cuerpoTexto: string): CorreoParseado {
  const banco = bancoDeRemitente(remitente);
  const texto = `${asunto}\n${cuerpoTexto}`;
  const t = plano(texto);

  // Las plantillas solo valen para remitentes de bancos conocidos.
  if (banco) {
    for (const plantilla of PLANTILLAS) {
      const r = plantilla({ asunto, t });
      if (r?.monto && r.tipo) {
        const { fecha, ...resto } = r;
        return {
          fecha: fecha ?? extraerFecha(t),
          descripcion: asunto.trim() || "Movimiento bancario",
          banco,
          identificadorCuenta: r.tarjetaFinal,
          categoriaSugerida: sugerirCategoria(r.comercio ?? t),
          esTransferencia: false,
          ...resto,
        } as CorreoParseado;
      }
    }
  }

  const matchMonto = texto.match(REGEX_MONTO) ?? texto.match(REGEX_MONTO_CON_MONEDA);
  const montoGenerico = matchMonto ? Math.abs(normalizarNumero(matchMonto[1])) : undefined;
  const matchId = texto.match(REGEX_IDENTIFICADOR);

  return {
    tipo: tipoDeCorreo(texto),
    monto: montoGenerico && montoGenerico > 0 && montoGenerico < 1_000_000 ? montoGenerico : undefined,
    fecha: extraerFecha(t),
    descripcion: asunto.trim() || "Movimiento bancario",
    banco,
    identificadorCuenta: matchId ? matchId[1] : undefined,
    categoriaSugerida: sugerirCategoria(texto),
    // Un pago a la tarjeta propia ya tiene su camino («Pagar tarjeta»).
    esTransferencia: ES_TRANSFERENCIA.test(texto) && !PAGO_A_TARJETA.test(texto),
  };
}

/** Quita etiquetas HTML de un cuerpo de correo (Graph entrega el body como HTML) y colapsa espacios. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
