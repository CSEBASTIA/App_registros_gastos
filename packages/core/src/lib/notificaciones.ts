/**
 * Notificaciones del teléfono: qué avisar, cuándo y con qué texto. Las
 * programa el propio teléfono (notificaciones locales), sin un servidor que
 * conozca tus montos. Aquí solo hay reglas, sin plataforma, para probarlas.
 *
 * Los pagos con billetera registrados solos (o que esperan en la bandeja)
 * los avisa el módulo nativo de Android en el momento, aunque la app esté
 * cerrada; sus textos están en `EnvioAvisos.kt`.
 */
import type { AvisoPresupuesto, Recordatorio } from "../types/domain";
import type { AlmacenPreferencias } from "./ubicacionDispositivo";
import { organizarRecordatorios, textoVencimiento } from "./recordatorios";
import { fechaLocal } from "./semanas";
import { formatMonto } from "./formatMonto";
import { sumarMontos } from "./montos";

export type DiasAntesRecordatorio = 0 | 1 | 3;
export const OPCIONES_DIAS_ANTES: DiasAntesRecordatorio[] = [0, 1, 3];

export interface PreferenciasNotificaciones {
  /** «Registré $12,50 en SUPERMAXI»: un pago con billetera que se registró solo. */
  pagos: boolean;
  /** Un pago detectado que espera en la bandeja para que lo confirmes. */
  bandeja: boolean;
  /** Recordatorios y cuotas de diferidos antes de que venzan. */
  recordatorios: boolean;
  /** Cuántos días antes del vencimiento (0 = el mismo día). */
  diasAntes: DiasAntesRecordatorio;
  /** Hora del día (0-23) para los avisos de recordatorios. */
  hora: number;
  /** Al llegar al 75 %, al 100 % y al pasarte de un presupuesto. */
  presupuestos: boolean;
}

export const PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO: PreferenciasNotificaciones = {
  pagos: true,
  bandeja: true,
  recordatorios: true,
  diasAntes: 1,
  hora: 9,
  presupuestos: true,
};

/** Por usuario, no por teléfono: quien inicia sesión después no hereda las elecciones de otro. */
export function clavePreferenciasNotificaciones(usuarioId: string): string {
  return `fintrack.notificaciones.${usuarioId}`;
}

/** Cualquier valor raro vuelve al de por defecto, campo por campo. */
export function normalizarPreferenciasNotificaciones(valor: unknown): PreferenciasNotificaciones {
  const v = (valor && typeof valor === "object" ? valor : {}) as Record<string, unknown>;
  const base = PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO;
  const booleano = (clave: keyof PreferenciasNotificaciones) =>
    typeof v[clave] === "boolean" ? (v[clave] as boolean) : (base[clave] as boolean);
  const dias = Number(v.diasAntes);
  const hora = Number(v.hora);
  return {
    pagos: booleano("pagos"),
    bandeja: booleano("bandeja"),
    recordatorios: booleano("recordatorios"),
    diasAntes: (OPCIONES_DIAS_ANTES as number[]).includes(dias) ? (dias as DiasAntesRecordatorio) : base.diasAntes,
    hora: Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : base.hora,
    presupuestos: booleano("presupuestos"),
  };
}

export async function leerPreferenciasNotificaciones(
  almacen: AlmacenPreferencias,
  usuarioId: string
): Promise<PreferenciasNotificaciones> {
  try {
    const texto = await almacen.getItem(clavePreferenciasNotificaciones(usuarioId));
    return normalizarPreferenciasNotificaciones(texto ? JSON.parse(texto) : null);
  } catch {
    return { ...PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO };
  }
}

export async function guardarPreferenciasNotificaciones(
  almacen: AlmacenPreferencias,
  usuarioId: string,
  preferencias: PreferenciasNotificaciones
): Promise<PreferenciasNotificaciones> {
  const limpias = normalizarPreferenciasNotificaciones(preferencias);
  await almacen.setItem(clavePreferenciasNotificaciones(usuarioId), JSON.stringify(limpias));
  return limpias;
}

/** Una notificación para programar en el teléfono. */
export interface NotificacionProgramada {
  /** Estable: reprogramar la misma no la duplica. */
  id: string;
  /** Día y hora LOCALES del teléfono. */
  fecha: string;
  hora: number;
  titulo: string;
  cuerpo: string;
  /** Pantalla que abre al tocarla. */
  ruta: string;
}

