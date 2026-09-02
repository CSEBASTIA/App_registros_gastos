import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { etiquetaMes, moverMes } from "core";
import { color, spacing } from "../lib/theme";

/** Selector de mes con flechas ‹ › — reemplaza al `<input type="month">` de desktop. */
export default function SelectorMes({ mes, onCambiar }: { mes: string; onCambiar: (mes: string) => void }) {
  const anio = mes.split("-")[0];
  return (
    <View style={styles.fila}>
      <Pressable onPress={() => onCambiar(moverMes(mes, -1))} hitSlop={10}>
        <Ionicons name="chevron-back" size={20} color={color.text} />
      </Pressable>
      <Text style={styles.texto}>
        {etiquetaMes(mes)} {anio}
      </Text>
      <Pressable onPress={() => onCambiar(moverMes(mes, 1))} hitSlop={10}>
        <Ionicons name="chevron-forward" size={20} color={color.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  texto: { fontSize: 14, fontWeight: "700", color: color.text, minWidth: 110, textAlign: "center" },
});
