// Notificaciones del teléfono. Son locales: las programa el propio teléfono,
// sin un servidor que conozca tus montos. Las reglas —qué avisar, cuándo y
// con qué texto— están en core (`notificaciones`); aquí se conectan con
// expo-notifications, el almacén de la app y el módulo de Google Wallet (que
// avisa los pagos en el momento, aunque la app esté cerrada).
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  avisoBandeja,
  contarTransaccionesPendientes,
  guardarPreferenciasNotificaciones,
  leerPreferenciasNotificaciones,
  listarRecordatorios,
  mesLocal,
  recordatoriosAProgramar,
  revisarMisPresupuestos,
  textoAvisoPresupuesto,
  PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO,
  type NotificacionProgramada,
  type PreferenciasNotificaciones,
} from "core";
import { supabase } from "./supabase";
import { capturaGoogleWallet } from "../modules/captura-billetera";

/** Los mismos ids que usa el módulo de Android (Notificaciones.kt): un solo juego de canales. */
export const CANALES = {
  pagos: "fintrack_pagos",
  bandeja: "fintrack_bandeja",
  presupuestos: "fintrack_presupuestos",
  recordatorios: "fintrack_recordatorios",
} as const;

/** En la web no hay notificaciones locales programables. */
export const NOTIFICACIONES_DISPONIBLES = Platform.OS !== "web";

type TipoProgramada = "recordatorio" | "bandeja";

let preparado: Promise<void> | null = null;

/** Cómo se muestran con la app abierta y los canales de Android. Una vez por arranque. */
export function prepararNotificaciones(): Promise<void> {
  if (!NOTIFICACIONES_DISPONIBLES) return Promise.resolve();
  preparado ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS !== "android") return;
    const canal = (name: string, description: string) => ({
      name,
      description,
      importance: Notifications.AndroidImportance.DEFAULT,
      // Con la pantalla bloqueada, Android oculta el texto (y los montos) si la persona lo pidió así.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Promise.all([
      Notifications.setNotificationChannelAsync(CANALES.pagos, canal("Pagos registrados", "Pagos con billetera que se registraron solos.")),
      Notifications.setNotificationChannelAsync(CANALES.bandeja, canal("Pagos por confirmar", "Pagos detectados que esperan en la bandeja.")),
      Notifications.setNotificationChannelAsync(CANALES.presupuestos, canal("Presupuestos", "Cuando llegas al 75 %, al 100 % o te pasas de un presupuesto.")),
      Notifications.setNotificationChannelAsync(CANALES.recordatorios, canal("Recordatorios", "Pagos y cuotas antes de que venzan.")),
    ]);
  })().catch(() => {
    preparado = null;
  });
  return preparado;
}

export type EstadoPermiso = "concedido" | "denegado" | "sin_preguntar" | "no_disponible";

function estadoDe(p: Notifications.NotificationPermissionsStatus): EstadoPermiso {
  if (p.granted) return "concedido";
  return p.canAskAgain ? "sin_preguntar" : "denegado";
}

export async function estadoPermisoNotificaciones(): Promise<EstadoPermiso> {
  if (!NOTIFICACIONES_DISPONIBLES) return "no_disponible";
  try {
    return estadoDe(await Notifications.getPermissionsAsync());
  } catch {
    return "no_disponible";
  }
}

/** Muestra el diálogo del sistema (Android 13+ e iPhone). En Android 12 o menos ya está concedido. */
export async function pedirPermisoNotificaciones(): Promise<EstadoPermiso> {
  if (!NOTIFICACIONES_DISPONIBLES) return "no_disponible";
  try {
    await prepararNotificaciones();
    return estadoDe(await Notifications.requestPermissionsAsync());
  } catch {
    return "no_disponible";
  }
}

