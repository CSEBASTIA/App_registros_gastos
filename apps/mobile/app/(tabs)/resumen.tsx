import { BlurFade } from "../../components/Motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { mensajeError, mesLocal, fechaLocal, etiquetaMes } from "core";
import SelectorChips from "../../components/SelectorChips";
import { cambiarTarjetaFavorita, leerTarjetasFavoritas } from "../../lib/tarjetasFavoritas";
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
  listarPagosTarjeta,
  balanceGeneral,
  efectivoNeto,
  calcularEndeudamiento,
  generarRecomendaciones,
  formatMonto,
  listarLugares,
  listarPresupuestos,
  contarTransaccionesPendientes,
  estadoPresupuestos,
  comparacionMensual,
  resumenTarjetas,
  resumenAhorro,
  resumenDiferidos,
  sumarMontos,
  type Gasto,
  type Presupuesto,
  type Lugar,
  type Ingreso,
  type Categoria,
  type Cuenta,
  type Deuda,
  type PagoTarjeta,
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

/** Las 4 partes del Resumen: una a la vez, para no recorrer una página larga. */
type Parte = "general" | "tarjetas" | "presupuesto" | "ahorro";
const PARTES: { valor: Parte; etiqueta: string }[] = [
  { valor: "general", etiqueta: "General" },
  { valor: "tarjetas", etiqueta: "Tarjetas" },
  { valor: "presupuesto", etiqueta: "Presupuesto" },
  { valor: "ahorro", etiqueta: "Ahorro" },
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-10-28" → "28 oct" */
const diaMes = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
/** -12.5 → "-12.50" (sin signo de dólar, para las tablas). */
const cifra = (n: number) => formatMonto(n).replace("$", "");
const cambioTexto = (c?: number) => (c === undefined ? "—" : `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c)} %`);

export default function ResumenScreen() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verTodaActividad, setVerTodaActividad] = useState(false);
  const [verAnalisis, setVerAnalisis] = useState(false);
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
  const [pagosTarjeta, setPagosTarjeta] = useState<PagoTarjeta[]>([]);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [favoritas, setFavoritas] = useState<string[]>([]);
  const [parte, setParte] = useState<Parte>("general");
  const [eligiendoFavoritas, setEligiendoFavoritas] = useState(false);

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
          setPagosTarjeta([]);
          setLugares([]);
          setPresupuestos([]);
          setPendientes(0);
          setFavoritas([]);
          setCargando(false);
          return;
        }
        const desde = inicioVentanaResumen();
        const [g, i, c, cu, d, pt] = await Promise.all([
          listarGastos({ desde }),
          listarIngresos({ desde }),
          listarCategorias(),
          listarCuentas(),
          listarDeudas(),
          listarPagosTarjeta(),
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
        setPagosTarjeta(pt);
        setLugares([]);
        // Aparte: sin la migración de lugares, el resto del resumen sigue funcionando.
        listarLugares().then((l) => activo && setLugares(l)).catch(() => activo && setLugares([]));
        // Igual con presupuestos, la bandeja y las favoritas: si fallan, solo falta esa parte.
        listarPresupuestos(mesActual()).then((p) => activo && setPresupuestos(p)).catch(() => activo && setPresupuestos([]));
        contarTransaccionesPendientes().then((n) => activo && setPendientes(n)).catch(() => activo && setPendientes(0));
        leerTarjetasFavoritas().then((f) => activo && setFavoritas(f));
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
  // La salud financiera mira todo lo gastado (también con tarjeta); el
  // efectivo neto, solo el dinero que ya salió (la tarjeta, al pagarla).
  const balance = balanceGeneral(gastosDelMes, ingresosDelMes);
  const efectivo = efectivoNeto(
    gastosDelMes,
    ingresosDelMes,
    cuentas,
    pagosTarjeta.filter((p) => p.fecha.startsWith(mes)),
  );
  const salioDeTuDinero = sumarMontos([efectivo.gastadoConTuDinero, efectivo.pagosTarjeta]);
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

  const hoy = fechaLocal();
  const tarjetasCredito = cuentas.filter((c) => c.tipo === "credito");
  const tarjetas = useMemo(() => resumenTarjetas(cuentas, gastos, mes, favoritas, hoy), [cuentas, gastos, mes, favoritas, hoy]);
  const estadosPresupuesto = useMemo(() => estadoPresupuestos(mes, presupuestos, gastos, categorias), [mes, presupuestos, gastos, categorias]);
  const totalPresupuesto = useMemo(() => {
    const limite = sumarMontos(estadosPresupuesto.map((e) => e.presupuesto.montoLimite));
    const gastado = sumarMontos(estadosPresupuesto.map((e) => e.gastado));
    return { limite, gastado, porcentaje: limite > 0 ? Math.round((gastado / limite) * 100) : 0 };
  }, [estadosPresupuesto]);
  const comparacion = useMemo(() => comparacionMensual(gastos, ingresos, mes), [gastos, ingresos, mes]);
  const ahorro = useMemo(() => resumenAhorro(cuentas, gastos, ingresos, mes), [cuentas, gastos, ingresos, mes]);
  const diferidos = useMemo(() => resumenDiferidos(deudas, cuentas, gastos), [deudas, cuentas, gastos]);

  // «Para revisar»: lo que pide hacer algo, como mucho 3 avisos.
  const porRevisar = [
    ...cuentas
      .filter((c) => c.tipo === "credito" && c.disponible < 0)
      .map((c) => ({ clave: `cupo-${c.id}`, tono: "malo" as const, icono: "alert-circle-outline" as const, texto: `${c.nombre} pasó el cupo: ${formatMonto(c.disponible)}`, ruta: `/tarjeta/${c.id}` })),
    ...estadosPresupuesto
      .filter((e) => e.nivel === "excedido")
      .map((e) => ({ clave: `pres-${e.presupuesto.id}`, tono: "aviso" as const, icono: "pie-chart-outline" as const, texto: `${e.categoriaNombre}: te pasaste del presupuesto por ${formatMonto(-e.restante)}`, ruta: "/presupuestos" })),
    ...(pendientes > 0
      ? [{ clave: "bandeja", tono: "neutro" as const, icono: "file-tray-outline" as const, texto: pendientes + " " + (pendientes === 1 ? "transacción por revisar" : "transacciones por revisar") + " en la bandeja", ruta: "/bandeja" }]
      : []),
  ].slice(0, 3);

  async function marcarFavorita(id: string, favorita: boolean) {
    setFavoritas(await cambiarTarjetaFavorita(id, favorita));
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
            paddingHorizontal: spacing(5),
            paddingTop: spacing(3),
            paddingBottom: spacing(8),
            gap: spacing(3.5),
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
            <Text style={styles.eyebrow}>{etiquetaMes(mes)} {mes.slice(0, 4)}</Text>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Resumen
            </Text>
            <Text style={styles.introTexto}>
              Tu mes de un vistazo.
            </Text>
          </BlurFade>

          <SelectorChips
            titulo=""
            suave
            valor={parte}
            onCambiar={(v) => setParte(v as Parte)}
            opciones={PARTES}
          />

          {parte === "general" && <>
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

          <BlurFade style={styles.hero}>
            <Text style={styles.heroEtiqueta}>Efectivo neto del mes</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={styles.heroValor}
            >
              {efectivo.efectivoNeto > 0 ? "+" : efectivo.efectivoNeto < 0 ? "−" : ""}$
              {Math.abs(efectivo.efectivoNeto).toFixed(2)}
            </Text>
            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Ionicons
                  name="arrow-up"
                  size={16}
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
                    ${efectivo.totalIngresos.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.heroStat}>
                <Ionicons
                  name="arrow-down"
                  size={16}
                  color={color.danger}
                />
                <View>
                  <Text style={styles.heroStatEtiqueta}>Salió de tu dinero</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={styles.heroStatValor}
                  >
                    ${salioDeTuDinero.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
            {(efectivo.conTarjeta > 0 || efectivo.pagosTarjeta > 0) && (
              <Text style={styles.heroNota}>
                {efectivo.conTarjeta > 0
                  ? `Con tarjeta de crédito: $${efectivo.conTarjeta.toFixed(2)}. No baja tu efectivo hasta que pagues la tarjeta.`
                  : ""}
                {efectivo.conTarjeta > 0 && efectivo.pagosTarjeta > 0 ? " " : ""}
                {efectivo.pagosTarjeta > 0
                  ? `Incluye $${efectivo.pagosTarjeta.toFixed(2)} que pagaste a tus tarjetas.`
                  : ""}
              </Text>
            )}
          </BlurFade>

          {porRevisar.length > 0 && (
            <View style={{ gap: spacing(2) }}>
              {porRevisar.map((aviso) => (
                <Pressable
                  key={aviso.clave}
                  accessibilityRole="button"
                  onPress={() => router.push(aviso.ruta)}
                  style={({ pressed }) => [
                    styles.aviso,
                    {
                      backgroundColor:
                        aviso.tono === "malo" ? color.dangerBg : aviso.tono === "aviso" ? color.warningBg : color.surface,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={aviso.icono}
                    size={18}
                    color={aviso.tono === "malo" ? color.danger : aviso.tono === "aviso" ? color.warning : color.textMuted}
                  />
                  <Text style={styles.avisoTexto}>{aviso.texto}</Text>
                  <Ionicons name="chevron-forward" size={16} color={color.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.acciones}>
            {(
              [
                { etiqueta: "Gasto", icono: "remove", ruta: "/gasto/nuevo", ayuda: "Registrar gasto" },
                { etiqueta: "Ingreso", icono: "add", ruta: "/ingreso/nuevo", ayuda: "Registrar ingreso" },
                { etiqueta: "Subir PDF", icono: "document-attach-outline", ruta: "/importar-estado", ayuda: "Subir estado de cuenta o comprobante en PDF" },
                { etiqueta: "Presupuesto", icono: "pie-chart-outline", ruta: "/presupuestos", ayuda: "Presupuestos" },
              ] as const
            ).map((a) => (
              <Pressable
                key={a.etiqueta}
                accessibilityRole="button"
                accessibilityLabel={a.ayuda}
                onPress={() => router.push(a.ruta)}
                style={({ pressed }) => [styles.accion, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.accionIcono}>
                  <Ionicons name={a.icono} size={20} color={color.text} />
                </View>
                <Text style={styles.accionTexto}>{a.etiqueta}</Text>
              </Pressable>
            ))}
          </View>

          {veredicto.estado !== "bien" && (gastos.length > 0 || ingresos.length > 0 || deudas.length > 0) && (
            <View style={[styles.alerta, { backgroundColor: veredicto.estado === "riesgo" ? color.dangerBg : color.warningBg }]}>
              <Ionicons name="alert-circle-outline" size={19} color={veredicto.estado === "riesgo" ? color.danger : color.warning} />
              <Text style={[styles.alertaTexto, { color: color.text }]}>{veredicto.titulo}</Text>
            </View>
          )}

          <View style={styles.sectionHeading}>
            <Text style={styles.tituloCard}>Actividad reciente</Text>
            {actividad.length > 2 && (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: verTodaActividad }} onPress={() => setVerTodaActividad((actual) => !actual)} style={styles.sectionLink}>
                <Text style={styles.sectionLinkText}>{verTodaActividad ? "Ver menos" : "Ver más"}</Text>
              </Pressable>
            )}
          </View>
          <Tarjeta style={styles.activityCard}>
            {actividad.length === 0 ? (
              <EstadoVacio
                icono="home-outline"
                titulo="Sin movimientos todavía"
                subtitulo="Tus últimos gastos e ingresos aparecerán aquí."
              />
            ) : (
              <View style={styles.activityList}>
                {(verTodaActividad ? actividad : actividad.slice(0, 2)).map((item, index) => (
                  <View key={`${item.tipo}-${item.id}`} style={index > 0 && styles.activityDivider}>
                    <ItemMovimiento item={item} calm />
                  </View>
                ))}
              </View>
            )}
          </Tarjeta>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: verAnalisis }}
            onPress={() => setVerAnalisis((actual) => !actual)}
            style={({ pressed }) => [styles.analysisToggle, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.analysisTitle}>Explora tu análisis</Text>
              <Text style={styles.analysisSubtitle}>Semana, salud financiera y lugares</Text>
            </View>
            <Ionicons name={verAnalisis ? "chevron-up" : "chevron-forward"} size={20} color={color.textMuted} />
          </Pressable>

          {verAnalisis && <View style={styles.analysisContent}>

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

          </View>}
          </>}

          {parte === "tarjetas" && (
            <>
              <View style={styles.sectionHeading}>
                <Text style={styles.tituloCard}>Tus tarjetas favoritas</Text>
                {tarjetasCredito.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: eligiendoFavoritas }}
                    onPress={() => setEligiendoFavoritas((v) => !v)}
                    style={styles.sectionLink}
                  >
                    <Text style={styles.sectionLinkText}>{eligiendoFavoritas ? "Listo" : "★ Elegir"}</Text>
                  </Pressable>
                )}
              </View>
              {tarjetasCredito.length === 0 ? (
                <Tarjeta>
                  <EstadoVacio
                    icono="card-outline"
                    titulo="Todavía no tienes tarjetas"
                    subtitulo="Agrega tus tarjetas de crédito para ver aquí cuánto gastas con cada una."
                  />
                  <Boton titulo="Agregar tarjeta" onPress={() => router.push("/tarjetas")} />
                </Tarjeta>
              ) : eligiendoFavoritas ? (
                <Tarjeta style={{ gap: spacing(1) }}>
                  <Text style={styles.introTexto}>Marca con estrella las que quieres ver aquí (hasta 4).</Text>
                  {tarjetasCredito.map((t) => {
                    const marcada = favoritas.includes(t.id);
                    return (
                      <Pressable
                        key={t.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: marcada }}
                        // En web `accessibilityState.checked` no llega al DOM; `aria-checked` sí (como en Casilla).
                        aria-checked={marcada}
                        onPress={() => marcarFavorita(t.id, !marcada)}
                        style={({ pressed }) => [styles.filaFavorita, pressed && { opacity: 0.7 }]}
                      >
                        <Ionicons name={marcada ? "star" : "star-outline"} size={20} color={marcada ? color.warning : color.textMuted} />
                        <Text style={styles.avisoTexto}>
                          {t.nombre}
                          {t.identificador ? `  ••${t.identificador}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Tarjeta>
              ) : (
                <>
                  {favoritas.length === 0 && (
                    <Text style={styles.introTexto}>Te muestro las que más usaste este mes. Toca «Elegir» para escoger las tuyas.</Text>
                  )}
                  <View style={styles.rejilla}>
                    {tarjetas.map((t) => (
                      <Pressable
                        key={t.cuenta.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.cuenta.nombre}, gastado este mes ${formatMonto(t.gastadoMes)}${t.sobreendeudada ? ", pasó el cupo" : ""}`}
                        onPress={() => router.push(`/tarjeta/${t.cuenta.id}`)}
                        style={({ pressed }) => [styles.tarjetaMini, t.sobreendeudada && { borderColor: color.danger }, pressed && { opacity: 0.7 }]}
                      >
                        <View style={styles.filaTitulo}>
                          <Text style={styles.tarjetaNombre} numberOfLines={1}>{t.cuenta.nombre}</Text>
                          {t.cuenta.identificador ? <Text style={styles.etiquetaMuted}>••{t.cuenta.identificador}</Text> : null}
                        </View>
                        <Text style={styles.heroStatEtiqueta}>Gastado este mes</Text>
                        <Text style={styles.tarjetaMonto}>{formatMonto(t.gastadoMes)}</Text>
                        {t.usado !== undefined && <BarraProgreso porcentaje={t.usado} />}
                        <Text style={[styles.etiquetaMuted, t.sobreendeudada && { color: color.danger }]}>
                          {t.sobreendeudada
                            ? `⚠ Pasó el cupo${t.cuenta.cupoTotal ? ` de ${formatMonto(t.cuenta.cupoTotal)}` : ""}`
                            : `Te quedan ${formatMonto(t.cuenta.disponible)} de cupo`}
                        </Text>
                        {t.pago || t.corte ? (
                          <Text style={styles.etiquetaMuted}>{t.pago ? `Pagar hasta el ${diaMes(t.pago)}` : `Corta el ${diaMes(t.corte!)}`}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {parte === "presupuesto" && (
            <>
              <View style={styles.sectionHeading}>
                <Text style={styles.tituloCard}>Presupuesto del mes</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push("/presupuestos")} style={styles.sectionLink}>
                  <Text style={styles.sectionLinkText}>{estadosPresupuesto.length ? "Ver todos" : "Crear"}</Text>
                </Pressable>
              </View>
              <Tarjeta style={{ gap: spacing(3) }}>
                {estadosPresupuesto.length === 0 ? (
                  <EstadoVacio
                    icono="pie-chart-outline"
                    titulo="Sin presupuestos este mes"
                    subtitulo="Ponle un límite a lo que más gastas (comida, transporte…) y aquí verás cómo vas."
                  />
                ) : (
                  <>
                    <View style={styles.filaTitulo}>
                      <Text style={styles.tarjetaNombre}>Total</Text>
                      <Text style={styles.etiquetaMuted}>
                        {formatMonto(totalPresupuesto.gastado)} de {formatMonto(totalPresupuesto.limite)} · {totalPresupuesto.porcentaje} %
                      </Text>
                    </View>
                    <BarraProgreso porcentaje={totalPresupuesto.porcentaje} />
                    {estadosPresupuesto.slice(0, 4).map((e) => (
                      <View key={e.presupuesto.id} style={{ gap: spacing(1.5) }}>
                        <View style={styles.filaTitulo}>
                          <Text style={styles.avisoTexto}>{e.categoriaNombre}</Text>
                          <Text style={[styles.etiquetaMuted, e.nivel === "excedido" && { color: color.danger }]}>
                            {Math.round(e.porcentaje)} % ·{" "}
                            {e.restante >= 0 ? `quedan ${formatMonto(e.restante)}` : `te pasaste ${formatMonto(-e.restante)}`}
                          </Text>
                        </View>
                        <BarraProgreso porcentaje={e.porcentaje} />
                      </View>
                    ))}
                  </>
                )}
              </Tarjeta>

              <Text style={[styles.tituloCard, { marginTop: spacing(3) }]}>Ingresos y gastos</Text>
              <Tarjeta>
                <TablaResumen
                  etiqueta={`Ingresos y gastos de ${etiquetaMes(mes)} y ${etiquetaMes(comparacion.mesAnterior)}`}
                  columnas={["", etiquetaMes(mes).slice(0, 3), etiquetaMes(comparacion.mesAnterior).slice(0, 3), "Cambio"]}
                  filas={comparacion.filas.map((f) => ({
                    clave: f.concepto,
                    celdas: [
                      { texto: f.concepto, fuerte: f.concepto === "Balance" },
                      { texto: cifra(f.actual), fuerte: f.concepto === "Balance", tono: f.concepto === "Balance" && f.actual < 0 ? "malo" : undefined },
                      cifra(f.anterior),
                      { texto: cambioTexto(f.cambio), tono: f.mejora === undefined ? undefined : f.mejora ? "bueno" : "malo" },
                    ],
                  }))}
                />
              </Tarjeta>
            </>
          )}

          {parte === "ahorro" && (
            <>
              <Text style={[styles.tituloCard, { marginTop: spacing(3) }]}>Ahorro y diferidos</Text>
              <Tarjeta style={{ gap: spacing(4) }}>
                <TablaResumen
                  etiqueta="Ahorro"
                  columnas={["Ahorro", "Saldo"]}
                  anchos={[2, 1.2]}
                  filas={[
                    ...ahorro.cuentas.map((a) => ({
                      clave: a.cuenta.id,
                      celdas: [`${a.cuenta.nombre}${a.cuenta.identificador ? ` ••${a.cuenta.identificador}` : ""}`, cifra(a.saldo)],
                    })),
                    ...(ahorro.cuentas.length > 1
                      ? [{ clave: "total", celdas: [{ texto: "Total ahorrado", fuerte: true }, { texto: cifra(ahorro.totalAhorrado), fuerte: true }] }]
                      : []),
                    {
                      clave: "quedo",
                      celdas: [
                        "Te quedó este mes",
                        { texto: cifra(ahorro.teQuedo), tono: ahorro.teQuedo < 0 ? ("malo" as const) : ahorro.teQuedo > 0 ? ("bueno" as const) : undefined },
                      ],
                    },
                    { clave: "tasa", celdas: [{ texto: "Tasa de ahorro", fuerte: true }, { texto: ahorro.tasa === undefined ? "—" : `${ahorro.tasa} %`, fuerte: true }] },
                  ]}
                />
                {ahorro.cuentas.length === 0 && (
                  <Text style={styles.etiquetaMuted}>Agrega una cuenta de ahorro en Más → Cuentas para ver aquí su saldo.</Text>
                )}
                {diferidos.filas.length === 0 ? (
                  <Text style={styles.introTexto}>No tienes compras diferidas pendientes.</Text>
                ) : (
                  <TablaResumen
                    etiqueta="Diferidos"
                    columnas={["Diferidos", "Cuota", "Faltan"]}
                    filas={[
                      ...diferidos.filas.map((f) => ({
                        clave: f.deuda.id,
                        celdas: [
                          `${f.deuda.nombre}${f.tarjeta ? ` · ${f.tarjeta}` : ""}`,
                          cifra(f.cuota),
                          `${f.cuotasRestantes} de ${f.cuotasTotales}`,
                        ],
                      })),
                      { clave: "total", celdas: [{ texto: "Cuotas de este mes", fuerte: true }, { texto: cifra(diferidos.cuotasDelMes), fuerte: true }, ""] },
                    ]}
                  />
                )}
              </Tarjeta>
            </>
          )}
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

type CeldaTabla = { texto: string; tono?: "bueno" | "malo"; fuerte?: boolean };
type FilaTabla = { clave: string; celdas: (CeldaTabla | string)[] };

/** Tabla local para mantener todo el cambio dentro de la pantalla Resumen. */
function TablaResumen({
  columnas,
  filas,
  anchos,
  etiqueta,
}: {
  columnas: string[];
  filas: FilaTabla[];
  anchos?: number[];
  etiqueta: string;
}) {
  const { color } = useTheme();
  const styles = crearEstilosTabla(color);
  const flex = anchos ?? columnas.map((_, i) => (i === 0 ? 2 : 1.2));
  const celda = (valor: CeldaTabla | string): CeldaTabla =>
    typeof valor === "string" ? { texto: valor } : valor;

  return (
    <View accessibilityLabel={etiqueta}>
      <View style={[styles.fila, styles.encabezado]}>
        {columnas.map((titulo, i) => (
          <Text key={i} style={[styles.titulo, { flex: flex[i] }, i > 0 && styles.derecha]} numberOfLines={1}>
            {titulo}
          </Text>
        ))}
      </View>
      {filas.map((fila, indice) => (
        <View
          key={fila.clave}
          accessible
          accessibilityLabel={fila.celdas
            .map((valor, i) => {
              const prefijo = i > 0 && columnas[i] ? columnas[i] + ": " : "";
              return prefijo + celda(valor).texto;
            })
            .filter((texto) => texto.trim())
            .join(", ")}
          style={[styles.fila, indice < filas.length - 1 && styles.divisor]}
        >
          {fila.celdas.map((valor, i) => {
            const { texto, tono, fuerte } = celda(valor);
            return (
              <Text
                key={i}
                numberOfLines={1}
                style={[
                  i === 0 ? styles.nombre : styles.cifra,
                  { flex: flex[i] },
                  i > 0 && styles.derecha,
                  fuerte && styles.fuerte,
                  tono === "bueno" && { color: color.success },
                  tono === "malo" && { color: color.danger },
                ]}
              >
                {texto}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const crearEstilosTabla = (color: Colors) =>
  StyleSheet.create({
    fila: { flexDirection: "row", alignItems: "center", gap: spacing(2), paddingVertical: spacing(2.5) },
    encabezado: { paddingVertical: spacing(1.5), borderBottomWidth: 1, borderBottomColor: color.border },
    divisor: { borderBottomWidth: 1, borderBottomColor: color.border },
    titulo: { fontFamily: font.body, fontSize: 12, color: color.textMuted },
    nombre: { fontFamily: font.body, fontSize: 14, color: color.text },
    cifra: { fontFamily: font.mono, fontSize: 13, color: color.text },
    derecha: { textAlign: "right" },
    fuerte: { fontFamily: font.semibold },
  });

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    brandLockup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
      marginBottom: spacing(2),
    },
    brandIcon: { width: 27, height: 27, borderRadius: 8 },
    brandName: { fontFamily: font.semibold, fontSize: 18, color: color.text },
    intro: { gap: spacing(1.5), marginBottom: spacing(2) },
    eyebrow: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: color.textMuted },
    screenTitle: {
      fontFamily: font.semibold,
      fontSize: 32,
      lineHeight: 38,
      color: color.text,
    },
    introTexto: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    hero: {
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 24,
      padding: spacing(6),
      gap: spacing(2),
    },
    heroEtiqueta: {
      fontFamily: font.medium,
      color: color.textMuted,
      fontSize: 13,
    },
    heroValor: { fontFamily: font.semibold, color: color.text, fontSize: 37, letterSpacing: -1.5 },
    heroDivider: { height: 1, backgroundColor: color.border, marginTop: spacing(3), marginBottom: spacing(1) },
    heroStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
    },
    heroStat: {
      flexDirection: "row",
      flex: 1,
      minWidth: 115,
      alignItems: "flex-start",
      gap: spacing(1.5),
    },
    heroStatEtiqueta: {
      fontFamily: font.body,
      color: color.textMuted,
      fontSize: 12,
    },
    heroStatValor: { fontFamily: font.mono, color: color.text, fontSize: 16, marginTop: spacing(1) },
    heroNota: {
      fontFamily: font.body,
      color: color.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: spacing(3),
    },
    mainAction: { minHeight: 50, borderRadius: 15 },
    alerta: { flexDirection: "row", alignItems: "center", gap: spacing(2), borderRadius: radius.sm, padding: spacing(3) },
    alertaTexto: { fontFamily: font.medium, fontSize: 13, flex: 1 },
    sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing(3) },
    sectionLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing(2) },
    sectionLinkText: { fontFamily: font.semibold, fontSize: 12, color: color.textMuted },
    activityCard: { padding: 0, paddingVertical: spacing(1), borderRadius: 21 },
    activityList: { paddingHorizontal: spacing(4) },
    activityDivider: { borderTopWidth: 1, borderTopColor: color.border },
    analysisToggle: { flexDirection: "row", alignItems: "center", gap: spacing(3), padding: spacing(4), marginTop: spacing(3), backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 18, minHeight: 68 },
    analysisTitle: { fontFamily: font.semibold, fontSize: 14, color: color.text },
    analysisSubtitle: { fontFamily: font.body, fontSize: 12, color: color.textMuted, marginTop: 3 },
    analysisContent: { gap: spacing(4) },
    filaTitulo: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    tituloCard: { fontFamily: font.semibold, fontSize: 18, color: color.text },
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
    aviso: { flexDirection: "row", alignItems: "center", gap: spacing(2), borderRadius: radius.sm, paddingVertical: spacing(3), paddingHorizontal: spacing(3), borderWidth: 1, borderColor: color.border },
    avisoTexto: { flex: 1, fontFamily: font.medium, fontSize: 13, color: color.text },
    acciones: { flexDirection: "row", justifyContent: "space-between", gap: spacing(2) },
    accion: { flex: 1, alignItems: "center", gap: spacing(1.5), minHeight: 44 },
    accionIcono: { width: 48, height: 48, borderRadius: 16, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
    accionTexto: { fontFamily: font.medium, fontSize: 12, color: color.textMuted },
    filaFavorita: { flexDirection: "row", alignItems: "center", gap: spacing(3), minHeight: 44 },
    rejilla: { flexDirection: "row", flexWrap: "wrap", gap: spacing(3) },
    tarjetaMini: { flexGrow: 1, flexBasis: 150, gap: spacing(1.5), padding: spacing(4), backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 18 },
    tarjetaNombre: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: color.text },
    tarjetaMonto: { fontFamily: font.mono, fontSize: 18, color: color.text },
  });
