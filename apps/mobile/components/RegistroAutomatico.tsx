import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { guardarAjustes, mensajeError, obtenerAjustes } from "core";
import Tarjeta from "./Tarjeta";
import ErrorTexto from "./ErrorTexto";
import { spacing, useTheme, font, type Colors } from "../lib/theme";

/**
 * «Registrar solo lo que reconozco»: si la base reconoce la tarjeta de un pago
 * por sus últimos dígitos, lo guarda como gasto (descuenta del cupo o del
 * saldo) sin pasar por la bandeja. También junta las transferencias entre tus
 * cuentas que llegan por correo. Es un ajuste de la cuenta (vive en la base,
 * que decide con la app cerrada), no del teléfono.
 */
export default function RegistroAutomatico({ nota }: { nota?: string }) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [activo, setActivo] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      obtenerAjustes()
        .then((a) => setActivo(a.registroAutomatico))
        .catch((err) => setError(mensajeError(err)));
    }, []),
  );

  async function cambiar(valor: boolean) {
    setError(null);
    setGuardando(true);
    try {
      setActivo((await guardarAjustes({ registroAutomatico: valor })).registroAutomatico);
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
          <Text style={styles.titulo}>Registrar solo cuando reconozco la tarjeta</Text>
          <Text style={styles.texto}>
            {activo === false
              ? "Apagado: todos los pagos y avisos del correo llegan a la bandeja para que los confirmes."
              : "Vale para Google Wallet, Apple Pay y los avisos del correo (consumos, pagos de tarjeta y transferencias entre tus cuentas). Se guarda solo y te aviso con una notificación para que lo revises."}
          </Text>
        </View>
        {activo === null || guardando ? (
          <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
        ) : (
          <Switch
            accessibilityLabel="Registrar solo cuando reconozco la tarjeta"
            value={activo}
            onValueChange={cambiar}
            trackColor={{ true: color.primary, false: color.border }}
          />
        )}
      </View>
      <Text style={styles.nota}>
        La reconozco por sus últimos 4 dígitos: anótalos en el detalle de cada tarjeta y cuenta. Si no la reconozco, o el
        pago dejaría una cuenta en negativo, va a la bandeja. Una tarjeta sí puede pasarse del cupo: queda en rojo.
        {nota ? ` ${nota}` : ""}
      </Text>
      {error && <ErrorTexto>{error}</ErrorTexto>}
    </Tarjeta>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    fila: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
    titulo: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    texto: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
    nota: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: color.textMuted },
  });
