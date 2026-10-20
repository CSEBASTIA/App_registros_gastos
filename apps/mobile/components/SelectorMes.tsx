import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { etiquetaMes, moverMes } from "core";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

/** Selector de mes con flechas ‹ › — reemplaza al `<input type="month">` de desktop. */
export default function SelectorMes({ mes, onCambiar, compact = false }: { mes: string; onCambiar: (mes: string) => void; compact?: boolean }) {
  const { color: color } = useTheme();
  const styles = makeStyles(color);
  const anio = mes.split("-")[0];
  return (
    <View style={[styles.fila, compact && styles.filaCompact]}>
      <Pressable accessibilityLabel="Mes anterior" onPress={() => onCambiar(moverMes(mes, -1))} accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-back" size={20} color={color.text} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.texto, compact && styles.textoCompact]}>
        {etiquetaMes(mes)} {anio}
      </Text>
      <Pressable accessibilityLabel="Mes siguiente" onPress={() => onCambiar(moverMes(mes, 1))} accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-forward" size={20} color={color.text} />
      </Pressable>
    </View>
  );
}

const makeStyles = (color: Colors) => StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  filaCompact: { gap: 0 },
  texto: { fontFamily: font.body, fontSize: 14, fontWeight: "700", color: color.text, minWidth: 110, textAlign: "center" },
  textoCompact: { fontSize: 13, minWidth: 88 },
});
