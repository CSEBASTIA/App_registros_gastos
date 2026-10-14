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
  crearGasto,
  mensajeError,
  sumarMeses,
  fechaLocal,
  ETIQUETA_METODO_PAGO,
  OPCIONES_METODO_PAGO,
  OPCIONES_MESES_DIFERIDO,
  type Categoria,
  type Cuenta,
  type MetodoPago,
} from "core";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

// Fecha en la zona horaria del teléfono (toISOString es UTC: de noche en
// Ecuador ya daba el día siguiente).
const hoy = () => fechaLocal();

export default function NuevoGasto() {
  const [cargando, setCargando] = useState(true);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { cuentaId: cuentaIdInicial } = useLocalSearchParams<{
    cuentaId?: string;
  }>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | "">("");
  const [mesesDiferido, setMesesDiferido] = useState(3);
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      setError(null);
      Promise.all([listarCategorias(), listarCuentas()])
        .then(([c, cu]) => {
          setCategorias(c.filter((x) => x.tipo === "gasto"));
          setCuentas(cu);
          if (cuentaIdInicial) setCuentaId(cuentaIdInicial);
        })
        .catch((err) => setError(mensajeError(err)))
        .finally(() => setCargando(false));
    }, [cuentaIdInicial]),
  );

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";
  const esDiferido = metodoPago === "diferido";

  async function agregar() {
    setError(null);
    if (!monto || Number(monto) <= 0) {
      setError("El monto no puede ser un valor negativo.");
      return;
    }
    if (!categoriaId) {
      setError("Elegí una categoría.");
      return;
    }
    if (esOtros && !categoriaDetalle.trim()) {
      setError("Contanos qué fue (categoría Otros).");
      return;
    }
    setGuardando(true);
    try {
      await crearGasto({
        monto: Number(monto),
        descripcion: descripcion || categoriaSeleccionada?.nombre || "Gasto",
        categoriaId,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        metodoPago: metodoPago || undefined,
        mesesDiferido: esDiferido ? mesesDiferido : undefined,
        fecha,
      });
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
            Nuevo gasto
          </Text>
          <Text style={styles.screenIntro}>
            Completá los datos de tu movimiento.
          </Text>
        </BlurFade>
        <Campo
          etiqueta="Monto"
          keyboardType="decimal-pad"
          value={monto}
          onChangeText={setMonto}
          placeholder="0.00"
        />
        <Campo
          etiqueta="Descripción"
          placeholder="Pago de la casa de Calceta"
          value={descripcion}
          onChangeText={setDescripcion}
          maxLength={40}
        />

        <SelectorChips
          titulo="Categoría"
          valor={categoriaId}
          onCambiar={setCategoriaId}
          opciones={categorias.map((c) => ({
            valor: c.id,
            etiqueta: c.nombre,
            color: c.color,
          }))}
        />
        {esOtros && (
          <Campo
            etiqueta="¿Qué fue?"
            value={categoriaDetalle}
            onChangeText={setCategoriaDetalle}
            placeholder="Medicamentos"
          />
        )}

        <SelectorChips
          titulo="Cuenta / tarjeta"
          valor={cuentaId}
          onCambiar={setCuentaId}
          opciones={[
            { valor: "", etiqueta: "Sin asignar" },
            ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
          ]}
        />

        <SelectorChips
          titulo="Método de pago"
          valor={metodoPago}
          onCambiar={(v) => setMetodoPago(v as MetodoPago)}
          opciones={[
            { valor: "", etiqueta: "Sin especificar" },
            ...OPCIONES_METODO_PAGO.map((m) => ({
              valor: m,
              etiqueta: ETIQUETA_METODO_PAGO[m],
            })),
          ]}
        />

        {esDiferido && (
          <>
            <SelectorChips
              titulo="A cuántos meses"
              valor={String(mesesDiferido)}
              onCambiar={(v) => setMesesDiferido(Number(v))}
              opciones={OPCIONES_MESES_DIFERIDO.map((m) => ({
                valor: String(m),
                etiqueta: `${m} meses`,
              }))}
            />
            {monto && Number(monto) > 0 && (
              <View style={styles.ayuda}>
                <Text style={styles.ayudaTexto}>
                  ${(Number(monto) / mesesDiferido).toFixed(2)}/mes · termina el{" "}
                  {sumarMeses(fecha, mesesDiferido)} · esto crea una deuda
                  automáticamente.
                </Text>
              </View>
            )}
          </>
        )}

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
    ayuda: { backgroundColor: color.bg, borderRadius: 8, padding: spacing(3) },
    ayudaTexto: {
      fontFamily: font.body,
      fontSize: 12,
      color: color.textMuted,
      lineHeight: 18,
    },
  });
