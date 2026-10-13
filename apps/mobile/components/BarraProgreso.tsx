import { View, StyleSheet } from "react-native";
import { useTheme, font, radius, spacing, type Colors } from "../lib/theme";

/** Paralelo a `BarraProgreso.tsx` de desktop (mismos cortes 50/80). */
export default function BarraProgreso({
  porcentaje,
  colorOverride,
  claro,
}: {
  porcentaje: number;
  colorOverride?: string;
  claro?: boolean;
}) {
  const { color: tema } = useTheme();
  const styles = makeStyles(tema);
  const valor = Math.min(100, Math.max(0, porcentaje));
  const tono = colorOverride ?? (valor >= 80 ? tema.danger : valor >= 50 ? tema.warning : tema.success);

  return (
    <View style={[styles.pista, claro && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
      <View style={[styles.relleno, { width: `${valor}%`, backgroundColor: tono }]} />
    </View>
  );
}

const makeStyles = (tema: Colors) => StyleSheet.create({
  pista: { height: 6, borderRadius: radius.pill, backgroundColor: tema.border, overflow: "hidden" },
  relleno: { height: "100%", borderRadius: radius.pill },
});
