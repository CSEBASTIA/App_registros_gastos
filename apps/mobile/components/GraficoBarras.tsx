import { View, Text, StyleSheet } from "react-native";
import { color, spacing } from "../lib/theme";

export interface BarraDato {
  etiqueta: string;
  valor: number;
  color: string;
}

/**
 * Versión mobile de `GraficoBarras.tsx` de desktop: barras con `View` +
 * altura en porcentaje (sin tooltip al pasar el mouse — no aplica en
 * touch — el valor va siempre visible arriba de la barra).
 */
export default function GraficoBarras({
  datos,
  alto = 160,
  mensajeVacio = "Sin datos en este período.",
}: {
  datos: BarraDato[];
  alto?: number;
  mensajeVacio?: string;
}) {
  if (datos.length === 0) {
    return (
      <View style={[styles.vacio, { height: alto }]}>
        <Text style={styles.vacioTexto}>{mensajeVacio}</Text>
      </View>
    );
  }

  const maximo = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <View>
      <View style={[styles.lienzo, { height: alto }]}>
        {datos.map((d) => (
          <View key={d.etiqueta} style={styles.columna}>
            <Text style={styles.valor}>${d.valor.toFixed(0)}</Text>
            <View style={styles.pista}>
              <View
                style={[
                  styles.barra,
                  { height: `${Math.max(2, (d.valor / maximo) * 100)}%`, backgroundColor: d.color },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.etiquetas}>
        {datos.map((d) => (
          <Text key={d.etiqueta} style={styles.etiqueta} numberOfLines={1}>
            {d.etiqueta}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { alignItems: "center", justifyContent: "center" },
  vacioTexto: { color: color.textMuted, fontSize: 13 },
  lienzo: { flexDirection: "row", alignItems: "flex-end", gap: spacing(2) },
  columna: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: spacing(1) },
  valor: { fontSize: 10, fontWeight: "700", color: color.textMuted },
  pista: { flex: 1, width: "100%", justifyContent: "flex-end" },
  barra: { width: "100%", borderRadius: 4, minHeight: 3 },
  etiquetas: { flexDirection: "row", gap: spacing(2), marginTop: spacing(1.5) },
  etiqueta: { flex: 1, fontSize: 10, color: color.textMuted, textAlign: "center" },
});
