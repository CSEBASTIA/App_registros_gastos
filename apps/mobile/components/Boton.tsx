import { useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, font, radius, spacing } from "../lib/theme";

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: "primario" | "secundario" | "peligro";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Botón reusado en toda la app — paralelo a `.btn`/`.btn-primary` de desktop. */
export default function Boton({ titulo, onPress, variante = "secundario", disabled, loading, style }: Props) {
  const { color, mode, reduceMotion } = useTheme();
  const ripple = useRef(new Animated.Value(1)).current;
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const diameter = Math.hypot(size.width, size.height) * 2;
  const fondo =
    variante === "primario" ? color.primary : variante === "peligro" ? color.dangerBg : color.surface;
  const texto = variante === "primario" ? (mode === "dark" ? "#11131d" : "#fff") : variante === "peligro" ? color.danger : color.text;
  const borde = variante === "primario" ? color.primary : color.border;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onLayout={event => setSize(event.nativeEvent.layout)}
      onPressIn={event => {
        if (reduceMotion) return;
        setPoint({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
        ripple.stopAnimation(); ripple.setValue(0);
        Animated.timing(ripple, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: fondo, borderColor: borde, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {!reduceMotion && <Animated.View pointerEvents="none" style={{ position: "absolute", width: diameter, height: diameter, borderRadius: diameter / 2, left: point.x - diameter / 2, top: point.y - diameter / 2, backgroundColor: texto, opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] }), transform: [{ scale: ripple }] }} />}
      {loading && <ActivityIndicator color={texto} size="small" />}
      <Text style={[styles.texto, { color: texto }]}>{titulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
    alignItems: "center",
    justifyContent: "center",
  },
  texto: { fontFamily: font.semibold, fontSize: 14 },
});
