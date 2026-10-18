import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { actualizarIdentificadorCuenta, mensajeError, type Cuenta } from "core";
import Tarjeta from "./Tarjeta";
import Campo from "./Campo";
import Boton from "./Boton";
import ErrorTexto from "./ErrorTexto";
import { spacing, useTheme, font, type Colors } from "../lib/theme";

/**
 * Los últimos dígitos de una cuenta o tarjeta. Con ellos la app reconoce sus
 * avisos: un pago con Google Wallet (o Apple Pay) con esa tarjeta se registra
 * solo, y los correos del banco se asignan a esta cuenta.
 */
export default function DigitosCuenta({ cuenta, onCambio }: { cuenta: Cuenta; onCambio: (c: Cuenta) => void }) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(cuenta.identificador ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      onCambio(await actualizarIdentificadorCuenta(cuenta.id, valor));
      setEditando(false);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta style={{ gap: spacing(2) }}>
      <View style={styles.fila}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Últimos dígitos</Text>
          <Text style={styles.texto}>
            {cuenta.identificador
              ? `•••• ${cuenta.identificador} · la app reconoce los pagos con Google Wallet y los avisos del banco de ${cuenta.tipo === "credito" ? "esta tarjeta" : "esta cuenta"}.`
              : "Sin anotar: agrégalos para que la app reconozca tus pagos con Google Wallet y los avisos del banco."}
          </Text>
        </View>
        {!editando && <Boton titulo={cuenta.identificador ? "Cambiar" : "Agregar"} onPress={() => setEditando(true)} />}
      </View>
      {editando && (
        <>
          <Campo
            etiqueta="Últimos 4 dígitos"
            keyboardType="number-pad"
            maxLength={4}
            value={valor}
            onChangeText={(t) => setValor(t.replace(/\D/g, ""))}
            placeholder="1234"
          />
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <View style={{ flexDirection: "row", gap: spacing(2) }}>
            <Boton titulo="Guardar" variante="primario" onPress={guardar} loading={guardando} disabled={guardando} style={{ flex: 1 }} />
            <Boton
              titulo="Cancelar"
              onPress={() => {
                setEditando(false);
                setValor(cuenta.identificador ?? "");
                setError(null);
              }}
              disabled={guardando}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </Tarjeta>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    fila: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
    titulo: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    texto: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
  });
