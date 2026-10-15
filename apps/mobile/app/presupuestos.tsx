import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  estadoPresupuestos,
  eliminarPresupuesto,
  formatMonto,
  guardarPresupuesto,
  listarCategorias,
  listarGastos,
  listarPresupuestos,
  mesLocal,
  mensajeError,
  parsearMonto,
  type Categoria,
  type EstadoPresupuesto,
  type Gasto,
  type Presupuesto,
  type PresupuestoInput,
} from "core";
import Boton from "../components/Boton";
import Campo from "../components/Campo";
import ErrorTexto from "../components/ErrorTexto";
import EstadoVacio from "../components/EstadoVacio";
import SelectorChips from "../components/SelectorChips";
import SelectorMes from "../components/SelectorMes";
import Tarjeta from "../components/Tarjeta";
import { BlurFade } from "../components/Motion";
import { supabase } from "../lib/supabase";
import { font, radius, spacing, useTheme, type Colors } from "../lib/theme";

export default function PresupuestosScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [mes, setMes] = useState(mesLocal());
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tieneSesion, setTieneSesion] = useState<boolean | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [presupuestoEditando, setPresupuestoEditando] = useState<Presupuesto | null>(null);
  const [actualizacion, setActualizacion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let activa = true;
      async function cargar() {
        setCargando(true);
        setError(null);
        try {
          const { data } = await supabase.auth.getSession();
          if (!activa) return;
          if (!data.session) {
            setTieneSesion(false);
            setPresupuestos([]);
            setGastos([]);
            setCategorias([]);
            return;
          }
          setTieneSesion(true);
          const [p, g, c] = await Promise.all([
            listarPresupuestos(mes),
            listarGastos(),
            listarCategorias(),
          ]);
          if (!activa) return;
          setPresupuestos(p);
          setGastos(g);
          setCategorias(c);
        } catch (err) {
          if (activa) setError(mensajeError(err));
        } finally {
          if (activa) setCargando(false);
        }
      }
      void cargar();
      return () => {
        activa = false;
      };
    }, [mes, actualizacion]),
  );

  const estados = estadoPresupuestos(
    mes,
    presupuestos,
    gastos,
    categorias,
  );
  const categoriasGasto = categorias.filter((categoria) => categoria.tipo === "gasto");
  const categoriasDisponibles = categoriasGasto.filter(
    (categoria) => !presupuestos.some((presupuesto) => presupuesto.categoriaId === categoria.id),
  );
  const limiteTotal = estados.reduce((total, estado) => total + estado.presupuesto.montoLimite, 0);
  const gastadoTotal = estados.reduce((total, estado) => total + estado.gastado, 0);
  const porcentajeTotal = limiteTotal > 0 ? (gastadoTotal / limiteTotal) * 100 : 0;
  const restanteTotal = limiteTotal - gastadoTotal;

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setPresupuestoEditando(null);
  }

  async function guardar(input: PresupuestoInput) {
    await guardarPresupuesto(input);
    cerrarFormulario();
    setActualizacion((valor) => valor + 1);
  }

  function confirmarEliminar(estado: EstadoPresupuesto) {
    Alert.alert(
      "Eliminar presupuesto",
      `¿Eliminar el límite de ${estado.categoriaNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminarPresupuesto(estado.presupuesto.id);
              setActualizacion((valor) => valor + 1);
            } catch (err) {
              setError(mensajeError(err));
            }
          },
        },
      ],
    );
  }

  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <Stack.Screen options={{ title: "Presupuestos" }} />
        <View style={styles.cargando} accessibilityLiveRegion="polite">
          <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
          <Text style={styles.screenIntro}>Cargando tus presupuestos…</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Presupuestos" }} />
      <KeyboardAvoidingView
        style={styles.contenedor}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.contenedor}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.contenido}
        >
          <BlurFade style={{ gap: spacing(2) }}>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Presupuestos
            </Text>
            <Text style={styles.screenIntro}>
              Mirá cuánto llevás usado en cada categoría.
            </Text>
          </BlurFade>

          <View style={styles.encabezado}>
            <SelectorMes
              mes={mes}
              onCambiar={(nuevoMes) => {
                cerrarFormulario();
                setMes(nuevoMes);
              }}
            />
            {tieneSesion && !mostrarFormulario && categoriasDisponibles.length > 0 && (
              <Boton
                titulo="+ Nuevo"
                variante="primario"
                onPress={() => setMostrarFormulario(true)}
              />
            )}
          </View>

          {error && <ErrorTexto>{error}</ErrorTexto>}

          {tieneSesion === false ? (
            <EstadoVacio
              icono="lock-closed-outline"
              titulo="Iniciá sesión para ver tus presupuestos"
              subtitulo="Tus límites y gastos se guardan en tu cuenta."
            />
          ) : (
            <>
              {mostrarFormulario && (
                <FormularioPresupuesto
                  key={presupuestoEditando?.id ?? "nuevo"}
                  mes={mes}
                  categorias={presupuestoEditando ? categoriasGasto : categoriasDisponibles}
                  presupuesto={presupuestoEditando}
                  onGuardar={guardar}
                  onCancelar={cerrarFormulario}
                />
              )}

              {estados.length > 0 && (
                <Tarjeta style={styles.resumenCard}>
                  <View style={styles.resumenEncabezado}>
                    <View style={{ flex: 1, gap: spacing(1) }}>
                      <Text style={styles.etiqueta}>USO TOTAL</Text>
                      <Text style={styles.resumenMonto}>
                        {formatMonto(gastadoTotal)}
                        <Text style={styles.resumenDe}> de {formatMonto(limiteTotal)}</Text>
                      </Text>
                    </View>
                    <Text style={[styles.porcentaje, { color: tonoEstado(porcentajeTotal, color) }]}>
                      {Math.round(porcentajeTotal)}%
                    </Text>
                  </View>
                  <BarraPresupuesto porcentaje={porcentajeTotal} label="Uso total del presupuesto" />
                  <Text style={styles.restante}>
                    {restanteTotal >= 0
                      ? `${formatMonto(restanteTotal)} disponibles en tus límites`
                      : `${formatMonto(Math.abs(restanteTotal))} por encima de tus límites`}
                  </Text>
                </Tarjeta>
              )}

              {estados.length === 0 ? (
                <>
                  <EstadoVacio
                    icono="pie-chart-outline"
                    titulo="Todavía no hay presupuestos"
                    subtitulo="Definí un límite por categoría y seguí tu avance con la barra."
                  />
                  {categoriasGasto.length === 0 ? (
                    <Text style={styles.aviso}>Primero necesitás una categoría de gasto.</Text>
                  ) : categoriasDisponibles.length === 0 ? (
                    <Text style={styles.aviso}>Ya definiste un límite para cada categoría de gasto.</Text>
                  ) : (
                    !mostrarFormulario && (
                      <Boton
                        titulo="Crear primer presupuesto"
                        variante="primario"
                        onPress={() => setMostrarFormulario(true)}
                      />
                    )
                  )}
                </>
              ) : (
                <View style={{ gap: spacing(3) }}>
                  <Text style={styles.seccionTitulo}>Por categoría</Text>
                  {estados.map((estado, indice) => (
                    <FilaPresupuesto
                      key={estado.presupuesto.id}
                      estado={estado}
                      colorCategoria={
                        categorias.find((categoria) => categoria.id === estado.presupuesto.categoriaId)?.color ?? color.primary
                      }
                      delay={indice * 45}
                      onEditar={() => {
                        setPresupuestoEditando(estado.presupuesto);
                        setMostrarFormulario(true);
                      }}
                      onEliminar={() => confirmarEliminar(estado)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function FilaPresupuesto({
  estado,
  colorCategoria,
  delay,
  onEditar,
  onEliminar,
}: {
  estado: EstadoPresupuesto;
  colorCategoria: string;
  delay: number;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const porcentaje = Math.round(estado.porcentaje);
  const excedido = estado.restante < 0;

  return (
    <BlurFade delay={delay} style={styles.filaCard}>
      <View style={styles.filaEncabezado}>
        <View style={styles.nombreCategoria}>
          <View style={[styles.punto, { backgroundColor: colorCategoria }]} />
          <Text numberOfLines={1} style={styles.categoriaNombre}>
            {estado.categoriaNombre}
          </Text>
        </View>
        <View style={styles.acciones}>
          <Text style={[styles.porcentajeFila, { color: tonoEstado(estado.porcentaje, color) }]}>
            {porcentaje}%
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar presupuesto de ${estado.categoriaNombre}`}
            hitSlop={8}
            onPress={onEditar}
            style={styles.iconAction}
          >
            <Ionicons name="pencil-outline" size={17} color={color.textMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Eliminar presupuesto de ${estado.categoriaNombre}`}
            hitSlop={8}
            onPress={onEliminar}
            style={styles.iconAction}
          >
            <Ionicons name="trash-outline" size={17} color={color.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.montos}>
        <Text style={styles.montoUsado}>{formatMonto(estado.gastado)}</Text>
        <Text style={styles.montoLimite}>de {formatMonto(estado.presupuesto.montoLimite)}</Text>
      </View>
      <BarraPresupuesto
        porcentaje={estado.porcentaje}
        label={`${estado.categoriaNombre}: ${porcentaje}% usado`}
      />
      <Text style={[styles.restante, excedido && { color: color.danger }]}>
        {excedido
          ? `Superaste el límite por ${formatMonto(Math.abs(estado.restante))}`
          : `Te quedan ${formatMonto(estado.restante)}`}
      </Text>
    </BlurFade>
  );
}

function FormularioPresupuesto({
  mes,
  categorias,
  presupuesto,
  onGuardar,
  onCancelar,
}: {
  mes: string;
  categorias: Categoria[];
  presupuesto: Presupuesto | null;
  onGuardar: (input: PresupuestoInput) => Promise<void>;
  onCancelar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [categoriaId, setCategoriaId] = useState(
    presupuesto?.categoriaId ?? categorias[0]?.id ?? "",
  );
  const [monto, setMonto] = useState(
    presupuesto ? String(presupuesto.montoLimite) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar() {
    const montoLimite = parsearMonto(monto);
    if (!categoriaId) {
      setError("Elegí una categoría de gasto.");
      return;
    }
    if (!Number.isFinite(montoLimite) || montoLimite <= 0) {
      setError("Ingresá un límite mayor que cero.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onGuardar({ categoriaId, montoLimite, mes });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.formHeader}>
        <Text style={styles.formTitulo}>
          {presupuesto ? "Ajustar límite" : "Nuevo presupuesto"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar formulario"
          hitSlop={8}
          onPress={onCancelar}
          style={styles.iconAction}
        >
          <Ionicons name="close" size={20} color={color.textMuted} />
        </Pressable>
      </View>

      {presupuesto ? (
        <View style={styles.categoriaFija}>
          <Text style={styles.etiqueta}>Categoría</Text>
          <Text style={styles.categoriaNombre}>
            {categorias.find((categoria) => categoria.id === presupuesto.categoriaId)?.nombre ?? "Sin categoría"}
          </Text>
        </View>
      ) : (
        <SelectorChips
          titulo="Categoría"
          valor={categoriaId}
          onCambiar={setCategoriaId}
          opciones={categorias.map((categoria) => ({
            valor: categoria.id,
            etiqueta: categoria.nombre,
            color: categoria.color,
          }))}
        />
      )}

      <Campo
        etiqueta="Límite mensual"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={monto}
        onChangeText={setMonto}
      />
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <View style={styles.formAcciones}>
        <Boton titulo="Cancelar" onPress={onCancelar} style={{ flex: 1 }} />
        <Boton
          titulo={guardando ? "Guardando…" : "Guardar límite"}
          variante="primario"
          onPress={enviar}
          loading={guardando}
          disabled={guardando}
          style={{ flex: 1 }}
        />
      </View>
    </Tarjeta>
  );
}

function BarraPresupuesto({ porcentaje, label }: { porcentaje: number; label: string }) {
  const { color, reduceMotion } = useTheme();
  const valor = Math.min(100, Math.max(0, porcentaje));
  const progreso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progreso.setValue(valor);
      return;
    }
    const animacion = Animated.timing(progreso, {
      toValue: valor,
      duration: 560,
      useNativeDriver: false,
    });
    animacion.start();
    return () => animacion.stop();
  }, [porcentaje, progreso, reduceMotion, valor]);

  const relleno = progreso.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  const redondeado = Math.round(porcentaje);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(100, redondeado), text: `${redondeado}%` }}
      style={{ gap: spacing(1.5) }}
    >
      <View style={[stylesBarra.pista, { backgroundColor: color.border }]}>
        <Animated.View
          style={[
            stylesBarra.relleno,
            { width: relleno, backgroundColor: tonoEstado(porcentaje, color) },
          ]}
        />
      </View>
    </View>
  );
}

function tonoEstado(porcentaje: number, color: Colors) {
  if (porcentaje >= 100) return color.danger;
  if (porcentaje >= 80) return color.warning;
  return color.primary;
}

const stylesBarra = StyleSheet.create({
  pista: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  relleno: { height: "100%", borderRadius: radius.pill },
});

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    contenido: {
      padding: spacing(5),
      paddingBottom: spacing(10),
      gap: spacing(4),
    },
    cargando: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing(6),
      gap: spacing(3),
    },
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
    encabezado: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing(2),
    },
    resumenCard: { gap: spacing(3) },
    resumenEncabezado: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
    },
    etiqueta: {
      fontFamily: font.semibold,
      fontSize: 11,
      letterSpacing: 0.7,
      color: color.textMuted,
    },
    resumenMonto: {
      fontFamily: font.mono,
      fontSize: 19,
      color: color.text,
    },
    resumenDe: {
      fontFamily: font.body,
      fontSize: 14,
      color: color.textMuted,
    },
    porcentaje: {
      fontFamily: font.mono,
      fontSize: 24,
      color: color.text,
    },
    restante: {
      fontFamily: font.body,
      fontSize: 12,
      lineHeight: 17,
      color: color.textMuted,
    },
    seccionTitulo: {
      fontFamily: font.display,
      fontSize: 19,
      color: color.text,
    },
    filaCard: {
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      padding: spacing(4),
      gap: spacing(3),
    },
    filaEncabezado: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(2),
    },
    nombreCategoria: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
    },
    punto: { width: 9, height: 9, borderRadius: radius.pill },
    categoriaNombre: {
      flexShrink: 1,
      fontFamily: font.semibold,
      fontSize: 15,
      color: color.text,
    },
    acciones: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1),
    },
    porcentajeFila: {
      fontFamily: font.mono,
      fontSize: 14,
      marginRight: spacing(1),
    },
    iconAction: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
      backgroundColor: color.surface2,
    },
    montos: { flexDirection: "row", alignItems: "baseline", gap: spacing(1.5) },
    montoUsado: {
      fontFamily: font.mono,
      fontSize: 17,
      color: color.text,
    },
    montoLimite: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.textMuted,
    },
    aviso: {
      fontFamily: font.body,
      fontSize: 13,
      textAlign: "center",
      color: color.textMuted,
    },
    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    formTitulo: {
      fontFamily: font.display,
      fontSize: 19,
      color: color.text,
    },
    categoriaFija: { gap: spacing(1.5) },
    formAcciones: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(2),
    },
  });
