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
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarIngresos,
  listarCategorias,
  listarCuentas,
  eliminarIngreso,
  semanasDelMes,
  enRangoSemana,
  ultimosMeses,
  etiquetaMes,
  filasDetalleIngreso,
  type Ingreso,
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
import { avisar, confirmar } from "../../lib/dialogo";
import IslaDetalle from "../../components/IslaDetalle";

function mesActual() {
  return mesLocal(); // zona horaria del teléfono, no UTC
}

export default function IngresosScreen() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const COLOR_INGRESOS = color.success;
  const router = useRouter();
  const [mes, setMes] = useState(mesActual());
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");
  const [detalle, setDetalle] = useState<Ingreso | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([listarIngresos(), listarCategorias(), listarCuentas()])
      .then(([i, c, cu]) => {
        setIngresos(i);
        setCategorias(c);
        setCuentas(cu);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));

  const datosSemana = semanasDelMes(mes).map((s) => ({
    etiqueta: `Sem ${s.numero}`,
    valor: ingresosDelMes
      .filter((i) => enRangoSemana(i.fecha, s))
      .reduce((a, i) => a + i.monto, 0),
    color: COLOR_INGRESOS,
  }));
  const datosMes = ultimosMeses(mes, 6).map((m) => ({
    etiqueta: etiquetaMes(m).slice(0, 3),
    valor: ingresos
      .filter((i) => i.fecha.startsWith(m))
      .reduce((a, i) => a + i.monto, 0),
    color: COLOR_INGRESOS,
  }));

  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }
  function categoriaDe(id?: string) {
    return id ? categorias.find((c) => c.id === id) : undefined;
  }

  async function confirmarEliminar(ingreso: Ingreso) {
    // `confirmar` también funciona en la versión web (Alert.alert ahí no hace nada).
    if (!(await confirmar("Eliminar ingreso", `¿Eliminar "${ingreso.descripcion}"?`, "Eliminar"))) return;
    eliminarIngreso(ingreso.id)
      .then(() => {
        setDetalle(null);
        cargar();
      })
      .catch((err) => avisar("No se pudo eliminar", mensajeError(err)));
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
              Ingresos
            </Text>
            <Text style={styles.screenIntro}>
              Seguí tus entradas de dinero.
            </Text>
          </BlurFade>
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <View style={styles.encabezado}>
            <SelectorMes mes={mes} onCambiar={setMes} />
            <Boton
              titulo="+ Nuevo"
              variante="primario"
              onPress={() => router.push({ pathname: "/ingreso/nuevo", params: { mes } })}
            />
          </View>

          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Text style={styles.tituloCard}>Ingresos</Text>
              <SelectorChips
                titulo="Período"
                valor={periodo}
                onCambiar={(v) => setPeriodo(v as "semana" | "mes")}
                opciones={[
                  { valor: "semana", etiqueta: "Semana" },
                  { valor: "mes", etiqueta: "Mes" },
                ]}
              />
            </View>
            <GraficoBarras
              datos={periodo === "semana" ? datosSemana : datosMes}
              mensajeVacio="Sin ingresos en este período."
            />
          </Tarjeta>

          <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
            {ingresosDelMes.length === 0 ? (
              <EstadoVacio
                icono="trending-up-outline"
                titulo="Todavía no hay ingresos este mes"
                subtitulo="Registrá tu sueldo, freelance u otra entrada de dinero."
              />
            ) : (
              <View style={{ paddingHorizontal: spacing(4) }}>
                {ingresosDelMes.map((i) => {
                  const cat = categoriaDe(i.categoriaId);
                  return (
                    <View key={i.id} style={styles.filaContenedor}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${i.descripcion}, $${i.monto.toFixed(2)}`}
                        accessibilityHint="Muestra el id, la fecha, la hora y los demás datos."
                        onPress={() => setDetalle(i)}
                        onLongPress={() => confirmarEliminar(i)}
                        style={({ pressed }) => [
                          styles.fila,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <View style={styles.filaInfo}>
                          <Text style={styles.filaDescripcion} numberOfLines={2}>
                            {i.descripcion}
                          </Text>
                          <Text style={styles.filaMeta}>
                            {cat?.nombre ?? "Sin fuente"}
                            {cat?.nombre === "Otros" && i.categoriaDetalle
                              ? ` · ${i.categoriaDetalle}`
                              : ""}
                            {" · "}
                            {cuentaDe(i.cuentaId)?.nombre ?? "Sin cuenta"} ·{" "}
                            {i.fecha}
                          </Text>
                        </View>
                        <Text style={styles.filaMonto}>
                          ${i.monto.toFixed(2)}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar ingreso ${i.descripcion}`}
                        accessibilityHint="Solicita confirmación antes de eliminarlo."
                        hitSlop={4}
                        onPress={() => confirmarEliminar(i)}
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
      {detalle && (
        <IslaDetalle
          visible
          onCerrar={() => setDetalle(null)}
          icono="trending-up-outline"
          colorIcono={COLOR_INGRESOS}
          titulo={detalle.descripcion}
          monto={`$${detalle.monto.toFixed(2)}`}
          filas={filasDetalleIngreso(detalle, {
            categoria: categoriaDe(detalle.categoriaId),
            cuenta: cuentaDe(detalle.cuentaId),
          })}
          acciones={[
            {
              titulo: "Editar",
              icono: "create-outline",
              onPress: () => {
                setDetalle(null);
                router.push({ pathname: "/ingreso/editar", params: { id: detalle.id } });
              },
            },
            { titulo: "Eliminar", icono: "trash-outline", peligro: true, onPress: () => confirmarEliminar(detalle) },
          ]}
        />
      )}
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
    filaTitulo: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    tituloCard: { fontFamily: font.display, fontSize: 20, color: color.text },
    filaContenedor: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: color.border,
    },
    fila: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
      paddingVertical: spacing(3),
      minWidth: 0,
    },
    filaInfo: { flex: 1, minWidth: 0 },
    botonEliminar: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
    },
    filaDescripcion: {
      fontFamily: font.semibold,
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    filaMeta: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.textMuted,
      marginTop: 2,
    },
    filaMonto: { fontFamily: font.mono, fontSize: 14, color: color.success },
  });
