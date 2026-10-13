import { SafeAreaView } from "react-native-safe-area-context";
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
import { useFocusEffect, useRouter } from "expo-router";
import {
  listarCuentas,
  crearCuenta,
  mensajeError,
  OPCIONES_BANCO,
  OPCIONES_MARCA,
  ETIQUETA_BANCO,
  ETIQUETA_MARCA,
  GRADIENTE_BANCO,
  type Cuenta,
  type Banco,
  type Marca,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import TarjetaVisual from "../../components/TarjetaVisual";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import EstadoVacio from "../../components/EstadoVacio";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

export default function TarjetasScreen() {
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [tarjetas, setTarjetas] = useState<Cuenta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    listarCuentas()
      .then((todas) => setTarjetas(todas.filter((c) => c.tipo === "credito")))
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">) {
    await crearCuenta(input);
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
              Tarjetas
            </Text>
            <Text style={styles.screenIntro}>
              Tu cupo y tus movimientos, a mano.
            </Text>
          </BlurFade>
          {error && <ErrorTexto>{error}</ErrorTexto>}
          {mostrarForm ? (
            <NuevaTarjeta
              onCrear={crearYCerrar}
              onCancelar={() => setMostrarForm(false)}
            />
          ) : (
            <Boton
              titulo="+ Agregar tarjeta"
              variante="primario"
              onPress={() => setMostrarForm(true)}
            />
          )}

          {!cargando && tarjetas.length === 0 ? (
            <EstadoVacio
              icono="card-outline"
              titulo="Todavía no agregaste tarjetas de crédito"
              subtitulo="Creá una arriba para empezar a controlar su cupo."
            />
          ) : (
            <View style={{ gap: spacing(3) }}>
              {tarjetas.map((t) => (
                <TarjetaVisual
                  key={t.id}
                  cuenta={t}
                  onPress={() => router.push(`/tarjeta/${t.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NuevaTarjeta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [nombre, setNombre] = useState("");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [marca, setMarca] = useState<Marca>("visa");
  const [cupoTotal, setCupoTotal] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la tarjeta.");
      return;
    }
    if (!cupoTotal || Number(cupoTotal) <= 0) {
      setError("Una tarjeta de crédito necesita un cupo total.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        nombre,
        tipo: "credito",
        banco,
        marca,
        cupoTotal: Number(cupoTotal),
        disponible: Number(cupoTotal),
        identificador: identificador.trim() || undefined,
      });
      setNombre("");
      setCupoTotal("");
      setIdentificador("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <Text style={styles.tituloCard}>Nueva tarjeta de crédito</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} />
      </View>
      <Campo
        etiqueta="Nombre"
        placeholder="Visa Clásica"
        value={nombre}
        onChangeText={setNombre}
      />
      <Campo
        etiqueta="Cupo total"
        keyboardType="decimal-pad"
        value={cupoTotal}
        onChangeText={setCupoTotal}
      />
      <Campo
        etiqueta="Últimos dígitos (opcional)"
        placeholder="1234"
        keyboardType="number-pad"
        maxLength={4}
        value={identificador}
        onChangeText={setIdentificador}
      />
      <SelectorChips
        titulo="Banco"
        valor={banco}
        onCambiar={(v) => setBanco(v as Banco)}
        opciones={OPCIONES_BANCO.map((b) => ({
          valor: b,
          etiqueta: ETIQUETA_BANCO[b],
          color: GRADIENTE_BANCO[b][0],
        }))}
      />
      <SelectorChips
        titulo="Marca"
        valor={marca}
        onCambiar={(v) => setMarca(v as Marca)}
        opciones={OPCIONES_MARCA.map((m) => ({
          valor: m,
          etiqueta: ETIQUETA_MARCA[m] || "Otra",
        }))}
      />
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
  });
