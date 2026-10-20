import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MovimientoCuenta } from "core";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

/** Paralelo a `ItemMovimiento.tsx` de desktop. */
export default function ItemMovimiento({ item, calm = false }: { item: MovimientoCuenta; calm?: boolean }) {
  const { color: tema } = useTheme();
  const styles = makeStyles(tema);
  // `sentido` dice si suma o resta (un pago enviado o un abono resta aunque no sea "gasto").
  const esIngreso = item.sentido ? item.sentido === "entrada" : item.tipo !== "gasto";
  return (
    <View style={styles.fila}>
      <View style={[styles.icono, { backgroundColor: `${item.color}1f` }]}>
        <Ionicons
          name={item.tipo.startsWith("transferencia") ? "swap-horizontal" : esIngreso ? "arrow-up" : "document-text-outline"}
          size={16}
          color={item.color}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.descripcion} numberOfLines={1}>
          {item.descripcion}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1}>
          {item.subtitulo}
        </Text>
      </View>
      <Text style={[styles.monto, { color: esIngreso ? tema.success : calm ? tema.text : tema.danger }]}>
        {esIngreso ? "+" : "-"}${item.monto.toFixed(2)}
      </Text>
    </View>
  );
}

const makeStyles = (tema: Colors) => StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: spacing(3), paddingVertical: spacing(2.5) },
  icono: { width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0 },
  descripcion: { fontFamily: font.body, fontSize: 14, fontWeight: "600", color: tema.text },
  subtitulo: { fontFamily: font.body, fontSize: 12, color: tema.textMuted },
  monto: { fontFamily: font.mono, fontSize: 14, fontWeight: "700" },
});
