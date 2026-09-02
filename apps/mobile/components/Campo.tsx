import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { color, radius, spacing } from "../lib/theme";

interface Props extends TextInputProps {
  etiqueta: string;
}

/** Label + input, paralelo a `.campo` de desktop. */
export default function Campo({ etiqueta, style, ...resto }: Props) {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={color.textMuted} {...resto} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: spacing(1.5) },
  etiqueta: { fontSize: 13, fontWeight: "600", color: color.textMuted },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    fontSize: 15,
    color: color.text,
    backgroundColor: color.surface,
  },
});
