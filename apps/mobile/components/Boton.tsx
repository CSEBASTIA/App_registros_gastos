import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { color, radius, spacing } from "../lib/theme";

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: "primario" | "secundario" | "peligro";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Botón reusado en toda la app — paralelo a `.btn`/`.btn-primary` de desktop. */
export default function Boton({ titulo, onPress, variante = "secundario", disabled, style }: Props) {
  const fondo =
    variante === "primario" ? color.primary : variante === "peligro" ? color.dangerBg : color.surface;
  const texto = variante === "primario" ? "#fff" : variante === "peligro" ? color.danger : color.text;
  const borde = variante === "primario" ? color.primary : color.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: fondo, borderColor: borde, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.texto, { color: texto }]}>{titulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
    alignItems: "center",
    justifyContent: "center",
  },
  texto: { fontWeight: "600", fontSize: 14 },
});
