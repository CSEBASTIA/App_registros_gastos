import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  fechaLocal,
  formatMonto,
  listarCuentas,
  mensajeError,
  parsearMonto,
  registrarTransferencia,
  sumarMontos,
  type Cuenta,
} from "core";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import { BlurFade } from "../../components/Motion";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";

/**
 * Pasar dinero de una cuenta propia a otra (por ejemplo, de ahorros a
 * efectivo). Resta de una y suma a la otra en un solo paso de la base, y no
 * cuenta como gasto ni como ingreso del mes.
 */
export default function NuevaTransferencia() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { origenId } = useLocalSearchParams<{ origenId?: string }>();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [origen, setOrigen] = useState(origenId ?? "");
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => fechaLocal());
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      listarCuentas()
        .then(setCuentas)
        .catch((err) => setError(mensajeError(err)))
        .finally(() => setCargando(false));
    }, []),
  );

  const cuentaOrigen = cuentas.find((c) => c.id === origen);
  const cuentaDestino = cuentas.find((c) => c.id === destino);
  // A una tarjeta de crédito no se transfiere: eso es «Pagar tarjeta».
  const destinos = cuentas.filter((c) => c.tipo !== "credito" && c.id !== origen);
  const hayTarjetas = cuentas.some((c) => c.tipo === "credito" && c.id !== origen);
  const montoNumerico = parsearMonto(monto);
  const montoValido = Number.isFinite(montoNumerico) && montoNumerico > 0;
  const superaCupo = cuentaOrigen?.tipo === "credito" && montoValido && montoNumerico > cuentaOrigen.disponible;

  function elegirOrigen(id: string) {
    setOrigen(id);
    if (id === destino) setDestino("");
  }

  async function guardar() {
    setError(null);
    if (!origen || !destino) {
      setError("Elige la cuenta de origen y la de destino.");
      return;
    }
    if (!montoValido) {
      setError("Escribe un monto válido, por ejemplo 12,50.");
      return;
    }
    if (superaCupo) {
      setError(`El monto supera el cupo disponible de la tarjeta (${formatMonto(cuentaOrigen!.disponible)}).`);
      return;
    }
    setGuardando(true);
    try {
      await registrarTransferencia({
        cuentaOrigenId: origen,
        cuentaDestinoId: destino,
        monto: montoNumerico,
        fecha,
        descripcion: descripcion.trim() || undefined,
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
      <View style={[styles.contenedor, { alignItems: "center", justifyContent: "center", padding: spacing(6) }]}>
        <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
      </View>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={styles.contenedor}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}
      >
        <BlurFade style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.screenTitle}>Transferir entre mis cuentas</Text>
          <Text style={styles.screenIntro}>
            Pasa dinero de una cuenta tuya a otra. Los dos saldos se ajustan solos y no cuenta como gasto ni ingreso.
          </Text>
        </BlurFade>

        {cuentas.length < 2 ? (
          <Text style={styles.ayudaTexto}>Necesitas al menos dos cuentas. Agrégalas en Más → Cuentas.</Text>
        ) : (
          <>
            <SelectorChips
              titulo="Desde"
              valor={origen}
              onCambiar={elegirOrigen}
              opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            />
            {cuentaOrigen?.tipo === "credito" && (
              <Text style={styles.ayudaTexto}>
                Desde una tarjeta es un avance de efectivo: usa cupo ({formatMonto(cuentaOrigen.disponible)} disponible).
              </Text>
            )}
            <SelectorChips
              titulo="Hacia"
              valor={destino}
              onCambiar={setDestino}
              opciones={destinos.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            />
            {hayTarjetas && (
              <Text style={styles.ayudaTexto}>
                ¿Vas a pagar una tarjeta de crédito? Hazlo con «Pagar tarjeta» desde su detalle: así queda como pago.
              </Text>
            )}
            <Campo etiqueta="Monto" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} placeholder="0.00" />
            <Campo etiqueta="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} placeholder="2026-10-18" />
            <Campo
              etiqueta="Descripción (opcional)"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Para la semana"
              maxLength={80}
            />

            {cuentaOrigen && cuentaDestino && montoValido && (
              <View style={styles.ayuda} accessibilityLiveRegion="polite">
                <Text style={styles.ayudaTexto}>
                  {cuentaOrigen.nombre}: {formatMonto(cuentaOrigen.disponible)} →{" "}
                  {formatMonto(sumarMontos([cuentaOrigen.disponible, -montoNumerico]))}
                  {"\n"}
                  {cuentaDestino.nombre}: {formatMonto(cuentaDestino.disponible)} →{" "}
                  {formatMonto(sumarMontos([cuentaDestino.disponible, montoNumerico]))}
                </Text>
              </View>
            )}
            {superaCupo && <ErrorTexto>El monto supera el cupo disponible de la tarjeta.</ErrorTexto>}
          </>
        )}

        {error && <ErrorTexto>{error}</ErrorTexto>}
        <Boton
          titulo={guardando ? "Transfiriendo…" : "Transferir"}
          variante="primario"
          onPress={guardar}
          loading={guardando}
          disabled={guardando || cuentas.length < 2}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    ayuda: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing(3) },
    ayudaTexto: { fontFamily: font.body, fontSize: 12, color: color.textMuted, lineHeight: 18 },
  });
