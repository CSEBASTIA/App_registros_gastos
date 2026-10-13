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
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarRecordatorios,
  listarDeudas,
  crearRecordatorio,
  marcarCompletado,
  eliminarRecordatorio,
  mensajeError,
  type Recordatorio,
  type Deuda,
  type TipoRecordatorio,
  type Frecuencia,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import EstadoVacio from "../components/EstadoVacio";
import { spacing, useTheme, font, type Colors } from "../lib/theme";
import { BlurFade } from "../components/Motion";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const ETIQUETA_TIPO: Record<TipoRecordatorio, string> = {
  pago: "Pago",
  prestamo: "Préstamo",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export default function RecordatoriosScreen() {
  const [cargando, setCargando] = useState(true);
  const { color } = useTheme();
  const styles = createStyles(color);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([listarRecordatorios(), listarDeudas()])
      .then(([r, d]) => {
        setRecordatorios(r);
        setDeudas(d);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  function confirmarEliminar(r: Recordatorio) {
    Alert.alert("Eliminar recordatorio", `¿Eliminar "${r.titulo}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => eliminarRecordatorio(r.id).then(cargar),
      },
    ]);
  }

  async function crearYCerrar(
    input: Omit<Recordatorio, "id" | "createdAt" | "completado">,
  ) {
    await crearRecordatorio(input);
    setMostrarForm(false);
    cargar();
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
            Recordatorios
          </Text>
          <Text style={styles.screenIntro}>
            Tené presentes tus próximos pagos.
          </Text>
        </BlurFade>
        {mostrarForm ? (
          <NuevoRecordatorio
            deudas={deudas}
            onCrear={crearYCerrar}
            onCancelar={() => setMostrarForm(false)}
          />
        ) : (
          <Boton
            titulo="+ Nuevo recordatorio"
            variante="primario"
            onPress={() => setMostrarForm(true)}
          />
        )}

        {error && <ErrorTexto>{error}</ErrorTexto>}

        {recordatorios.length === 0 ? (
          <EstadoVacio
            icono="notifications-outline"
            titulo="Todavía no hay recordatorios"
            subtitulo="Creá uno arriba para no olvidarte de un pago."
          />
        ) : (
          <View style={{ gap: spacing(2.5) }}>
            {recordatorios.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="checkbox"
                accessibilityLabel={r.titulo + ", " + r.fecha}
                accessibilityState={{ checked: r.completado }}
                android_ripple={{ color: color.primaryBg }}
                onPress={() =>
                  marcarCompletado(r.id, !r.completado).then(cargar)
                }
                onLongPress={() => confirmarEliminar(r)}
                style={({ pressed }) => [
                  styles.fila,
                  pressed && { backgroundColor: color.primaryBg },
                ]}
              >
                <Ionicons
                  name={r.completado ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={r.completado ? color.success : color.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.filaTitulo,
                      r.completado && styles.filaTituloCompletado,
                    ]}
                  >
                    {r.titulo}
                  </Text>
                  <Text style={styles.filaMeta}>
                    {ETIQUETA_TIPO[r.tipo]} · {r.fecha}
                    {r.monto ? ` · $${r.monto.toFixed(2)}` : ""}
                    {r.recurrente ? ` · se repite` : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NuevoRecordatorio({
  deudas,
  onCrear,
  onCancelar,
}: {
  deudas: Deuda[];
  onCrear: (
    input: Omit<Recordatorio, "id" | "createdAt" | "completado">,
  ) => Promise<void>;
  onCancelar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoRecordatorio>("pago");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [recurrente, setRecurrente] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("mensual");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!titulo.trim()) {
      setError("Ponele un título al recordatorio.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        titulo,
        tipo,
        monto: monto ? Number(monto) : undefined,
        fecha,
        recurrente,
        frecuencia: recurrente ? frecuencia : undefined,
      });
      setTitulo("");
      setMonto("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <Text style={styles.tituloCard}>Nuevo recordatorio</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} />
      </View>
      <Campo
        etiqueta="Título"
        placeholder="Pagar alquiler"
        value={titulo}
        onChangeText={setTitulo}
      />
      <SelectorChips
        titulo="Tipo"
        valor={tipo}
        onCambiar={(v) => setTipo(v as TipoRecordatorio)}
        opciones={[
          { valor: "pago", etiqueta: "Pago" },
          { valor: "prestamo", etiqueta: "Préstamo" },
          { valor: "tarjeta", etiqueta: "Tarjeta" },
          { valor: "otro", etiqueta: "Otro" },
        ]}
      />
      <Campo
        etiqueta="Monto (opcional)"
        keyboardType="decimal-pad"
        value={monto}
        onChangeText={setMonto}
      />
      <Campo
        etiqueta="Fecha (AAAA-MM-DD)"
        value={fecha}
        onChangeText={setFecha}
      />
      <SelectorChips
        titulo="¿Se repite?"
        valor={recurrente ? "si" : "no"}
        onCambiar={(v) => setRecurrente(v === "si")}
        opciones={[
          { valor: "no", etiqueta: "Una vez" },
          { valor: "si", etiqueta: "Recurrente" },
        ]}
      />
      {recurrente && (
        <SelectorChips
          titulo="Frecuencia"
          valor={frecuencia}
          onCambiar={(v) => setFrecuencia(v as Frecuencia)}
          opciones={[
            { valor: "semanal", etiqueta: "Semanal" },
            { valor: "mensual", etiqueta: "Mensual" },
            { valor: "anual", etiqueta: "Anual" },
          ]}
        />
      )}
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton
        titulo={guardando ? "Guardando…" : "Agregar"}
        variante="primario"
        onPress={agregar}
        loading={guardando}
        disabled={guardando}
      />
    </Tarjeta>
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
    fila: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 12,
      padding: spacing(3.5),
    },
    filaTitulo: {
      fontFamily: font.semibold,
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    filaTituloCompletado: {
      textDecorationLine: "line-through",
      color: color.textMuted,
    },
    filaMeta: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.textMuted,
      marginTop: 2,
    },
  });
