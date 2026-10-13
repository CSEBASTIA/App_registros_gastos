import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, type LayoutRectangle } from "react-native";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";
import { AnimatedBackground } from "./Motion";

interface Opcion {
  valor: string;
  etiqueta: string;
  color?: string;
}

interface Props {
  titulo: string;
  opciones: Opcion[];
  valor: string;
  onCambiar: (valor: string) => void;
}

/**
 * Selector de una opción entre varias, en chips horizontales scrolleables —
 * reemplaza al `<select>` nativo de desktop (RN no tiene uno equivalente sin
 * traer una librería aparte). Mismo criterio que ya usan las categorías en
 * desktop.
 */
export default function SelectorChips({ titulo, opciones, valor, onCambiar }: Props) {
  const { color } = useTheme();
  const styles = makeStyles(color);
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.fila}>
        <AnimatedBackground layout={layouts[valor]} color={color.primaryBg} />
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              onLayout={event => { const layout = event.nativeEvent.layout; setLayouts(prev => ({ ...prev, [o.valor]: layout })); }}
              onPress={() => onCambiar(o.valor)}
              style={[
                styles.chip,
                activo && {
                  borderColor: color.primary,
                },
              ]}
            >
              {o.color && <View style={[styles.punto, { backgroundColor: o.color }]} />}
              <Text style={[styles.chipTexto, activo && { color: color.primary, fontFamily: font.semibold }]}>
                {o.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View></ScrollView>
    </View>
  );
}

const makeStyles = (color: Colors) => StyleSheet.create({
  contenedor: { gap: spacing(1.5) },
  etiqueta: { fontFamily: font.semibold, fontSize: 13, color: color.textMuted },
  fila: { flexDirection: "row", gap: spacing(2), paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderWidth: 1.5,
    borderColor: color.border,
    minHeight: 44,
    borderRadius: radius.pill,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
  },
  chipTexto: { fontFamily: font.medium, fontSize: 13.5, color: color.text },
  punto: { width: 8, height: 8, borderRadius: 4 },
});
