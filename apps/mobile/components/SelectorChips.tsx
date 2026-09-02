import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { color, radius, spacing } from "../lib/theme";

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
  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              onPress={() => onCambiar(o.valor)}
              style={[
                styles.chip,
                activo && {
                  borderColor: o.color ?? color.primary,
                  backgroundColor: (o.color ?? color.primary) + "1a",
                },
              ]}
            >
              {o.color && <View style={[styles.punto, { backgroundColor: o.color }]} />}
              <Text style={[styles.chipTexto, activo && { color: o.color ?? color.primary, fontWeight: "700" }]}>
                {o.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: spacing(1.5) },
  etiqueta: { fontSize: 13, fontWeight: "600", color: color.textMuted },
  fila: { gap: spacing(2), paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
  },
  chipTexto: { fontSize: 13.5, fontWeight: "500", color: color.text },
  punto: { width: 8, height: 8, borderRadius: 4 },
});
