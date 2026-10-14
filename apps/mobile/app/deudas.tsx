import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  listarDeudas,
  listarCuentas,
  listarIngresos,
  crearDeuda,
  registrarAbonoDeuda,
  eliminarDeuda,
  calcularEndeudamiento,
  mensajeError,
  fechaLocal,
  mesLocal,
  type Deuda,
  type Cuenta,
  type TipoDeuda,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import BarraProgreso from "../components/BarraProgreso";
import EstadoVacio from "../components/EstadoVacio";
import { radius, spacing, useTheme, font, type Colors } from "../lib/theme";
import { BlurFade } from "../components/Motion";

// Fechas en la zona horaria del teléfono (toISOString es UTC: en Ecuador,
// después de las 19:00 ya daba el día siguiente).
const mesActual = () => mesLocal();
const hoy = () => fechaLocal();

const ETIQUETA_TIPO: Record<TipoDeuda, string> = {
  prestamo: "Préstamo",
  tarjeta: "Tarjeta",
  diferido: "Diferido",
  otro: "Otro",
};
const ETIQUETA_NIVEL = { bajo: "Bajo", moderado: "Moderado", alto: "Alto" };

export default function DeudasScreen() {
  const [cargando, setCargando] = useState(true);
  const { color } = useTheme();
  const styles = createStyles(color);
  const COLOR_NIVEL = {
    bajo: color.success,
    moderado: color.warning,
    alto: color.danger,
  };
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [ingresoMensual, setIngresoMensual] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([listarDeudas(), listarCuentas(), listarIngresos()])
      .then(([d, c, i]) => {
        setDeudas(d);
        setCuentas(c);
        setIngresoMensual(
          i
            .filter((x) => x.fecha.startsWith(mesActual()))
            .reduce((a, x) => a + x.monto, 0),
        );
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  const endeudamiento = calcularEndeudamiento(deudas, ingresoMensual);

  function confirmarEliminar(deuda: Deuda) {
    Alert.alert("Eliminar deuda", `¿Eliminar "${deuda.nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          eliminarDeuda(deuda.id)
            .then(cargar)
            .catch((err) => setError(mensajeError(err))),
      },
    ]);
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
            Deudas
          </Text>
          <Text style={styles.screenIntro}>
            Tus saldos y cuotas pendientes.
          </Text>
        </BlurFade>
        <Tarjeta>
          <View style={styles.resumenFila}>
            <View>
              <Text style={styles.etiqueta}>Saldo pendiente total</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={styles.valorGrande}
              >
                ${endeudamiento.totalPendiente.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text style={styles.etiqueta}>Cuotas mensuales</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={styles.valorGrande}
              >
                ${endeudamiento.cuotasMensuales.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={{ gap: spacing(1.5) }}>
            <View style={styles.resumenFila}>
              <Text style={styles.etiqueta}>Nivel de endeudamiento</Text>
              <Text
                style={[
                  styles.nivel,
                  { color: COLOR_NIVEL[endeudamiento.nivel] },
                ]}
              >
                {endeudamiento.porcentaje.toFixed(0)}% ·{" "}
                {ETIQUETA_NIVEL[endeudamiento.nivel]}
              </Text>
            </View>
            <BarraProgreso porcentaje={endeudamiento.porcentaje} />
          </View>
        </Tarjeta>

        <NuevaDeuda cuentas={cuentas} onCreada={cargar} />

        {error && <ErrorTexto>{error}</ErrorTexto>}

        {deudas.length === 0 ? (
          <EstadoVacio
            icono="alert-circle-outline"
            titulo="No tenés deudas ni préstamos registrados"
            subtitulo="Cuando agregues una, vas a ver acá tu nivel de endeudamiento."
          />
        ) : (
          <View style={{ gap: spacing(3) }}>
            {deudas.map((d) => (
              <FilaDeuda
                key={d.id}
                deuda={d}
                cuentas={cuentas}
                onCambio={cargar}
                onEliminar={() => confirmarEliminar(d)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FilaDeuda({
  deuda,
  cuentas,
  onCambio,
  onEliminar,
}: {
  deuda: Deuda;
  cuentas: Cuenta[];
  onCambio: () => void;
  onEliminar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  // Un abono sale de dinero real: ahorro, débito o efectivo (no de otra tarjeta).
  const cuentasOrigen = cuentas.filter((c) => c.tipo !== "credito");
  const cuentaSugerida =
    cuentasOrigen.find((c) => c.id === deuda.cuentaId)?.id ?? cuentasOrigen[0]?.id ?? "";
  const [abonando, setAbonando] = useState(false);
  const [monto, setMonto] = useState("");
  const [cuentaId, setCuentaId] = useState(cuentaSugerida);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setCuentaId(cuentaSugerida);
    setError(null);
    setAbonando(true);
  }

  async function confirmar() {
    const valor = Number(monto.replace(",", "."));
    if (!monto || !(valor > 0)) {
      setError("Ingresá un monto mayor que 0.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      // Atómico en la base: baja el saldo, descuenta de la cuenta elegida y
      // mueve el próximo pago. Si el monto supera el saldo, se cobra solo lo pendiente.
      await registrarAbonoDeuda(deuda.id, valor, { cuentaId: cuentaId || undefined });
      setMonto("");
      setAbonando(false);
      onCambio();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.resumenFila}>
        <View style={{ flex: 1 }}>
          <Text style={styles.deudaNombre}>{deuda.nombre}</Text>
          {deuda.gastoId && (
            <Text style={styles.etiquetaAuto}>Generada automáticamente</Text>
          )}
        </View>
        <Text style={styles.tipoTexto}>{ETIQUETA_TIPO[deuda.tipo]}</Text>
      </View>
      <View style={styles.resumenFila}>
        <View>
          <Text style={styles.etiqueta}>Saldo pendiente</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            style={styles.valorMedio}
          >
            ${deuda.saldoPendiente.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text style={styles.etiqueta}>Cuota mensual</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            style={styles.valorMedio}
          >
            ${deuda.cuotaMensual.toFixed(2)}
          </Text>
        </View>
      </View>
      {abonando ? (
        <View style={{ gap: spacing(3) }}>
          <Campo
            etiqueta="Monto del abono"
            placeholder={`Hasta $${deuda.saldoPendiente.toFixed(2)}`}
            keyboardType="decimal-pad"
            value={monto}
            onChangeText={setMonto}
          />
          <SelectorChips
            titulo="Pagar desde"
            valor={cuentaId}
            onCambiar={setCuentaId}
            opciones={[
              ...cuentasOrigen.map((c) => ({
                valor: c.id,
                etiqueta: `${c.nombre} · $${c.disponible.toFixed(2)}`,
              })),
              { valor: "", etiqueta: "No descontar de una cuenta" },
            ]}
          />
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <Boton
            titulo={guardando ? "Guardando…" : "Abonar"}
            variante="primario"
            onPress={confirmar}
            loading={guardando}
            disabled={guardando}
          />
          <Boton titulo="Cancelar" onPress={() => setAbonando(false)} disabled={guardando} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing(2) }}>
          <Boton
            titulo="Registrar abono"
            style={{ flex: 1 }}
            onPress={abrir}
            disabled={deuda.saldoPendiente <= 0}
          />
          <Boton titulo="Eliminar" variante="peligro" onPress={onEliminar} />
        </View>
      )}
    </Tarjeta>
  );
}

function NuevaDeuda({
  cuentas,
  onCreada,
}: {
  cuentas: Cuenta[];
  onCreada: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Exclude<TipoDeuda, "diferido">>("prestamo");
  const [montoTotal, setMontoTotal] = useState("");
  const [cuotaMensual, setCuotaMensual] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Boton
        titulo="+ Nueva deuda / préstamo"
        onPress={() => setAbierto(true)}
      />
    );
  }

  async function agregar() {
    if (!nombre.trim() || !montoTotal) {
      setError("Completá nombre y monto total.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await crearDeuda({
        nombre,
        tipo,
        montoTotal: Number(montoTotal),
        saldoPendiente: Number(montoTotal),
        cuotaMensual: Number(cuotaMensual || 0),
        fechaInicio: hoy(),
        cuentaId: cuentaId || undefined,
      });
      setNombre("");
      setMontoTotal("");
      setCuotaMensual("");
      setAbierto(false);
      onCreada();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.resumenFila}>
        <Text style={styles.deudaNombre}>Nueva deuda / préstamo</Text>
        <Boton titulo="Cancelar" onPress={() => setAbierto(false)} />
      </View>
      <Campo
        etiqueta="Nombre"
        placeholder="Préstamo carro"
        value={nombre}
        onChangeText={setNombre}
      />
      <SelectorChips
        titulo="Tipo"
        valor={tipo}
        onCambiar={(v) => setTipo(v as Exclude<TipoDeuda, "diferido">)}
        opciones={[
          { valor: "prestamo", etiqueta: "Préstamo" },
          { valor: "tarjeta", etiqueta: "Tarjeta" },
          { valor: "otro", etiqueta: "Otro" },
        ]}
      />
      <Campo
        etiqueta="Monto total"
        keyboardType="decimal-pad"
        value={montoTotal}
        onChangeText={setMontoTotal}
      />
      <Campo
        etiqueta="Cuota mensual"
        keyboardType="decimal-pad"
        value={cuotaMensual}
        onChangeText={setCuotaMensual}
      />
      <SelectorChips
        titulo="Cuenta asociada"
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={[
          { valor: "", etiqueta: "Sin asignar" },
          ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
        ]}
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
    resumenFila: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    etiqueta: {
      fontFamily: font.semibold,
      fontSize: 12,
      color: color.textMuted,
      fontWeight: "600",
    },
    valorGrande: {
      fontFamily: font.mono,
      fontSize: 18,
      color: color.text,
      marginTop: 2,
    },
    valorMedio: {
      fontFamily: font.mono,
      fontSize: 15,
      color: color.text,
      marginTop: 2,
    },
    nivel: { fontFamily: font.semibold, fontSize: 13, fontWeight: "700" },
    deudaNombre: { fontFamily: font.display, fontSize: 15, color: color.text },
    etiquetaAuto: {
      fontFamily: font.body,
      fontSize: 11,
      color: color.warning,
      marginTop: 2,
    },
    tipoTexto: {
      fontFamily: font.semibold,
      fontSize: 11,
      fontWeight: "600",
      color: color.textMuted,
      backgroundColor: color.bg,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
    },
  });
