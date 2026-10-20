import { SafeAreaView } from "react-native-safe-area-context";
import SelectorChips from "../../components/SelectorChips";
import { fechaLocal, mensajeError, mesLocal, semanaDeFecha, semanaInicial } from "core";
import ErrorTexto from "../../components/ErrorTexto";
import { useCallback, useRef, useState } from "react";
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
  listarGastos,
  listarCategorias,
  listarCuentas,
  eliminarGasto,
  semanasDelMes,
  enRangoSemana,
  agruparPorCategoriaODetalle,
  listarLugares,
  filasDetalleGasto,
  etiquetaMes,
  type Gasto,
  type Lugar,
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
import { abrirEnMapas } from "../../lib/ubicacion";
import { avisar, confirmar } from "../../lib/dialogo";
import { tomarFechaGuardada } from "../../lib/semanaGuardada";
import IslaDetalle, { type AccionIsla } from "../../components/IslaDetalle";

function mesActual() {
  return mesLocal(); // zona horaria del teléfono, no UTC
}

export default function GastosScreen() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verDesglose, setVerDesglose] = useState(false);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [mes, setMes] = useState(mesActual());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  // Se abre en la semana de hoy (el 16 es la semana 3; desde el 22, la 4).
  const [semanaActiva, setSemanaActiva] = useState(() => semanaInicial(mesActual()));
  const [detalle, setDetalle] = useState<Gasto | null>(null);
  const diaVisto = useRef(fechaLocal());

  function cambiarMes(nuevo: string) {
    setMes(nuevo);
    setSemanaActiva(semanaInicial(nuevo));
  }

  const cargar = useCallback(() => {
    // Si la app quedó abierta y cambió el día, vuelve al mes y la semana de hoy.
    const hoy = fechaLocal();
    if (hoy !== diaVisto.current) {
      diaVisto.current = hoy;
      setMes(hoy.slice(0, 7));
      setSemanaActiva(semanaDeFecha(hoy));
    }
    // Recién guardado un gasto: se muestra su semana, aunque no sea la de hoy.
    const guardada = tomarFechaGuardada();
    if (guardada) {
      setMes(guardada.slice(0, 7));
      setSemanaActiva(semanaDeFecha(guardada));
    }
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
    // Aparte: una base sin la migración de lugares no debe dejar la pantalla en blanco.
    listarLugares().then(setLugares).catch(() => setLugares([]));
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

  async function confirmarEliminar(gasto: Gasto) {
    // `confirmar` también funciona en la versión web (Alert.alert ahí no hace nada).
    if (!(await confirmar("Eliminar gasto", `¿Eliminar "${gasto.descripcion}"?`, "Eliminar"))) return;
    // Si la base no lo permite (p. ej. un diferido con abonos) o no hay
    // red, se avisa: antes fallaba en silencio y parecía borrado.
    eliminarGasto(gasto.id)
      .then(() => {
        setDetalle(null);
        cargar();
        void avisar("Gasto eliminado", "Se quitó de tu registro.", "success");
      })
      .catch((err) => avisar("No se pudo eliminar", mensajeError(err), "error"));
  }

  function accionesDe(g: Gasto): AccionIsla[] {
    // «Abrir en Mapas» va en el mismo mapa de la isla.
    const acciones: AccionIsla[] = [
      {
        titulo: "Editar",
        icono: "create-outline",
        onPress: () => {
          setDetalle(null);
          router.push({ pathname: "/gasto/editar", params: { id: g.id } });
        },
      },
    ];
    if (g.lugarId) {
      const lugarId = g.lugarId;
      acciones.push({
        titulo: "Ver lugar",
        icono: "location-outline",
        onPress: () => {
          setDetalle(null);
          router.push({ pathname: "/lugar/[id]", params: { id: lugarId } });
        },
      });
    }
    acciones.push({ titulo: "Eliminar", icono: "trash-outline", peligro: true, onPress: () => confirmarEliminar(g) });
    return acciones;
  }

  /** Dónde se pagó: la ubicación guardada o, si se eligió un lugar a mano, la de ese lugar. */
  function ubicacionDe(g: Gasto) {
    if (g.ubicacion) return g.ubicacion;
    const lugar = g.lugarId ? lugares.find((l) => l.id === g.lugarId) : undefined;
    return lugar ? { latitud: lugar.latitud, longitud: lugar.longitud } : undefined;
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
            paddingHorizontal: spacing(5),
            paddingTop: spacing(3),
            paddingBottom: spacing(8),
            gap: spacing(3.5),
          }}
        >
          <BlurFade style={styles.intro}>
            <Text style={styles.eyebrow}>TUS MOVIMIENTOS</Text>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Gastos
            </Text>
            <Text style={styles.screenIntro}>
              Consulta lo que gastaste este mes.
            </Text>
          </BlurFade>
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <View style={styles.encabezado}>
            <View style={styles.monthSelector}><SelectorMes mes={mes} onCambiar={cambiarMes} compact /></View>
            <Boton
              titulo="Nuevo gasto"
              variante="primario"
              style={styles.newAction}
              onPress={() =>
                router.push({ pathname: "/gasto/nuevo", params: { mes, semana: String(semanaActiva) } })
              }
            />
          </View>

          <BlurFade style={styles.weeklyCard}>
            <View style={styles.weeklyHeading}>
              <Text style={styles.etiqueta}>Total de la semana</Text>
              <Text style={styles.weekRange}>{rango.desde}–{rango.hasta} {etiquetaMes(mes).slice(0, 3).toLowerCase()}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.valorGrande}>
              ${totalSemana.toFixed(2)}
            </Text>
            <Text style={styles.weeklySub}>De ${totalMes.toFixed(2)} gastados este mes</Text>
            <SelectorChips
              titulo=""
              suave
              valor={String(semanaActiva)}
              onCambiar={(v) => setSemanaActiva(Number(v))}
              opciones={semanas.map((semana) => ({ valor: String(semana.numero), etiqueta: `Sem ${semana.numero}` }))}
            />
          </BlurFade>

          <View style={styles.sectionHeading}>
            <Text style={styles.tituloCard}>Movimientos</Text>
            <Text style={styles.sectionCount}>{gastosSemana.length} {gastosSemana.length === 1 ? "gasto" : "gastos"}</Text>
          </View>

          <Tarjeta style={styles.listCard}>
            {gastosSemana.length === 0 ? (
              <EstadoVacio
                icono="document-text-outline"
                titulo="Todavía no hay gastos en esta semana"
                subtitulo="Agregalos con el botón Nuevo gasto."
              />
            ) : (
              <View style={{ paddingHorizontal: spacing(4) }}>
                {gastosSemana.map((g) => {
                  const cat = categoriaDe(g.categoriaId);
                  return (
                    <View key={g.id} style={styles.filaGastoContenedor}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${g.descripcion}, $${g.monto.toFixed(2)}`}
                        accessibilityHint="Muestra el id, la fecha, la hora, el lugar y los demás datos."
                        onPress={() => setDetalle(g)}
                        onLongPress={() => confirmarEliminar(g)}
                        style={({ pressed }) => [
                          styles.filaGasto,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <View style={styles.gastoIcono}>
                          <Ionicons name="receipt-outline" size={18} color={cat?.color ?? color.textMuted} />
                        </View>
                        <View style={styles.gastoInfo}>
                          <Text style={styles.gastoDescripcion} numberOfLines={1}>
                            {g.descripcion}
                          </Text>
                          <Text style={styles.gastoMeta} numberOfLines={1}>
                            {cat?.nombre ?? "Sin categoría"}
                            {cat?.nombre === "Otros" && g.categoriaDetalle
                              ? ` · ${g.categoriaDetalle}`
                              : ""}
                            {" · "}
                            {cuentaDe(g.cuentaId)?.nombre ?? "Sin cuenta"}
                          </Text>
                        </View>
                        <Text style={styles.gastoMonto}>
                          ${g.monto.toFixed(2)}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </Tarjeta>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: verDesglose }}
            onPress={() => setVerDesglose((actual) => !actual)}
            style={({ pressed }) => [styles.breakdownToggle, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.breakdownToggleText}>{verDesglose ? "Ocultar desglose por categoría" : "Ver desglose por categoría"}</Text>
            <Ionicons name={verDesglose ? "chevron-up" : "chevron-forward"} size={18} color={color.textMuted} />
          </Pressable>

          {verDesglose && <View style={styles.breakdownContent}>
            <Tarjeta>
              <Text style={styles.tituloCard}>Gastos por categoría · Semana {semanaActiva}</Text>
              <GraficoBarras datos={datosGrafico} mensajeVacio="Sin gastos en este período." />
            </Tarjeta>
            <Tarjeta>
              {desglose.map((d) => (
                <View key={d.clave} style={styles.filaDesglose}>
                  <View style={styles.desgloseInfo}>
                    <View style={[styles.punto, { backgroundColor: d.color }]} />
                    <Text style={styles.desgloseNombre} numberOfLines={1}>{d.etiqueta}</Text>
                  </View>
                  <Text style={styles.desglosePct}>{totalSemana > 0 ? ((d.monto / totalSemana) * 100).toFixed(0) : 0}%</Text>
                  <Text style={styles.desgloseMonto}>${d.monto.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.monthTotal}>
                <Text style={styles.etiqueta}>Acumulado del mes</Text>
                <Text style={styles.valorMedio}>${totalMes.toFixed(2)}</Text>
              </View>
            </Tarjeta>
          </View>}
        </ScrollView>
      </KeyboardAvoidingView>
      {detalle && (
        <IslaDetalle
          visible
          onCerrar={() => setDetalle(null)}
          icono="receipt-outline"
          colorIcono={categoriaDe(detalle.categoriaId)?.color}
          titulo={detalle.descripcion}
          monto={`$${detalle.monto.toFixed(2)}`}
          filas={filasDetalleGasto(detalle, {
            categoria: categoriaDe(detalle.categoriaId),
            cuenta: cuentaDe(detalle.cuentaId),
            lugar: detalle.lugarId ? lugares.find((l) => l.id === detalle.lugarId) : undefined,
          })}
          acciones={accionesDe(detalle)}
          ubicacion={ubicacionDe(detalle)}
          onAbrirMapa={() => {
            const u = ubicacionDe(detalle);
            if (u) abrirEnMapas(u).catch(() => undefined);
          }}
          sinUbicacion={detalle.billetera ? "Este pago no tiene ubicación guardada." : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    intro: { gap: spacing(1.5), marginBottom: spacing(1) },
    eyebrow: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.4, color: color.textMuted },
    screenTitle: {
      fontFamily: font.semibold,
      fontSize: 32,
      lineHeight: 38,
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
      gap: spacing(2),
      justifyContent: "space-between",
      alignItems: "center",
    },
    monthSelector: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 13 },
    newAction: { minHeight: 44, borderRadius: 13, paddingHorizontal: spacing(3) },
    weeklyCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 22, padding: spacing(5), gap: spacing(2) },
    weeklyHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing(2) },
    weekRange: { fontFamily: font.medium, fontSize: 11, color: color.textMuted, backgroundColor: color.surface2, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5) },
    weeklySub: { fontFamily: font.body, fontSize: 12, color: color.textMuted, marginBottom: spacing(2) },
    sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing(3) },
    sectionCount: { fontFamily: font.semibold, fontSize: 12, color: color.textMuted },
    tituloCard: { fontFamily: font.semibold, fontSize: 18, color: color.text },
    etiqueta: {
      fontFamily: font.medium,
      fontSize: 13,
      color: color.textMuted,
    },
    valorGrande: { fontFamily: font.semibold, fontSize: 34, letterSpacing: -1.4, color: color.text },
    valorMedio: { fontFamily: font.mono, fontSize: 16, color: color.text },
    listCard: { padding: 0, borderRadius: 21 },
    breakdownToggle: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 15, minHeight: 50, paddingHorizontal: spacing(4), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    breakdownToggleText: { fontFamily: font.semibold, fontSize: 13, color: color.text },
    breakdownContent: { gap: spacing(4) },
    desgloseInfo: { flexDirection: "row", alignItems: "center", gap: spacing(2), flex: 1 },
    monthTotal: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing(3), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    filaGasto: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
      paddingVertical: spacing(3),
      minWidth: 0,
      minHeight: 64,
    },
    gastoIcono: { width: 38, height: 38, borderRadius: 13, backgroundColor: color.surface2, alignItems: "center", justifyContent: "center" },
    gastoInfo: { flex: 1, minWidth: 0 },
    gastoDescripcion: {
      fontFamily: font.semibold,
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    gastoMeta: {
      fontFamily: font.body,
      fontSize: 12,
      color: color.textMuted,
      marginTop: 2,
    },
    gastoMonto: { fontFamily: font.mono, fontSize: 14, color: color.text },
  });
