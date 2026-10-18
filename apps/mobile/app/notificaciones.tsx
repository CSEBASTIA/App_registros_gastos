import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  OPCIONES_DIAS_ANTES,
  PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO,
  mensajeError,
  type DiasAntesRecordatorio,
  type PreferenciasNotificaciones,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import { BlurFade } from "../components/Motion";
import {
  NOTIFICACIONES_DISPONIBLES,
  cambiarPreferenciasNotificaciones,
  estadoPermisoNotificaciones,
  pedirPermisoNotificaciones,
  preferenciasNotificaciones,
  type EstadoPermiso,
} from "../lib/notificaciones";
import { spacing, useTheme, font, type Colors } from "../lib/theme";

const HORAS = [7, 9, 12, 18, 20];
const TEXTO_DIAS: Record<DiasAntesRecordatorio, string> = { 0: "El mismo día", 1: "1 día antes", 3: "3 días antes" };

type Interruptor = { clave: "pagos" | "bandeja" | "recordatorios" | "presupuestos"; titulo: string; texto: string };

const INTERRUPTORES: Interruptor[] = [
  {
    clave: "pagos",
    titulo: "Pagos registrados solos",
    texto: "«Registré $12.50 en SUPERMAXI con tu tarjeta •••• 1234». Tócala para revisarlo o corregirlo.",
  },
  {
    clave: "bandeja",
    titulo: "Pagos por confirmar",
    texto: "Cuando un pago llega a la bandeja, y un recordatorio a las 19:00 si quedan movimientos sin confirmar.",
  },
  {
    clave: "recordatorios",
    titulo: "Recordatorios y cuotas",
    texto: "Antes de que venza un recordatorio o la cuota de un diferido.",
  },
  {
    clave: "presupuestos",
    titulo: "Presupuestos",
    texto: "Al llegar al 75 %, al 100 % y al pasarte de un presupuesto. Una vez por nivel y por mes.",
  },
];

export default function NotificacionesScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [permiso, setPermiso] = useState<EstadoPermiso | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasNotificaciones>(PREFERENCIAS_NOTIFICACIONES_POR_DEFECTO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescarPermiso = useCallback(() => {
    estadoPermisoNotificaciones().then(setPermiso);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      refrescarPermiso();
      preferenciasNotificaciones()
        .then(setPrefs)
        .catch((err) => setError(mensajeError(err)))
        .finally(() => setCargando(false));
    }, [refrescarPermiso]),
  );

  // Al volver de los ajustes del teléfono, el permiso puede haber cambiado.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && refrescarPermiso());
    return () => sub.remove();
  }, [refrescarPermiso]);

  async function guardar(cambios: Partial<PreferenciasNotificaciones>) {
    setError(null);
    const anteriores = prefs;
    setPrefs({ ...prefs, ...cambios });
    setGuardando(true);
    try {
      setPrefs(await cambiarPreferenciasNotificaciones({ ...anteriores, ...cambios }));
    } catch (err) {
      setPrefs(anteriores);
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function permitir() {
    setError(null);
    const estado = await pedirPermisoNotificaciones();
    setPermiso(estado);
    // Con el permiso recién dado, se programa todo lo que corresponde.
    if (estado === "concedido") await cambiarPreferenciasNotificaciones(prefs).catch(() => undefined);
  }

  if (!NOTIFICACIONES_DISPONIBLES) {
    return (
      <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(5), gap: spacing(4) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Notificaciones</Text>
        <Tarjeta>
          <Text style={styles.titulo}>Solo en el teléfono</Text>
          <Text style={styles.texto}>Las notificaciones las programa la app del teléfono. Ábrela en tu Android o iPhone.</Text>
        </Tarjeta>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Notificaciones</Text>
        <Text style={styles.screenIntro}>
          Elige qué te avisa la app. Las arma tu teléfono: no pasan por ningún servidor de avisos.
        </Text>
      </BlurFade>

      {permiso !== null && permiso !== "concedido" && (
        <Tarjeta style={{ gap: spacing(2) }}>
          <Text style={styles.titulo}>
            {permiso === "denegado" ? "Las notificaciones están bloqueadas" : "Permite las notificaciones"}
          </Text>
          <Text style={styles.texto}>
            {permiso === "denegado"
              ? "Las bloqueaste para esta app. Actívalas en los ajustes del teléfono (Notificaciones de FinTrack)."
              : "Sin este permiso, el teléfono no puede mostrarte ningún aviso."}
          </Text>
          {permiso === "denegado" ? (
            <Boton titulo="Abrir ajustes del teléfono" variante="primario" onPress={() => Linking.openSettings()} />
          ) : (
            <Boton titulo="Permitir notificaciones" variante="primario" onPress={permitir} />
          )}
        </Tarjeta>
      )}

      {cargando ? (
        <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
      ) : (
        <>
          {INTERRUPTORES.map((i) => (
            <Tarjeta key={i.clave} style={{ gap: spacing(2) }}>
              <View style={styles.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo}>{i.titulo}</Text>
                  <Text style={styles.texto}>{i.texto}</Text>
                </View>
                <Switch
                  accessibilityLabel={i.titulo}
                  value={prefs[i.clave]}
                  onValueChange={(v) => guardar({ [i.clave]: v })}
                  disabled={guardando}
                  trackColor={{ true: color.primary, false: color.border }}
                />
              </View>
              {i.clave === "recordatorios" && prefs.recordatorios && (
                <>
                  <SelectorChips
                    titulo="Cuándo"
                    valor={String(prefs.diasAntes)}
                    onCambiar={(v) => guardar({ diasAntes: Number(v) as DiasAntesRecordatorio })}
                    opciones={OPCIONES_DIAS_ANTES.map((d) => ({ valor: String(d), etiqueta: TEXTO_DIAS[d] }))}
                  />
                  <SelectorChips
                    titulo="A qué hora"
                    valor={String(prefs.hora)}
                    onCambiar={(v) => guardar({ hora: Number(v) })}
                    opciones={HORAS.map((h) => ({ valor: String(h), etiqueta: `${String(h).padStart(2, "0")}:00` }))}
                  />
                </>
              )}
              {(i.clave === "pagos" || i.clave === "bandeja") && Platform.OS === "android" && (
                <Text style={styles.nota}>
                  Para los pagos con Google Wallet (Más → Conectar Google Wallet), con la app 1.4.0 o más nueva.
                </Text>
              )}
            </Tarjeta>
          ))}
          <Text style={styles.nota}>
            Algunas notificaciones muestran montos. Con la pantalla bloqueada, el teléfono los oculta si así lo elegiste en
            sus ajustes («Ocultar contenido sensible»). Al cerrar sesión se cancelan las programadas.
          </Text>
        </>
      )}
      {error && <ErrorTexto>{error}</ErrorTexto>}
    </ScrollView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    fila: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
    titulo: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    texto: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
    nota: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: color.textMuted },
  });
