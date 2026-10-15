import { SafeAreaView } from "react-native-safe-area-context";
import SelectorChips from "../../components/SelectorChips";
import { mensajeError, mesLocal } from "core";
import ErrorTexto from "../../components/ErrorTexto";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarGastos,
  listarCategorias,
  listarCuentas,
  eliminarGasto,
  semanasDelMes,
  enRangoSemana,
  agruparPorCategoriaODetalle,
  type Gasto,
  type Categoria,
  type Cuenta,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import Boton from "../../components/Boton";
import GraficoBarras from "../../components/GraficoBarras";
import EstadoVacio from "../../components/EstadoVacio";
import SelectorMes from "../../components/SelectorMes";
import { radius, spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

function mesActual() {
  return mesLocal(); // zona horaria del teléfono, no UTC
}

export default function GastosScreen() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [mes, setMes] = useState(mesActual());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [semanaActiva, setSemanaActiva] = useState(1);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([listarGastos(), listarCategorias(), listarCuentas()])
      .then(([g, c, cu]) => {
        setGastos(g);
        setCategorias(c);
        setCuentas(cu);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  const categoriasGasto = categorias.filter((c) => c.tipo === "gasto");
  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const semanas = semanasDelMes(mes);
  const rango = semanas[semanaActiva - 1];
  const gastosSemana = gastosDelMes.filter((g) =>
    enRangoSemana(g.fecha, rango),
  );
  const totalMes = gastosDelMes.reduce((a, g) => a + g.monto, 0);
  const totalSemana = gastosSemana.reduce((a, g) => a + g.monto, 0);

  const desglose = agruparPorCategoriaODetalle(gastosSemana, categoriasGasto)
    .filter((d) => d.monto > 0)
    .sort((a, b) => b.monto - a.monto);
  const datosGrafico = desglose.map((d) => ({
    etiqueta: d.etiqueta,
    valor: d.monto,
    color: d.color,
  }));

  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }
  function categoriaDe(id: string) {
    return categorias.find((c) => c.id === id);
  }

  function confirmarEliminar(gasto: Gasto) {
    Alert.alert("Eliminar gasto", `¿Eliminar "${gasto.descripcion}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => eliminarGasto(gasto.id).then(cargar),
      },
    ]);
  }

  if (cargando)
    return (
      <View
        style={[
          styles.contenedor,
          {
            alignItems: "center",
            justifyContent: "center",
            padding: spacing(6),
            gap: spacing(3),
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator
          color={color.primary}
          accessibilityLabel="Cargando"
        />
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 14,
            color: color.textMuted,
          }}
        >
          Cargando tus datos…
        </Text>
      </View>
    );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: color.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.contenedor}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: spacing(5),
            paddingBottom: spacing(8),
            gap: spacing(4),
          }}
        >
          <BlurFade style={{ gap: spacing(2) }}>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Gastos
            </Text>
            <Text style={styles.screenIntro}>
              Entendé en qué se va tu dinero.
            </Text>
          </BlurFade>
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <View style={styles.encabezado}>
            <SelectorMes mes={mes} onCambiar={setMes} />
            <Boton
              titulo="+ Nuevo"
              variante="primario"
              onPress={() =>
                router.push({ pathname: "/gasto/nuevo", params: { mes } })
              }
            />
          </View>

          <SelectorChips
            titulo="Semana"
            valor={String(semanaActiva)}
            onCambiar={(v) => setSemanaActiva(Number(v))}
            opciones={semanas.map((semana) => ({
              valor: String(semana.numero),
              etiqueta:
                "Semana " +
                semana.numero +
                " (" +
                semana.desde +
                "–" +
                semana.hasta +
                ")",
            }))}
          />

          <Tarjeta>
            <Text style={styles.tituloCard}>
              Gastos por categoría — Semana {semanaActiva}
            </Text>
            <GraficoBarras
              datos={datosGrafico}
              mensajeVacio="Sin gastos en este período."
            />
          </Tarjeta>

          <Tarjeta>
            <View style={styles.filaTotal}>
              <Text style={styles.etiqueta}>Total Semana {semanaActiva}</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={styles.valorGrande}
              >
                ${totalSemana.toFixed(2)}
              </Text>
            </View>
            {desglose.map((d) => (
              <View key={d.clave} style={styles.filaDesglose}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing(2),
                    flex: 1,
                  }}
                >
                  <View style={[styles.punto, { backgroundColor: d.color }]} />
                  <Text style={styles.desgloseNombre} numberOfLines={1}>
                    {d.etiqueta}
                  </Text>
                </View>
                <Text style={styles.desglosePct}>
                  {totalSemana > 0
                    ? ((d.monto / totalSemana) * 100).toFixed(0)
                    : 0}
                  %
                </Text>
                <Text style={styles.desgloseMonto}>${d.monto.toFixed(2)}</Text>
              </View>
            ))}
            <View
              style={[
                styles.filaTotal,
                {
                  borderTopWidth: 1,
                  borderTopColor: color.border,
                  paddingTop: spacing(3),
                },
              ]}
            >
              <Text style={styles.etiqueta}>Acumulado del mes</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={styles.valorMedio}
              >
                ${totalMes.toFixed(2)}
              </Text>
            </View>
          </Tarjeta>

          <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
            {gastosSemana.length === 0 ? (
              <EstadoVacio
                icono="document-text-outline"
                titulo="Todavía no hay gastos en esta semana"
                subtitulo="Agregalos con el botón + Nuevo."
              />
            ) : (
              <View style={{ paddingHorizontal: spacing(4) }}>
                {gastosSemana.map((g) => {
                  const cat = categoriaDe(g.categoriaId);
                  return (
                    <View key={g.id} style={styles.filaGastoContenedor}>
                      <Pressable
                        accessible={false}
                        onLongPress={() => confirmarEliminar(g)}
                        style={({ pressed }) => [
                          styles.filaGasto,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <View style={styles.gastoInfo}>
                          <Text style={styles.gastoDescripcion} numberOfLines={2}>
                            {g.descripcion}
                          </Text>
                          <Text style={styles.gastoMeta}>
                            {cat?.nombre ?? "Sin categoría"}
                            {cat?.nombre === "Otros" && g.categoriaDetalle
                              ? ` · ${g.categoriaDetalle}`
                              : ""}
                            {" · "}
                            {cuentaDe(g.cuentaId)?.nombre ?? "Sin cuenta"} ·{" "}
                            {g.fecha}
                          </Text>
                        </View>
                        <Text style={styles.gastoMonto}>
                          ${g.monto.toFixed(2)}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar gasto ${g.descripcion}`}
                        accessibilityHint="Solicita confirmación antes de eliminarlo."
                        hitSlop={4}
                        onPress={() => confirmarEliminar(g)}
                        style={({ pressed }) => [
                          styles.botonEliminar,
                          pressed && { backgroundColor: color.dangerBg },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={color.danger}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </Tarjeta>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    screenTitle: {
      fontFamily: font.display,
      fontSize: 30,
      lineHeight: 36,
      color: color.text,
    },
    screenIntro: {
      fontFamily: font.body,
      fontSize: 14,
      lineHeight: 21,
      color: color.textMuted,
    },
    contenedor: { flex: 1, backgroundColor: color.bg },
    encabezado: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    tituloCard: { fontFamily: font.display, fontSize: 20, color: color.text },
    filaTotal: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    etiqueta: {
      fontFamily: font.semibold,
      fontSize: 12,
      color: color.textMuted,
      fontWeight: "600",
    },
    valorGrande: { fontFamily: font.mono, fontSize: 20, color: color.text },
    valorMedio: { fontFamily: font.mono, fontSize: 16, color: color.text },
    filaDesglose: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
      paddingVertical: spacing(1),
    },
    punto: { width: 8, height: 8, borderRadius: 4 },
    desgloseNombre: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.text,
      flexShrink: 1,
    },
    desglosePct: {
      fontFamily: font.mono,
      fontSize: 12,
      color: color.textMuted,
      width: 36,
      textAlign: "right",
    },
    desgloseMonto: {
      fontFamily: font.mono,
      fontSize: 13,
      color: color.text,
      width: 70,
      textAlign: "right",
    },
    filaGastoContenedor: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: color.border,
    },
    filaGasto: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
      paddingVertical: spacing(3),
      minWidth: 0,
    },
    gastoInfo: { flex: 1, minWidth: 0 },
    botonEliminar: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
    },
    gastoDescripcion: {
      fontFamily: font.semibold,
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    gastoMeta: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.textMuted,
      marginTop: 2,
    },
    gastoMonto: { fontFamily: font.mono, fontSize: 14, color: color.text },
  });
