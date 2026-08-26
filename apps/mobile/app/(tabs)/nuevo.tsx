import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { crearGasto, listarCategorias, type Categoria } from "core";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function NuevoGasto() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarCategorias().then((c) => {
      setCategorias(c);
      if (c[0]) setCategoriaId(c[0].id);
    });
  }, []);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await crearGasto({
        monto: Number(monto),
        descripcion,
        categoriaId,
        fecha: hoy(),
      });
      setMonto("");
      setDescripcion("");
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el gasto");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Registrar gasto</Text>
      <TextInput
        style={styles.input}
        placeholder="Monto"
        keyboardType="decimal-pad"
        value={monto}
        onChangeText={setMonto}
      />
      <TextInput
        style={styles.input}
        placeholder="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
      />
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.categorias}>
        {categorias.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategoriaId(c.id)}
            style={[
              styles.chip,
              { borderColor: c.color },
              categoriaId === c.id && { backgroundColor: c.color },
            ]}
          >
            <Text style={categoriaId === c.id ? styles.chipTextoActivo : undefined}>
              {c.nombre}
            </Text>
          </Pressable>
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.boton} onPress={guardar} disabled={guardando || !categoriaId}>
        <Text style={styles.botonTexto}>{guardando ? "Guardando…" : "Guardar"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  titulo: { fontSize: 22, fontWeight: "600", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  label: { fontWeight: "600", marginTop: 8 },
  categorias: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  chipTextoActivo: { color: "white" },
  boton: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  botonTexto: { color: "white", fontWeight: "600" },
  error: { color: "crimson" },
});
