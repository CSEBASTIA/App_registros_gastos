import { BlurFade } from "./Motion";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

/** Contenedor tipo "card", paralelo a `.card` de desktop. */
export default function Tarjeta({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color: color } = useTheme();
  const styles = makeStyles(color);
  return <BlurFade style={[styles.card, style]}>{children}</BlurFade>;
}

const makeStyles = (color: Colors) => StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: spacing(4), shadowColor: color.text, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0,
    gap: spacing(3),
  },
});
