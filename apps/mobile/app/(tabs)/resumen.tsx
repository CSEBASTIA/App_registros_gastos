import { BlurFade } from "../../components/Motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { mensajeError } from "core";
import ErrorTexto from "../../components/ErrorTexto";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarGastos,
  listarIngresos,
  listarCategorias,
  listarCuentas,
  listarDeudas,
  balanceGeneral,
  calcularEndeudamiento,
  generarRecomendaciones,
  formatMonto,
  type Gasto,
  type Ingreso,
  type Categoria,
  type Cuenta,
  type Deuda,
  type Recomendacion,
} from "core";
import { supabase } from "../../lib/supabase";
import Tarjeta from "../../components/Tarjeta";
import Boton from "../../components/Boton";
import BarraProgreso from "../../components/BarraProgreso";
import EstadoVacio from "../../components/EstadoVacio";
import ItemMovimiento from "../../components/ItemMovimiento";
import { radius, spacing, useTheme, font, type Colors } from "../../lib/theme";

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

const ETIQUETA_NIVEL = { bajo: "Bajo", moderado: "Moderado", alto: "Alto" };

export default function ResumenScreen() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const COLOR_NIVEL = {
    bajo: color.success,
    moderado: color.warning,
    alto: color.danger,
  };
  const mes = mesActual();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);

  const cargar = useCallback(() => {
    let activo = true;
    async function cargarDatos() {
      setCargando(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        if (!activo) return;
        if (!data.session) {
          setGastos([]);
          setIngresos([]);
          setCategorias([]);
          setCuentas([]);
          setDeudas([]);
          setCargando(false);
          return;
        }
        const [g, i, c, cu, d] = await Promise.all([
          listarGastos(),
          listarIngresos(),
          listarCategorias(),
          listarCuentas(),
          listarDeudas(),
        ]);
        if (!activo) return;
        setGastos(g);
        setIngresos(i);
        setCategorias(c);
        setCuentas(cu);
        setDeudas(d);
      } catch (err) {
        if (activo) setError(mensajeError(err));
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargarDatos();
    return () => { activo = false; };
  }, []);
  useFocusEffect(cargar);

  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const balance = balanceGeneral(gastosDelMes, ingresosDelMes);
  const endeudamiento = calcularEndeudamiento(deudas, balance.totalIngresos);
  const recomendaciones: Recomendacion[] = generarRecomendaciones({
    mes,
    gastos,
    ingresos,
    categorias,
    cuentas,
    endeudamiento,
  });

  const semana = construirSemana(gastos);
  const actividad = construirActividad(
    gastos,
    ingresos,
    categorias,
    color,
  ).slice(0, 8);
  const veredicto = veredictoFinanciero(balance, endeudamiento);

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

  if (error)
    return (
      <SafeAreaView style={styles.contenedor} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing(5), gap: spacing(4) }}
        >
          <Text accessibilityRole="header" style={styles.tituloCard}>
            Resumen
          </Text>
          <ErrorTexto>{error}</ErrorTexto>
          <Boton titulo="Reintentar" onPress={cargar} />
        </ScrollView>
      </SafeAreaView>
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
          <BlurFade style={styles.intro}>
            <Text style={styles.introTexto}>
              Ingresos y gastos de este mes, en un solo lugar.
            </Text>
          </BlurFade>

          <View style={styles.hero}>
            <Text style={styles.heroEtiqueta}>Balance del mes</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={styles.heroValor}
            >
              {balance.balance > 0 ? "+" : balance.balance < 0 ? "−" : ""}$
              {Math.abs(balance.balance).toFixed(2)}
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Ionicons
                  name="arrow-up-circle"
                  size={22}
                  color={color.success}
                />
                <View>
                  <Text style={styles.heroStatEtiqueta}>Ingresos del mes</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={styles.heroStatValor}
                  >
                    ${balance.totalIngresos.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.heroStat}>
                <Ionicons
                  name="arrow-down-circle"
                  size={22}
                  color={color.danger}
                />
                <View>
                  <Text style={styles.heroStatEtiqueta}>Gastado este mes</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={styles.heroStatValor}
                  >
                    ${balance.totalGastos.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Text style={styles.tituloCard}>Resumen semanal</Text>
              <Text style={styles.etiquetaMuted}>Últimos 7 días</Text>
            </View>
            <View style={styles.grafico}>
              {semana.map((dia) => (
                <View key={dia.fecha} style={styles.diaColumna}>
                  <View style={styles.diaPista}>
                    <View
                      style={[
                        styles.diaRelleno,
                        {
                          height: `${dia.alturaPorcentaje}%`,
                          backgroundColor: dia.esHoy
                            ? color.primary
                            : color.border,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.diaEtiqueta,
                      dia.esHoy && { color: color.primary, fontWeight: "700" },
                    ]}
                  >
                    {dia.etiqueta}
                  </Text>
                </View>
              ))}
            </View>
          </Tarjeta>

          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Text style={styles.tituloCard}>Salud financiera</Text>
              <Text
                style={{
                  fontFamily: font.semibold,
                  fontSize: 12,
                  fontWeight: "700",
                  color: COLOR_NIVEL[endeudamiento.nivel],
                }}
              >
                Endeudamiento: {ETIQUETA_NIVEL[endeudamiento.nivel]}
              </Text>
            </View>
            <View
              style={[
                styles.veredicto,
                {
                  backgroundColor:
                    veredicto.estado === "bien"
                      ? color.successBg
                      : veredicto.estado === "atencion"
                        ? color.warningBg
                        : color.dangerBg,
                },
              ]}
            >
              <Ionicons
                name={
                  veredicto.estado === "bien"
                    ? "checkmark-circle"
                    : "alert-circle"
                }
                size={22}
                color={
                  veredicto.estado === "bien"
                    ? color.success
                    : veredicto.estado === "atencion"
                      ? color.warning
                      : color.danger
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.veredictoTitulo}>{veredicto.titulo}</Text>
                <Text style={styles.veredictoDetalle}>{veredicto.detalle}</Text>
              </View>
            </View>
            <BarraProgreso porcentaje={endeudamiento.porcentaje} />
          </Tarjeta>

          <Tarjeta>
            <Text style={styles.tituloCard}>Recomendaciones</Text>
            {recomendaciones.length === 0 ? (
              <EstadoVacio
                icono="home-outline"
                titulo="Todavía no hay recomendaciones"
                subtitulo="Registrá más gastos e ingresos para que podamos analizar tus hábitos."
              />
            ) : (
              <View style={{ gap: spacing(2) }}>
                {recomendaciones.map((r, i) => (
                  <View
                    key={i}
                    style={[
                      styles.recomendacion,
                      {
                        backgroundColor:
                          r.severidad === "alerta"
                            ? color.dangerBg
                            : color.primaryBg,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: font.body,
                        fontSize: 13,
                        color:
                          r.severidad === "alerta"
                            ? color.danger
                            : color.primary,
                      }}
                    >
                      {r.mensaje}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Tarjeta>

          <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
            <Text
              style={[styles.tituloCard, { paddingHorizontal: spacing(4) }]}
            >
              Actividad reciente
            </Text>
            {actividad.length === 0 ? (
              <EstadoVacio
                icono="home-outline"
                titulo="Sin movimientos todavía"
                subtitulo="Tus últimos gastos e ingresos aparecerán aquí."
              />
            ) : (
              <View style={{ paddingHorizontal: spacing(4) }}>
                {actividad.map((item) => (
                  <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
                ))}
              </View>
            )}
          </Tarjeta>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function construirSemana(gastos: Gasto[]) {
  const hoy = new Date();
  const dias: {
    fecha: string;
    etiqueta: string;
    total: number;
    esHoy: boolean;
  }[] = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const clave = fecha.toISOString().slice(0, 10);
    const total = gastos
      .filter((g) => g.fecha === clave)
      .reduce((acc, g) => acc + g.monto, 0);
    dias.push({
      fecha: clave,
      etiqueta: DIAS_SEMANA[fecha.getDay()],
      total,
      esHoy: i === 0,
    });
  }
  const maximo = Math.max(...dias.map((d) => d.total), 1);
  return dias.map((d) => ({
    ...d,
    alturaPorcentaje: Math.max(6, (d.total / maximo) * 100),
  }));
}

function construirActividad(
  gastos: Gasto[],
  ingresos: Ingreso[],
  categorias: Categoria[],
  color: Colors,
) {
  const items = [
    ...gastos.map((g) => {
      const categoria = categorias.find((c) => c.id === g.categoriaId);
      const esOtrosConDetalle =
        categoria?.nombre === "Otros" && g.categoriaDetalle;
      return {
        id: g.id,
        tipo: "gasto" as const,
        descripcion: g.descripcion || categoria?.nombre || "Gasto",
        subtitulo: esOtrosConDetalle
          ? g.categoriaDetalle!
          : (categoria?.nombre ?? "Sin categoría"),
        monto: g.monto,
        fecha: g.fecha,
        createdAt: g.createdAt,
        color: categoria?.color ?? color.textMuted,
      };
    }),
    ...ingresos.map((i) => ({
      id: i.id,
      tipo: "ingreso" as const,
      descripcion: i.descripcion || "Ingreso",
      subtitulo: "Ingreso",
      monto: i.monto,
      fecha: i.fecha,
      createdAt: i.createdAt,
      color: color.success,
    })),
  ];
  return items.sort((a, b) =>
    a.fecha !== b.fecha
      ? a.fecha < b.fecha
        ? 1
        : -1
      : a.createdAt < b.createdAt
        ? 1
        : -1,
  );
}

type EstadoFinanciero = "bien" | "atencion" | "riesgo";

function veredictoFinanciero(
  balance: { balance: number; totalIngresos: number },
  endeudamiento: { nivel: "bajo" | "moderado" | "alto"; porcentaje: number },
): { titulo: string; detalle: string; estado: EstadoFinanciero } {
  if (endeudamiento.nivel === "alto") {
    return {
      estado: "riesgo",
      titulo: "Endeudamiento alto",
      detalle: `El ${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso mensual se va en cuotas de deuda. Evitá tomar más deuda por ahora.`,
    };
  }
  if (balance.totalIngresos > 0 && balance.balance < 0) {
    return {
      estado: "riesgo",
      titulo: "Gastando más de lo que ingresa",
      detalle: `Este mes tus gastos superan tus ingresos por $${Math.abs(balance.balance).toFixed(2)}.`,
    };
  }
  if (endeudamiento.nivel === "moderado") {
    return {
      estado: "atencion",
      titulo: "Endeudamiento moderado",
      detalle: `El ${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso se va en cuotas. Vale la pena vigilarlo.`,
    };
  }
  return {
    estado: "bien",
    titulo: "Estás en buena forma",
    detalle: "Tus ingresos cubren tus gastos y cuotas de deuda sin problema.",
  };
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    intro: { marginBottom: spacing(1) },
    introTexto: { fontFamily: font.body, fontSize: 14, color: color.textMuted },
    hero: {
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      padding: spacing(5),
      gap: spacing(2),
    },
    heroEtiqueta: {
      fontFamily: font.semibold,
      color: color.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    heroValor: { fontFamily: font.semibold, color: color.text, fontSize: 34, letterSpacing: -1.5 },
    heroStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(5),
      marginTop: spacing(2),
    },
    heroStat: {
      flexDirection: "row",
      flex: 1,
      minWidth: 130,
      alignItems: "center",
      gap: spacing(2),
    },
    heroStatEtiqueta: {
      fontFamily: font.body,
      color: color.textMuted,
      fontSize: 11,
    },
    heroStatValor: { fontFamily: font.mono, color: color.text, fontSize: 14 },
    filaTitulo: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    tituloCard: { fontFamily: font.display, fontSize: 20, color: color.text },
    etiquetaMuted: {
      fontFamily: font.body,
      fontSize: 11,
      color: color.textMuted,
    },
    grafico: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing(2),
      height: 100,
    },
    diaColumna: {
      flex: 1,
      alignItems: "center",
      height: "100%",
      justifyContent: "flex-end",
      gap: spacing(1),
    },
    diaPista: { flex: 1, width: "100%", justifyContent: "flex-end" },
    diaRelleno: { width: "100%", borderRadius: 4, minHeight: 4 },
    diaEtiqueta: {
      fontFamily: font.body,
      fontSize: 11,
      color: color.textMuted,
    },
    veredicto: {
      flexDirection: "row",
      gap: spacing(3),
      padding: spacing(3),
      borderRadius: radius.sm,
      alignItems: "flex-start",
    },
    veredictoTitulo: {
      fontFamily: font.display,
      fontSize: 18,
      color: color.text,
    },
    veredictoDetalle: {
      fontFamily: font.body,
      fontSize: 12,
      color: color.textMuted,
      marginTop: 2,
    },
    recomendacion: { padding: spacing(3), borderRadius: radius.sm },
  });
