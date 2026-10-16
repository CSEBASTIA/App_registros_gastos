import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  mensajeError,
  mesLocal,
  rangoDelMes,
  resumenPorComercio,
  resumenPorLugar,
  type ResumenComercio,
  type ResumenLugar,
} from "core";
import Tarjeta from "../components/Tarjeta";
import SelectorMes from "../components/SelectorMes";
import ErrorTexto from "../components/ErrorTexto";
import EstadoVacio from "../components/EstadoVacio";
import BarraProgreso from "../components/BarraProgreso";
import { BlurFade } from "../components/Motion";
import { radius, spacing, useTheme, font, type Colors } from "../lib/theme";

/** Resumen por lugar: cuánto pagaste en cada sitio durante el mes elegido. */
export default function LugaresScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [mes, setMes] = useState(mesLocal());
  const [porComercio, setPorComercio] = useState(false);
  const [lugares, setLugares] = useState<ResumenLugar[]>([]);
  const [comercios, setComercios] = useState<ResumenComercio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    const { desde, hasta } = rangoDelMes(mes);
    setCargando(true);
    setError(null);
    Promise.all([resumenPorLugar(desde, hasta), resumenPorComercio(desde, hasta)])
      .then(([l, c]) => {
        setLugares(l);
        setComercios(c);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, [mes]);

  useFocusEffect(cargar);

  const totalMes = lugares.reduce((a, l) => a + l.total, 0);

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Lugares</Text>
        <Text style={styles.screenIntro}>Dónde pagas y cuánto, según la ubicación de tus pagos.</Text>
      </BlurFade>

      <View style={styles.encabezado}>
        <SelectorMes mes={mes} onCambiar={setMes} />
        <View style={styles.interruptor}>
          <Text style={styles.etiqueta}>Por comercio</Text>
          <Switch
            accessibilityLabel="Agrupar por comercio"
            value={porComercio}
            onValueChange={setPorComercio}
            trackColor={{ true: color.primary, false: color.border }}
          />
        </View>
      </View>

      {error && <ErrorTexto>{error}</ErrorTexto>}

      {cargando ? (
        <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
      ) : error ? null : lugares.length === 0 ? (
        <EstadoVacio
          icono="location-outline"
          titulo="Todavía no hay pagos con ubicación este mes"
          subtitulo="Actívala en Más → Ubicación de mis pagos, o confirma pagos de Apple Pay con ubicación."
        />
      ) : (
        <>
          <Tarjeta style={{ gap: spacing(1) }}>
            <Text style={styles.etiqueta}>Total en lugares este mes</Text>
            <Text style={styles.valorGrande}>${totalMes.toFixed(2)}</Text>
          </Tarjeta>
          {porComercio
            ? comercios.map((c) => (
                <Pressable
                  key={c.lugarIds.join(",")}
                  accessibilityRole="button"
                  onPress={() => c.lugarIds.length === 1 && router.push({ pathname: "/lugar/[id]", params: { id: c.lugarIds[0], mes } })}
                  style={({ pressed }) => [styles.fila, pressed && c.lugarIds.length === 1 && { backgroundColor: color.primaryBg }]}
                >
                  <View style={{ flex: 1, gap: spacing(1) }}>
                    <Text style={styles.nombre} numberOfLines={1}>{c.comercio}</Text>
                    <Text style={styles.meta}>
                      {c.pagos} {c.pagos === 1 ? "pago" : "pagos"} · {c.locales} {c.locales === 1 ? "local" : "locales"} · último {c.ultimoPago}
                    </Text>
                    <BarraProgreso porcentaje={totalMes > 0 ? (c.total / totalMes) * 100 : 0} colorOverride={color.primary} />
                  </View>
                  <Text style={styles.monto}>${c.total.toFixed(2)}</Text>
                </Pressable>
              ))
            : lugares.map((l) => (
                <Pressable
                  key={l.lugarId}
                  accessibilityRole="button"
                  accessibilityHint="Abre el detalle del lugar"
                  onPress={() => router.push({ pathname: "/lugar/[id]", params: { id: l.lugarId, mes } })}
                  style={({ pressed }) => [styles.fila, pressed && { backgroundColor: color.primaryBg }]}
                >
                  <View style={{ flex: 1, gap: spacing(1) }}>
                    <Text style={styles.nombre} numberOfLines={1}>{l.nombre}</Text>
                    <Text style={styles.meta}>
                      {l.pagos} {l.pagos === 1 ? "pago" : "pagos"} · promedio ${l.promedio.toFixed(2)} · {l.porcentaje.toFixed(0)}%
                    </Text>
                    <BarraProgreso porcentaje={l.porcentaje} colorOverride={color.primary} />
                  </View>
                  <Text style={styles.monto}>${l.total.toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
                </Pressable>
              ))}
          {porComercio && (
            <Text style={styles.meta}>Para juntar sucursales de una misma cadena, ponles el mismo nombre en su detalle.</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    encabezado: { flexDirection: "row", flexWrap: "wrap", gap: spacing(3), justifyContent: "space-between", alignItems: "center" },
    interruptor: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
    etiqueta: { fontFamily: font.semibold, fontSize: 12, color: color.textMuted },
    valorGrande: { fontFamily: font.mono, fontSize: 22, color: color.text },
    fila: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      padding: spacing(3.5),
    },
    nombre: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    meta: { fontFamily: font.body, fontSize: 12, color: color.textMuted },
    monto: { fontFamily: font.mono, fontSize: 15, color: color.text },
  });
