import { Text, StyleSheet } from "react-native";
import { color } from "../lib/theme";

/** Paralelo a `<p className="error">` de desktop. */
export default function ErrorTexto({ children }: { children: string }) {
  return <Text style={styles.texto}>{children}</Text>;
}

const styles = StyleSheet.create({
  texto: { color: color.danger, fontSize: 13, backgroundColor: color.dangerBg, padding: 10, borderRadius: 8 },
});
