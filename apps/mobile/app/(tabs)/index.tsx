import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { listarGastos, listarCategorias, eliminarGasto, type Gasto, type Categoria } from "core";
import { supabase } from "../../lib/supabase";

export default function ListaGastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    Promise.all([listarGastos(), listarCategorias()])
      .then(([g, c]) => {
        setGastos(g);
        setCategorias(c);
      })
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  function nombreCategoria(id: string) {
    return categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Gastos</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.salir}>Salir</Text>
        </Pressable>
      </View>
      <FlatList
        data={gastos}
        keyExtractor={(g) => g.id}
        refreshing={cargando}
        onRefresh={cargar}
        ListEmptyComponent={!cargando ? <Text>No hay gastos todavía.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onLongPress={() => eliminarGasto(item.id).then(cargar)}>
            <View>
              <Text style={styles.descripcion}>{item.descripcion}</Text>
              <Text style={styles.meta}>
                {nombreCategoria(item.categoriaId)} · {item.fecha}
              </Text>
            </View>
            <Text style={styles.monto}>${item.monto.toFixed(2)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titulo: { fontSize: 22, fontWeight: "600" },
  salir: { color: "#dc2626" },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  descripcion: { fontSize: 16 },
  meta: { color: "#6b7280", fontSize: 13 },
  monto: { fontWeight: "600" },
});
