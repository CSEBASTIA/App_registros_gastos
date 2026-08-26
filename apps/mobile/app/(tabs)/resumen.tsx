import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { resumenMensual, type ResumenMensual } from "core";

function mesActual() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default function Resumen() {
  const [resumen, setResumen] = useState<ResumenMensual | null>(null);

  useEffect(() => {
    resumenMensual(mesActual()).then(setResumen);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Resumen de {mesActual()}</Text>
      {resumen ? (
        <>
          <Text style={styles.total}>${resumen.total.toFixed(2)}</Text>
          <Text style={styles.meta}>{resumen.cantidad} gasto(s) registrados</Text>
        </>
      ) : (
        <Text>Cargando…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  titulo: { fontSize: 22, fontWeight: "600" },
  total: { fontSize: 36, fontWeight: "700", marginTop: 16 },
  meta: { color: "#6b7280" },
});
