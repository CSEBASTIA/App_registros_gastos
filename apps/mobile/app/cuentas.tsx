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
  parsearMonto,
  OPCIONES_BANCO,
  COLOR_CUENTA_BANCO,
  ETIQUETA_BANCO,
  type Cuenta,
  type Banco,
  type TipoCuenta,
} from "core";
import Tarjeta from "../components/Tarjeta";
import TarjetaVisual from "../components/TarjetaVisual";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import EstadoVacio from "../components/EstadoVacio";
import { spacing, useTheme, font, type Colors } from "../lib/theme";
import { BlurFade } from "../components/Motion";

const OPCIONES_TIPO: { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: "ahorro", etiqueta: "Cuenta de ahorros" },
  { valor: "debito", etiqueta: "Tarjeta de débito" },
  { valor: "efectivo", etiqueta: "Efectivo" },
];

export default function CuentasScreen() {
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    listarCuentas()
      .then((todas) => setCuentas(todas.filter((c) => c.tipo !== "credito")))
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">, importar: boolean) {
    const nueva = await crearCuenta(input);
    setMostrarForm(false);
    // Al volver de importar, la lista se recarga sola (useFocusEffect).
    if (importar) router.push({ pathname: "/importar-estado", params: { cuentaId: nueva.id } });
    else cargar();
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
            Cuentas
          </Text>
          <Text style={styles.screenIntro}>
            Ahorros, débito y efectivo en un solo lugar.
          </Text>
        </BlurFade>
        {error && <ErrorTexto>{error}</ErrorTexto>}
        {mostrarForm ? (
          <NuevaCuenta
            onCrear={crearYCerrar}
            onCancelar={() => setMostrarForm(false)}
          />
        ) : (
          <Boton
            titulo="+ Agregar cuenta"
            variante="primario"
            onPress={() => setMostrarForm(true)}
          />
        )}

        {!cargando && cuentas.length === 0 ? (
          <EstadoVacio
            icono="wallet-outline"
            titulo="Todavía no agregaste cuentas"
            subtitulo="Creá una arriba: ahorro, débito o efectivo, del banco que sea."
          />
        ) : (
          <View style={{ gap: spacing(3) }}>
            {cuentas.map((cuenta) => (
              <TarjetaVisual
                key={cuenta.id}
                cuenta={cuenta}
                onPress={() => router.push(`/cuenta/${cuenta.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NuevaCuenta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">, importar: boolean) => Promise<void>;
  onCancelar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("ahorro");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(importar = false) {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la cuenta.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onCrear(
        {
          nombre,
          tipo,
          banco,
          disponible: saldoInicial ? parsearMonto(saldoInicial) : 0,
          identificador: identificador.trim() || undefined,
        },
        importar
      );
      setNombre("");
      setSaldoInicial("");
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
        <Text style={styles.tituloCard}>Nueva cuenta</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} />
      </View>
      <Campo
        etiqueta="Nombre"
        placeholder="Ahorros Pichincha"
        value={nombre}
        onChangeText={setNombre}
      />
      <SelectorChips
        titulo="Tipo"
        valor={tipo}
        onCambiar={(v) => setTipo(v as TipoCuenta)}
        opciones={OPCIONES_TIPO.map((o) => ({
          valor: o.valor,
          etiqueta: o.etiqueta,
        }))}
      />
      <Campo
        etiqueta="Saldo inicial"
        keyboardType="decimal-pad"
        value={saldoInicial}
        onChangeText={setSaldoInicial}
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
          color: COLOR_CUENTA_BANCO[b],
        }))}
      />
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton
        titulo={guardando ? "Guardando…" : "Agregar"}
        variante="primario"
        onPress={() => agregar()}
        loading={guardando}
        disabled={guardando}
      />
      {tipo !== "efectivo" && (
        <Boton
          titulo="Agregar e importar estado de cuenta"
          onPress={() => agregar(true)}
          disabled={guardando}
        />
      )}
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
