import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  eliminarTransferencia,
  etiquetaFecha,
  formatMonto,
  listarCuentas,
  listarTransferencias,
  mensajeError,
  separarTransferencia,
  type Cuenta,
  type Transferencia,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import EstadoVacio from "../components/EstadoVacio";
import { BlurFade } from "../components/Motion";
import { confirmar } from "../lib/dialogo";
import { spacing, useTheme, font, type Colors } from "../lib/theme";

/**
 * Transferencias entre cuentas propias: las que hiciste a mano y las que la
 * app juntó sola a partir de tu correo («enviada» en una cuenta y «recibida»
 * en otra). Una juntada por error se separa: sus avisos vuelven a la bandeja.
 */
export default function TransferenciasScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([listarTransferencias(), listarCuentas()])
      .then(([t, c]) => {
        setTransferencias(t);
        setCuentas(c);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  const nombre = (id?: string) => (id ? cuentas.find((c) => c.id === id)?.nombre ?? "Cuenta" : "Cuenta borrada");

  async function eliminar(t: Transferencia) {
    const ok = await confirmar(
      "Eliminar transferencia",
      `Se devolverán ${formatMonto(t.monto)} a ${nombre(t.cuentaOrigenId)} y se quitarán de ${nombre(t.cuentaDestinoId)}.`,
      "Eliminar",
    );
    if (!ok) return;
    setTrabajando(t.id);
    setMensaje(null);
    try {
      await eliminarTransferencia(t.id);
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(null);
    }
  }

  async function separar(t: Transferencia) {
    const ok = await confirmar(
      "No era entre mis cuentas",
      "Se quitará la transferencia y sus avisos volverán a la bandeja, para confirmarlos como gasto e ingreso.",
      "Separar",
    );
    if (!ok) return;
    setTrabajando(t.id);
    setMensaje(null);
    try {
      const n = await separarTransferencia(t.id);
      setMensaje(n === 1 ? "Listo: el aviso volvió a la bandeja." : `Listo: ${n} avisos volvieron a la bandeja.`);
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Transferencias</Text>
        <Text style={styles.screenIntro}>
          Dinero que pasa de una cuenta tuya a otra. No cuenta como gasto ni ingreso. Las que llegan por correo («enviada»
          y «recibida») se juntan solas.
        </Text>
      </BlurFade>

      <Boton titulo="+ Nueva transferencia" variante="primario" onPress={() => router.push("/transferencia/nueva")} />
      {mensaje && <Text accessibilityLiveRegion="polite" style={styles.exito}>{mensaje}</Text>}
      {error && <ErrorTexto>{error}</ErrorTexto>}

      {cargando ? (
        <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
      ) : transferencias.length === 0 ? (
        <EstadoVacio
          icono="swap-horizontal-outline"
          titulo="Todavía no hay transferencias"
          subtitulo="Registra una arriba, o conecta tu correo y se agregarán solas."
        />
      ) : (
        transferencias.map((t) => (
          <Tarjeta key={t.id} style={{ gap: spacing(2) }}>
            <View style={styles.fila}>
              <View style={styles.icono}>
                <Ionicons name="swap-horizontal" size={18} color={color.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.titulo} numberOfLines={1}>
                  {nombre(t.cuentaOrigenId)} → {nombre(t.cuentaDestinoId)}
                </Text>
                <Text style={styles.subtitulo} numberOfLines={2}>
                  {etiquetaFecha(t.fecha)}
                  {t.descripcion ? ` · ${t.descripcion}` : ""}
                  {t.origen === "correo" ? " · Detectada en tu correo" : ""}
                </Text>
              </View>
              <Text style={styles.monto}>{formatMonto(t.monto)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing(2) }}>
              {t.origen === "correo" && (
                <Boton
                  titulo="No era entre mis cuentas"
                  onPress={() => separar(t)}
                  disabled={trabajando !== null}
                  loading={trabajando === t.id}
                  style={{ flex: 1 }}
                />
              )}
              <Boton
                titulo="Eliminar"
                variante="peligro"
                onPress={() => eliminar(t)}
                disabled={trabajando !== null}
                loading={trabajando === t.id}
                style={{ flex: 1 }}
              />
            </View>
          </Tarjeta>
        ))
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
    icono: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.primaryBg,
    },
    titulo: { fontFamily: font.semibold, fontSize: 14, color: color.text },
    subtitulo: { fontFamily: font.body, fontSize: 12, color: color.textMuted },
    monto: { fontFamily: font.mono, fontSize: 14, fontWeight: "700", color: color.text },
    exito: { fontFamily: font.body, fontSize: 13, color: color.text, backgroundColor: color.primaryBg, padding: 10, borderRadius: 8 },
  });
