import { Text, StyleSheet } from "react-native";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

/** Paralelo a `<p className="error">` de desktop. */
export default function ErrorTexto({ children }: { children: string }) {
  const { color: color } = useTheme();
  const styles = makeStyles(color);
  return <Text accessibilityRole="alert" style={styles.texto}>{children}</Text>;
}

const makeStyles = (color: Colors) => StyleSheet.create({
  texto: { color: color.danger, fontFamily: font.body, fontSize: 13, backgroundColor: color.dangerBg, padding: 10, borderRadius: 8 },
});
