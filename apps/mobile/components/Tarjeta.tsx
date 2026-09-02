import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { color, radius, spacing } from "../lib/theme";

/** Contenedor tipo "card", paralelo a `.card` de desktop. */
export default function Tarjeta({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: spacing(4),
    gap: spacing(3),
  },
});
