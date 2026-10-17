import { BlurFade } from "../../components/Motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { mensajeError, mesLocal, fechaLocal } from "core";
import ErrorTexto from "../../components/ErrorTexto";
import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarGastos,
  listarGastosRecientes,
  listarIngresos,
  listarIngresosRecientes,
  listarCategorias,
  listarCuentas,
  listarDeudas,
  balanceGeneral,
  calcularEndeudamiento,
  generarRecomendaciones,
  formatMonto,
  listarLugares,
  sumarMontos,
  type Gasto,
  type Lugar,
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

// Mes en la zona horaria del teléfono (toISOString es UTC: el último día del
// mes, después de las 19:00 en Ecuador, ya mostraba el mes siguiente).
const mesActual = () => mesLocal();

// El resumen compara como máximo los tres meses previos con el actual.
// La actividad reciente se consulta aparte para conservar movimientos más viejos.
function inicioVentanaResumen() {
  const [anio, mes] = mesActual().split("-").map(Number);
  return fechaLocal(new Date(anio, mes - 4, 1));
}

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

const ETIQUETA_NIVEL = { bajo: "Bajo", moderado: "Moderado", alto: "Alto" };

export default function ResumenScreen() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const COLOR_NIVEL = {
    bajo: color.success,
    moderado: color.warning,
    alto: color.danger,
  };
  const mes = mesActual();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [gastosRecientes, setGastosRecientes] = useState<Gasto[]>([]);
  const [ingresosRecientes, setIngresosRecientes] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [lugares, setLugares] = useState<Lugar[]>([]);

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
          setGastosRecientes([]);
          setIngresosRecientes([]);
          setCategorias([]);
          setCuentas([]);
          setDeudas([]);
          setLugares([]);
          setCargando(false);
          return;
        }
        const desde = inicioVentanaResumen();
        const [g, i, c, cu, d] = await Promise.all([
          listarGastos({ desde }),
          listarIngresos({ desde }),
          listarCategorias(),
          listarCuentas(),
          listarDeudas(),
        ]);
        if (!activo) return;
        // Si el periodo ya contiene ocho movimientos, ningún registro más
        // antiguo puede entrar en la actividad. Evitamos dos consultas.
        const [gr, ir] = g.length + i.length >= 8
          ? [g.slice(0, 8), i.slice(0, 8)]
          : await Promise.all([listarGastosRecientes(), listarIngresosRecientes()]);
        if (!activo) return;
        setGastos(g);
        setIngresos(i);
        setGastosRecientes(gr);
        setIngresosRecientes(ir);
        setCategorias(c);
        setCuentas(cu);
        setDeudas(d);
        setLugares([]);
        // Aparte: sin la migración de lugares, el resto del resumen sigue funcionando.
        listarLugares().then((l) => activo && setLugares(l)).catch(() => activo && setLugares([]));
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

  const gastosDelMes = useMemo(() => gastos.filter((g) => g.fecha.startsWith(mes)), [gastos, mes]);
  const ingresosDelMes = useMemo(() => ingresos.filter((i) => i.fecha.startsWith(mes)), [ingresos, mes]);
  const balance = balanceGeneral(gastosDelMes, ingresosDelMes);
  const endeudamiento = calcularEndeudamiento(deudas, balance.totalIngresos);
  const recomendaciones: Recomendacion[] = useMemo(() => generarRecomendaciones({
    mes,
    gastos,
    ingresos,
    categorias,
    cuentas,
    endeudamiento,
    lugares,
  }), [mes, gastos, ingresos, categorias, cuentas, endeudamiento.nivel, endeudamiento.porcentaje, lugares]);

  // «Dónde más pagas»: los 3 lugares con más gasto este mes.
  const dondeMasPagas = useMemo(() => {
    const porLugar = new Map<string, Gasto[]>();
    for (const gasto of gastosDelMes) {
      if (!gasto.lugarId) continue;
      const grupo = porLugar.get(gasto.lugarId) ?? [];
      grupo.push(gasto);
      porLugar.set(gasto.lugarId, grupo);
    }
    return lugares
      .map((lugar) => {
        const pagos = porLugar.get(lugar.id) ?? [];
        return { lugar, pagos: pagos.length, total: sumarMontos(pagos.map((g) => g.monto)) };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [lugares, gastosDelMes]);

  const semana = useMemo(() => construirSemana(gastos), [gastos]);
  const actividad = useMemo(() => construirActividad(
    gastosRecientes,
    ingresosRecientes,
    categorias,
    color,
  ).slice(0, 8), [gastosRecientes, ingresosRecientes, categorias, color]);
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
          <View style={styles.brandLockup} accessibilityRole="image" accessibilityLabel="fintrack">
            <Image
              source={require("../../assets/brand/fintrack-app-icon.png")}
              style={styles.brandIcon}
              accessible={false}
            />
            <Text style={styles.brandName}>fintrack</Text>
          </View>
          <BlurFade style={styles.intro}>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Resumen
            </Text>
            <Text style={styles.introTexto}>
              Ingresos y gastos de este mes, en un solo lugar.
            </Text>
          </BlurFade>

          {/* Primer uso: sin ningún movimiento todavía, lo único que muestra
              valor es anotar el primero. Cuentas y tarjetas pueden esperar. */}
          {gastosRecientes.length === 0 && ingresosRecientes.length === 0 && (
            <Tarjeta>
              <View style={styles.filaTitulo}>
                <Text style={styles.tituloCard}>Empezá con tu primer gasto</Text>
                <Ionicons name="sparkles-outline" size={18} color={color.primary} />
              </View>
              <Text style={styles.introTexto}>
                Anotá algo que hayas pagado hoy y ya vas a ver tu balance del
                mes. Tus cuentas y tarjetas las podés agregar después.
              </Text>
              <Boton
                titulo="Registrar mi primer gasto"
                variante="primario"
                onPress={() => router.push("/gasto/nuevo")}
              />
              <Boton
                titulo="Prefiero anotar un ingreso"
                onPress={() => router.push("/ingreso/nuevo")}
              />
            </Tarjeta>
          )}

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
                <View
                  key={dia.fecha}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${dia.fecha}: ${formatMonto(dia.total)} en gastos${dia.esHoy ? ", hoy" : ""}`}
                  style={styles.diaColumna}
                >
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

          {dondeMasPagas.length > 0 && (
            <Tarjeta>
              <Text style={styles.tituloCard}>Dónde más pagas</Text>
              {dondeMasPagas.map((x) => (
                <Pressable
                  key={x.lugar.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/lugar/[id]", params: { id: x.lugar.id, mes } })}
                  style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: spacing(3), paddingVertical: spacing(1.5) }, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="location-outline" size={18} color={color.primary} />
                  <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: color.text }} numberOfLines={1}>
                    {x.lugar.nombre}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: 12, color: color.textMuted }}>
                    {x.pagos} {x.pagos === 1 ? "pago" : "pagos"}
                  </Text>
                  <Text style={{ fontFamily: font.mono, fontSize: 14, color: color.text }}>${x.total.toFixed(2)}</Text>
                </Pressable>
              ))}
              <Boton titulo="Ver todos los lugares" onPress={() => router.push("/lugares")} />
            </Tarjeta>
          )}

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
  const montosPorDia = new Map<string, number[]>();
  for (const gasto of gastos) {
    const montos = montosPorDia.get(gasto.fecha) ?? [];
    montos.push(gasto.monto);
    montosPorDia.set(gasto.fecha, montos);
  }
  const dias: {
    fecha: string;
    etiqueta: string;
    total: number;
    esHoy: boolean;
  }[] = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const clave = fechaLocal(fecha); // día local, no UTC
    const total = sumarMontos(montosPorDia.get(clave) ?? []);
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
  // Sin ingresos del mes no hay con qué comparar: decir "estás en buena forma"
  // sería engañoso (y el endeudamiento sale 0 % por falta de ingreso).
  if (balance.totalIngresos === 0) {
    return {
      estado: "atencion",
      titulo: "Faltan tus ingresos del mes",
      detalle: "Anotá tu sueldo u otros ingresos para saber si te alcanza y cuánto pesan tus cuotas.",
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
    brandLockup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
    },
    brandIcon: { width: 30, height: 30, borderRadius: 8 },
    brandName: { fontFamily: font.semibold, fontSize: 16, color: color.text },
    intro: { gap: spacing(2), marginBottom: spacing(1) },
    screenTitle: {
      fontFamily: font.display,
      fontSize: 30,
      lineHeight: 36,
      color: color.text,
    },
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
