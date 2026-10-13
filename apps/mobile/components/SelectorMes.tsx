import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { etiquetaMes, moverMes } from "core";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

/** Selector de mes con flechas ‹ › — reemplaza al `<input type="month">` de desktop. */
export default function SelectorMes({ mes, onCambiar }: { mes: string; onCambiar: (mes: string) => void }) {
  const { color: color } = useTheme();
  const styles = makeStyles(color);
  const anio = mes.split("-")[0];
  return (
    <View style={styles.fila}>
      <Pressable accessibilityLabel="Mes anterior" onPress={() => onCambiar(moverMes(mes, -1))} accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-back" size={20} color={color.text} />
      </Pressable>
      <Text style={styles.texto}>
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
  texto: { fontFamily: font.body, fontSize: 14, fontWeight: "700", color: color.text, minWidth: 110, textAlign: "center" },
});
