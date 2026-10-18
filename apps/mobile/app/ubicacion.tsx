import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { borrarMisUbicaciones, mensajeError } from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import { BlurFade } from "../components/Motion";
import { cambiarGuardarUbicacion, guardarUbicacionActiva } from "../lib/ubicacion";
import { confirmar } from "../lib/dialogo";
import { spacing, useTheme, font, type Colors } from "../lib/theme";

const URL_PRIVACIDAD = process.env.EXPO_PUBLIC_URL_PRIVACIDAD;

/**
 * Consentimiento de ubicación (LOPDP): apagada por defecto, el permiso del
 * sistema se pide solo al encenderla aquí, y se puede borrar todo sin borrar
 * los gastos.
 */
export default function UbicacionScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [activa, setActiva] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      guardarUbicacionActiva()
        .then(setActiva)
        .catch(() => setActiva(false))
        .finally(() => setCargando(false));
    }, []),
  );

  async function cambiar(valor: boolean) {
    setError(null);
    setMensaje(null);
    setCambiando(true);
    try {
      const r = await cambiarGuardarUbicacion(valor);
      setActiva(r.activa);
      if (r.motivo === "sin_permiso") {
        setError("Sin permiso de ubicación. Puedes darlo en los ajustes del teléfono.");
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCambiando(false);
    }
  }

  async function borrar() {
    setError(null);
    setMensaje(null);
    const ok = await confirmar(
      "Borrar todas mis ubicaciones",
      "Se quitará la ubicación de todos tus gastos y se borrarán tus lugares. Tus gastos no se borran.",
      "Borrar",
    );
    if (!ok) return;
    setBorrando(true);
    try {
      const r = await borrarMisUbicaciones();
      setMensaje(
        r.gastos === 0 && r.lugares === 0
          ? "No había ubicaciones guardadas."
          : `Listo: ${r.gastos} ${r.gastos === 1 ? "gasto quedó" : "gastos quedaron"} sin ubicación y se borraron ${r.lugares} ${r.lugares === 1 ? "lugar" : "lugares"}.`,
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBorrando(false);
    }
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Ubicación de mis pagos</Text>
        <Text style={styles.screenIntro}>
          Guardaremos dónde haces cada pago para mostrarte cuánto gastas en cada lugar. Solo al registrar un pago, con
          la app abierta, nunca en segundo plano. Puedes borrarla cuando quieras.
        </Text>
      </BlurFade>

      <Tarjeta>
        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filaTitulo}>Guardar la ubicación de mis pagos</Text>
            <Text style={styles.filaSubtitulo}>
              {activa ? "Activada en este teléfono, para tu cuenta." : "Apagada."}
            </Text>
          </View>
          {cargando || cambiando ? (
            <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
          ) : (
            <Switch
              accessibilityLabel="Guardar la ubicación de mis pagos"
              value={activa}
              onValueChange={cambiar}
              trackColor={{ true: color.primary, false: color.border }}
            />
          )}
        </View>
        <Text style={styles.nota}>
          Se guarda redondeada a unos 11 metros. Al encenderla, el teléfono te pedirá permiso de ubicación "mientras
          usas la app".
        </Text>
        <Text style={styles.nota}>
          Si anotas un gasto de otro día, no se guarda dónde estás (no lo pagaste ahí); puedes cambiarlo en el
          formulario. Los pagos con Google Wallet llegan sin ubicación: si ya tienes un lugar con el nombre del
          comercio, se asignan a ese lugar.
        </Text>
      </Tarjeta>

      <Tarjeta>
        <Text style={styles.filaTitulo}>Borrar todas mis ubicaciones</Text>
        <Text style={styles.filaSubtitulo}>
          Quita la ubicación de todos tus gastos y borra tus lugares. Tus gastos y saldos no cambian.
        </Text>
        <Boton titulo={borrando ? "Borrando…" : "Borrar todas mis ubicaciones"} variante="peligro" onPress={borrar} loading={borrando} disabled={borrando} />
      </Tarjeta>

      {mensaje && <Text accessibilityLiveRegion="polite" style={styles.exito}>{mensaje}</Text>}
      {error && <ErrorTexto>{error}</ErrorTexto>}

      {URL_PRIVACIDAD && (
        <Boton titulo="Política de privacidad" onPress={() => WebBrowser.openBrowserAsync(URL_PRIVACIDAD)} />
      )}
    </ScrollView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    fila: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
    filaTitulo: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    filaSubtitulo: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
    nota: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: color.textMuted },
    exito: { fontFamily: font.body, fontSize: 13, color: color.text, backgroundColor: color.primaryBg, padding: 10, borderRadius: 8 },
  });
