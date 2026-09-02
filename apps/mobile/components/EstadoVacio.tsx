import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, spacing } from "../lib/theme";

/** Paralelo a `EstadoVacio.tsx` de desktop. */
export default function EstadoVacio({
  icono,
  titulo,
  subtitulo,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <View style={styles.contenedor}>
      <Ionicons name={icono} size={32} color={color.textMuted} />
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.subtitulo}>{subtitulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: "center", padding: spacing(8), gap: spacing(2) },
  titulo: { fontSize: 15, fontWeight: "600", color: color.text, textAlign: "center" },
  subtitulo: { fontSize: 13, color: color.textMuted, textAlign: "center" },
});
