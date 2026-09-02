import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { color, radius, spacing } from "../../lib/theme";

const ITEMS: { titulo: string; subtitulo: string; ruta: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { titulo: "Cuentas", subtitulo: "Ahorros, débito, efectivo", ruta: "/cuentas", icono: "wallet-outline" },
  { titulo: "Deudas", subtitulo: "Préstamos, endeudamiento", ruta: "/deudas", icono: "alert-circle-outline" },
  { titulo: "Recordatorios", subtitulo: "Pagos y cuotas próximas", ruta: "/recordatorios", icono: "notifications-outline" },
  { titulo: "Categorías", subtitulo: "Organizá gastos e ingresos", ruta: "/categorias", icono: "pricetag-outline" },
];

export default function Mas() {
  const router = useRouter();

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
      <Text style={styles.titulo}>Más</Text>

      {ITEMS.map((item) => (
        <Pressable key={item.ruta} style={styles.fila} onPress={() => router.push(item.ruta as never)}>
          <View style={styles.icono}>
            <Ionicons name={item.icono} size={20} color={color.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filaTitulo}>{item.titulo}</Text>
            <Text style={styles.filaSubtitulo}>{item.subtitulo}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
        </Pressable>
      ))}

      <Pressable style={[styles.fila, styles.salir]} onPress={() => supabase.auth.signOut()}>
        <View style={[styles.icono, { backgroundColor: color.dangerBg }]}>
          <Ionicons name="log-out-outline" size={20} color={color.danger} />
        </View>
        <Text style={[styles.filaTitulo, { color: color.danger }]}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  titulo: { fontSize: 24, fontWeight: "700", color: color.text, marginBottom: spacing(2) },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: spacing(3.5),
  },
  icono: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: color.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  filaTitulo: { fontSize: 15, fontWeight: "600", color: color.text },
  filaSubtitulo: { fontSize: 12, color: color.textMuted },
  salir: { marginTop: spacing(4) },
});
