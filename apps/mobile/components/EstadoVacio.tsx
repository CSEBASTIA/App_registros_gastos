import { BlurFade } from "./Motion";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

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
  const { color: color } = useTheme();
  const styles = makeStyles(color);
  return (
    <BlurFade style={styles.contenedor}>
      <Ionicons name={icono} size={32} color={color.textMuted} />
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.subtitulo}>{subtitulo}</Text>
    </BlurFade>
  );
}

const makeStyles = (color: Colors) => StyleSheet.create({
  contenedor: { alignItems: "center", padding: spacing(8), gap: spacing(2) },
  titulo: { fontFamily: font.display, fontSize: 15, fontWeight: "600", color: color.text, textAlign: "center" },
  subtitulo: { fontFamily: font.body, fontSize: 13, color: color.textMuted, textAlign: "center" },
});
