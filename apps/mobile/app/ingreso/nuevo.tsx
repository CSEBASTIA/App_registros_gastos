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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  listarCategorias,
  listarCuentas,
  crearIngreso,
  mensajeError,
  parsearMonto,
  fechaLocal,
  fechaLarga,
  fechaPropuesta,
  type Categoria,
  type Cuenta,
} from "core";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";
import { avisar } from "../../lib/dialogo";

// Fecha en la zona horaria del teléfono (toISOString es UTC).
const hoy = () => fechaLocal();

export default function NuevoIngreso() {
  const [cargando, setCargando] = useState(true);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { cuentaId: cuentaIdInicial, mes: mesVisto } = useLocalSearchParams<{
    cuentaId?: string;
    /** El mes que se estaba viendo en Ingresos ("2026-09"). */
    mes?: string;
  }>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  // Si se abrió desde otro mes, la fecha cae en ese mes (no hoy).
  const [fecha, setFecha] = useState(() => fechaPropuesta(mesVisto, hoy()));
  const fechaNoEsHoy = fecha !== hoy();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      setError(null);
      Promise.all([listarCategorias(), listarCuentas()])
        .then(([c, cu]) => {
          setCategorias(c.filter((x) => x.tipo === "ingreso"));
          setCuentas(cu.filter((c) => c.tipo !== "credito"));
          if (cuentaIdInicial) setCuentaId(cuentaIdInicial);
        })
        .catch((err) => setError(mensajeError(err)))
        .finally(() => setCargando(false));
    }, [cuentaIdInicial]),
  );

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";

  async function agregar() {
    setError(null);
    if (!(parsearMonto(monto) > 0)) {
      setError("El monto no puede ser un valor negativo.");
      return;
    }
    setGuardando(true);
    try {
      await crearIngreso({
        monto: parsearMonto(monto),
        descripcion: descripcion || categoriaSeleccionada?.nombre || "Ingreso",
        categoriaId: categoriaId || undefined,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        fecha,
      });
      await avisar("Ingreso guardado", "El ingreso se agregó a tu resumen.", "success");
      router.back();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
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
            Nuevo ingreso
          </Text>
          <Text style={styles.screenIntro}>
            Completá los datos de tu movimiento.
          </Text>
        </BlurFade>
        {fechaNoEsHoy && (
          <View style={styles.ayuda} accessibilityLiveRegion="polite">
            <Text style={styles.ayudaTexto}>
              Se guardará con fecha {fechaLarga(fecha)}, del mes que estabas viendo. Puedes cambiarla abajo.
            </Text>
          </View>
        )}
        <Campo
          etiqueta="Monto"
          keyboardType="decimal-pad"
          value={monto}
          onChangeText={setMonto}
          placeholder="0.00"
        />
        <Campo
          etiqueta="Descripción"
          placeholder="Sueldo, freelance…"
          value={descripcion}
          onChangeText={setDescripcion}
        />

        <SelectorChips
          titulo="Fuente"
          valor={categoriaId}
          onCambiar={setCategoriaId}
          opciones={[
            { valor: "", etiqueta: "Sin especificar" },
            ...categorias.map((c) => ({
              valor: c.id,
              etiqueta: c.nombre,
              color: c.color,
            })),
          ]}
        />
        {esOtros && (
          <Campo
            etiqueta="Detalle"
            value={categoriaDetalle}
            onChangeText={setCategoriaDetalle}
            placeholder="¿De dónde viene?"
          />
        )}

        <SelectorChips
          titulo="Cuenta destino"
          valor={cuentaId}
          onCambiar={setCuentaId}
          opciones={[
            { valor: "", etiqueta: "Sin asignar" },
            ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
          ]}
        />

        <Campo
          etiqueta="Fecha (AAAA-MM-DD)"
          value={fecha}
          onChangeText={setFecha}
          placeholder="2026-08-31"
        />

        {error && <ErrorTexto>{error}</ErrorTexto>}
        <Boton
          titulo={guardando ? "Guardando…" : "Agregar"}
          variante="primario"
          onPress={agregar}
          loading={guardando}
          disabled={guardando}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    ayuda: { backgroundColor: color.surface2, borderRadius: 8, padding: spacing(3) },
    ayudaTexto: { fontFamily: font.body, fontSize: 12, color: color.textMuted, lineHeight: 18 },
  });