/** Android limita las alarmas por app; con unas pocas semanas por delante alcanza. */
export const MAXIMO_RECORDATORIOS_PROGRAMADOS = 30;

function sumarDias(fechaIso: string, dias: number): string {
  const [a, m, d] = fechaIso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

function minutosDelDia(ahora: Date): number {
  return ahora.getHours() * 60 + ahora.getMinutes();
}

/**
 * Qué recordatorios avisar: los pendientes (de un diferido, solo la cuota
 * que toca), `diasAntes` días antes del vencimiento a la `hora` elegida. Si
 * ese momento ya pasó, el mismo día del vencimiento; si también pasó, o el
 * recordatorio ya venció, no se avisa. Ordenados por fecha, como máximo
 * `maximo`.
 */
export function recordatoriosAProgramar(
  recordatorios: Recordatorio[],
  ahora: Date,
  preferencias: Pick<PreferenciasNotificaciones, "diasAntes" | "hora">,
  maximo: number = MAXIMO_RECORDATORIOS_PROGRAMADOS
): NotificacionProgramada[] {
  const hoy = fechaLocal(ahora);
  const yaPasoLaHora = minutosDelDia(ahora) >= preferencias.hora * 60;
  const enElFuturo = (fecha: string) => fecha > hoy || (fecha === hoy && !yaPasoLaHora);

  const programadas: NotificacionProgramada[] = [];
  for (const r of organizarRecordatorios(recordatorios, hoy).proximos) {
    if (r.completado || r.fecha < hoy) continue;
    const anticipado = sumarDias(r.fecha, -preferencias.diasAntes);
    const dia = enElFuturo(anticipado) ? anticipado : enElFuturo(r.fecha) ? r.fecha : undefined;
    if (!dia) continue;
    const monto = r.monto !== undefined ? ` · ${formatMonto(r.monto)}` : "";
    programadas.push({
      id: `recordatorio:${r.id}`,
      fecha: dia,
      hora: preferencias.hora,
      titulo: r.titulo,
      cuerpo: `Vence ${textoVencimiento(r.fecha, dia)}${monto}.`,
      ruta: "/recordatorios",
    });
  }
  return programadas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)).slice(0, maximo);
}

/**
 * Si hay movimientos esperando en la bandeja, un aviso a la `hora` de hoy (o
 * de mañana, si ya pasó). Se reprograma cada vez que se abre la app, así
 * desaparece cuando la bandeja queda vacía.
 */
export function avisoBandeja(pendientes: number, ahora: Date, hora = 19): NotificacionProgramada | null {
  if (!Number.isFinite(pendientes) || pendientes <= 0) return null;
  const hoy = fechaLocal(ahora);
  const fecha = minutosDelDia(ahora) < hora * 60 ? hoy : sumarDias(hoy, 1);
  return {
    id: "bandeja",
    fecha,
    hora,
    titulo: pendientes === 1 ? "Tienes 1 movimiento por confirmar" : `Tienes ${pendientes} movimientos por confirmar`,
    cuerpo: "Revísalos en la bandeja para que tus saldos queden al día.",
    ruta: "/bandeja",
  };
}

/** El texto de un presupuesto que cruzó un nivel. */
export function textoAvisoPresupuesto(a: AvisoPresupuesto): { titulo: string; cuerpo: string } {
  const gastado = formatMonto(a.gastado);
  const limite = formatMonto(a.limite);
  if (a.nivel === 101) {
    return {
      titulo: `Te pasaste del presupuesto de ${a.categoria}`,
      cuerpo: `Llevas ${gastado}: ${formatMonto(sumarMontos([a.gastado, -a.limite]))} más que el límite de ${limite}.`,
    };
  }
  if (a.nivel === 100) {
    return {
      titulo: `Llegaste al límite de ${a.categoria}`,
      cuerpo: `Gastaste ${gastado} de ${limite} este mes.`,
    };
  }
  return {
    titulo: `Presupuesto de ${a.categoria}: ${Math.floor(a.porcentaje)} %`,
    cuerpo: `Llevas ${gastado} de ${limite} este mes. Te quedan ${formatMonto(sumarMontos([a.limite, -a.gastado]))}.`,
  };
}
