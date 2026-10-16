import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

interface Props {
  marcada: boolean;
  onChange: (marcada: boolean) => void;
  /** Lo que lee el lector de pantalla (el texto de al lado puede tener enlaces). */
  etiqueta: string;
  disabled?: boolean;
  /** El texto de al lado; puede llevar enlaces (`EnlaceLegal`). */
  children: ReactNode;
}

/**
 * Casilla de verificación con texto. Solo la casilla alterna el valor: así
 * tocar un enlace del texto abre el documento sin marcar ni desmarcar.
 */
export default function Casilla({ marcada, onChange, etiqueta, disabled, children }: Props) {
  const { color, mode } = useTheme();
  const styles = makeStyles(color);
  return (
    <View style={styles.fila}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={etiqueta}
        accessibilityState={{ checked: marcada, disabled: !!disabled }}
        // En web `accessibilityState.checked` no llega al DOM; `aria-checked` sí.
        aria-checked={marcada}
        disabled={disabled}
        hitSlop={10}
        onPress={() => onChange(!marcada)}
        style={[styles.caja, marcada && styles.cajaMarcada]}
      >
        {marcada && <Ionicons name="checkmark" size={16} color={mode === "dark" ? "#111111" : "#ffffff"} />}
      </Pressable>
      <Text style={styles.texto}>{children}</Text>
    </View>
  );
}

const makeStyles = (color: Colors) =>
  StyleSheet.create({
    fila: { flexDirection: "row", alignItems: "flex-start", gap: spacing(3) },
    caja: {
      width: 24,
      height: 24,
      marginTop: 1,
      borderRadius: radius.sm / 2,
      borderWidth: 1.5,
      borderColor: color.textMuted,
      backgroundColor: color.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    cajaMarcada: { backgroundColor: color.primary, borderColor: color.primary },
    texto: { flex: 1, fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.text },
  });
