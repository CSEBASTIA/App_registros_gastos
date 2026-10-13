import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

interface Props extends TextInputProps {
  etiqueta: string;
}

/** Label + input, paralelo a `.campo` de desktop. */
export default function Campo({ etiqueta, style, ...resto }: Props) {
  const { color: color } = useTheme();
  const styles = makeStyles(color);
  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput accessibilityLabel={etiqueta} style={[styles.input, style]} placeholderTextColor={color.textMuted} {...resto} />
    </View>
  );
}

const makeStyles = (color: Colors) => StyleSheet.create({
  contenedor: { gap: spacing(1.5) },
  etiqueta: { fontFamily: font.body, fontSize: 13, fontWeight: "600", color: color.textMuted },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    minHeight: 48, paddingVertical: spacing(3),
    paddingHorizontal: spacing(3),
    fontFamily: font.body, fontSize: 15,
    color: color.text,
    backgroundColor: color.surface,
  },
});