async function usuarioActual(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export async function preferenciasNotificaciones(): Promise<PreferenciasNotificaciones> {
  const id = await usuarioActual();
  return id ? leerPreferenciasNotificaciones(AsyncStorage, id) : { ...PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO };
}

/** El módulo de Android avisa con la app cerrada: necesita saber qué avisos quiere la persona. */
function avisarAlModulo(p: PreferenciasNotificaciones): void {
  try {
    capturaGoogleWallet?.ajustarAvisos({ pagos: p.pagos, bandeja: p.bandeja, presupuestos: p.presupuestos });
  } catch {
    // APK anterior a 1.4.0: no muestra notificaciones de pagos.
  }
}

/** Guarda las preferencias (por persona) y reprograma todo con ellas. */
export async function cambiarPreferenciasNotificaciones(p: PreferenciasNotificaciones): Promise<PreferenciasNotificaciones> {
  const id = await usuarioActual();
  if (!id) return p;
  const guardadas = await guardarPreferenciasNotificaciones(AsyncStorage, id, p);
  avisarAlModulo(guardadas);
  await sincronizarNotificaciones();
  return guardadas;
}

/** Día y hora locales de una notificación programada. */
function momentoDe(n: NotificacionProgramada): Date {
  const [a, m, d] = n.fecha.split("-").map(Number);
  return new Date(a, m - 1, d, n.hora, 0, 0, 0);
}

/** Cancela las de ese tipo y programa las nuevas (con el mismo id, no se duplican). */
async function reprogramar(tipo: TipoProgramada, lista: NotificacionProgramada[], canal: string): Promise<void> {
  const programadas = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    programadas
      .filter((p) => (p.content.data as { tipo?: unknown } | undefined)?.tipo === tipo)
      .map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier))
  );
  for (const n of lista) {
    const cuando = momentoDe(n);
    if (cuando.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.titulo, body: n.cuerpo, data: { tipo, ruta: n.ruta } },
      trigger: { date: cuando, channelId: canal },
    });
  }
}

let sincronizando: Promise<void> | null = null;

/**
 * Reprograma los recordatorios y el aviso de la bandeja, y avisa los
 * presupuestos que cruzaron un nivel. Se llama al abrir la app, al volver a
 * ella y al cambiar las preferencias o los recordatorios. Nunca lanza: una
 * notificación que no se pudo programar no debe romper nada.
 */
export function sincronizarNotificaciones(): Promise<void> {
  if (!NOTIFICACIONES_DISPONIBLES) return Promise.resolve();
  sincronizando ??= (async () => {
    try {
      const id = await usuarioActual();
      if (!id) return;
      await prepararNotificaciones();
      const p = await leerPreferenciasNotificaciones(AsyncStorage, id);
      avisarAlModulo(p);
      if ((await estadoPermisoNotificaciones()) !== "concedido") return;
      const ahora = new Date();
      await reprogramar(
        "recordatorio",
        p.recordatorios ? recordatoriosAProgramar(await listarRecordatorios(), ahora, p) : [],
        CANALES.recordatorios
      );
      const bandeja = p.bandeja ? avisoBandeja(await contarTransaccionesPendientes(), ahora) : null;
      await reprogramar("bandeja", bandeja ? [bandeja] : [], CANALES.bandeja);
      if (p.presupuestos) await avisarPresupuestosAhora(mesLocal(ahora));
    } catch {
      // Sin red o sin la migración: se intenta de nuevo la próxima vez.
    }
  })().finally(() => {
    sincronizando = null;
  });
  return sincronizando;
}

async function avisarPresupuestosAhora(mes: string): Promise<void> {
  // La base anota cada nivel avisado: solo devuelve lo nuevo, una vez.
  for (const aviso of await revisarMisPresupuestos(mes)) {
    const { titulo, cuerpo } = textoAvisoPresupuesto(aviso);
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: cuerpo, data: { tipo: "presupuesto", ruta: "/presupuestos" } },
      trigger: { channelId: CANALES.presupuestos },
    });
  }
}

/**
 * Después de guardar o editar un gasto: si con él un presupuesto cruzó el
 * 75 %, el 100 % o el límite, avisa en el momento. `fecha` es la del gasto
 * (puede ser de otro mes). Nunca lanza.
 */
export async function avisarPresupuestos(fecha?: string): Promise<void> {
  if (!NOTIFICACIONES_DISPONIBLES) return;
  try {
    const id = await usuarioActual();
    if (!id) return;
    const p = await leerPreferenciasNotificaciones(AsyncStorage, id);
    if (!p.presupuestos || (await estadoPermisoNotificaciones()) !== "concedido") return;
    await prepararNotificaciones();
    await avisarPresupuestosAhora(fecha && /^\d{4}-\d{2}/.test(fecha) ? fecha.slice(0, 7) : mesLocal());
  } catch {
    // No es parte de guardar el gasto.
  }
}

/** Al cerrar sesión: nada de lo programado para esta persona debe sonar para la siguiente. */
export async function cancelarNotificaciones(): Promise<void> {
  if (!NOTIFICACIONES_DISPONIBLES) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Nada que cancelar.
  }
}

/** La pantalla que abre una notificación tocada (solo rutas de la app). */
export function rutaDeNotificacion(r: Notifications.NotificationResponse | null | undefined): string | undefined {
  const ruta = (r?.notification.request.content.data as { ruta?: unknown } | undefined)?.ruta;
  return typeof ruta === "string" && /^\/[a-z/-]*$/.test(ruta) ? ruta : undefined;
}
