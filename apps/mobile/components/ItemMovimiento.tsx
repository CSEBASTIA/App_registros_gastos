import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MovimientoCuenta } from "core";
import { color as tema, radius, spacing } from "../lib/theme";

/** Paralelo a `ItemMovimiento.tsx` de desktop. */
export default function ItemMovimiento({ item }: { item: MovimientoCuenta }) {
  const esIngreso = item.tipo !== "gasto";
  return (
    <View style={styles.fila}>
      <View style={[styles.icono, { backgroundColor: `${item.color}1f` }]}>
        <Ionicons name={esIngreso ? "arrow-up" : "document-text-outline"} size={16} color={item.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.descripcion} numberOfLines={1}>
          {item.descripcion}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1}>
          {item.subtitulo}
        </Text>
      </View>
      <Text style={[styles.monto, { color: esIngreso ? tema.success : tema.danger }]}>
        {esIngreso ? "+" : "-"}${item.monto.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: spacing(3), paddingVertical: spacing(2.5) },
  icono: { width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0 },
  descripcion: { fontSize: 14, fontWeight: "600", color: tema.text },
  subtitulo: { fontSize: 12, color: tema.textMuted },
  monto: { fontSize: 14, fontWeight: "700" },
});
