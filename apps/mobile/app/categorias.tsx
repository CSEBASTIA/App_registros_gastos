import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  mensajeError,
  type Categoria,
  type TipoCategoria,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import EstadoVacio from "../components/EstadoVacio";
import { color, radius, spacing } from "../lib/theme";

const PALETA = ["#3b6ff2", "#16a34a", "#f97316", "#a855f7", "#e0453f", "#0891b2", "#db2777", "#6b7280"];

export default function CategoriasScreen() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    listarCategorias()
      .then(setCategorias)
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  const deGasto = categorias.filter((c) => c.tipo === "gasto");
  const deIngreso = categorias.filter((c) => c.tipo === "ingreso");

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <NuevaCategoria onCreada={cargar} />
      <ListaCategorias titulo="Categorías de gasto" categorias={deGasto} onCambio={cargar} />
      <ListaCategorias titulo="Categorías de ingreso" categorias={deIngreso} onCambio={cargar} />
    </ScrollView>
  );
}

function NuevaCategoria({ onCreada }: { onCreada: () => void }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("gasto");
  const [tono, setTono] = useState(PALETA[0]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la categoría.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await crearCategoria({ nombre, color: tono, tipo });
      setNombre("");
      onCreada();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <Text style={styles.tituloCard}>Nueva categoría</Text>
      <Campo etiqueta="Nombre" placeholder="Mascotas" value={nombre} onChangeText={setNombre} />
      <SelectorChips
        titulo="Tipo"
        valor={tipo}
        onCambiar={(v) => setTipo(v as TipoCategoria)}
        opciones={[
          { valor: "gasto", etiqueta: "Gasto" },
          { valor: "ingreso", etiqueta: "Ingreso" },
        ]}
      />
      <View style={{ gap: spacing(1.5) }}>
        <Text style={styles.etiquetaColor}>Color</Text>
        <View style={styles.paleta}>
          {PALETA.map((c) => (
            <Pressable
              key={c}
              onPress={() => setTono(c)}
              style={[styles.swatch, { backgroundColor: c }, tono === c && styles.swatchActivo]}
            />
          ))}
        </View>
      </View>
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton titulo={guardando ? "Guardando…" : "Agregar"} variante="primario" onPress={agregar} disabled={guardando} />
    </Tarjeta>
  );
}

function ListaCategorias({
  titulo,
  categorias,
  onCambio,
}: {
  titulo: string;
  categorias: Categoria[];
  onCambio: () => void;
}) {
  return (
    <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
      <Text style={[styles.tituloCard, { paddingHorizontal: spacing(4) }]}>{titulo}</Text>
      {categorias.length === 0 ? (
        <EstadoVacio icono="pricetag-outline" titulo="Todavía no hay categorías" subtitulo="Creá una arriba." />
      ) : (
        <View style={{ paddingHorizontal: spacing(4) }}>
          {categorias.map((c) => (
            <FilaCategoria key={c.id} categoria={c} onCambio={onCambio} />
          ))}
        </View>
      )}
    </Tarjeta>
  );
}

function FilaCategoria({ categoria, onCambio }: { categoria: Categoria; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(categoria.nombre);
  const esPropia = categoria.usuarioId !== undefined;

  async function guardar() {
    if (!nombre.trim()) return;
    await actualizarCategoria(categoria.id, { nombre, color: categoria.color });
    setEditando(false);
    onCambio();
  }

  if (editando) {
    return (
      <View style={styles.filaEditar}>
        <Campo etiqueta="" value={nombre} onChangeText={setNombre} autoFocus style={{ flex: 1 }} />
        <Boton titulo="Guardar" variante="primario" onPress={guardar} />
        <Boton titulo="Cancelar" onPress={() => setEditando(false)} />
      </View>
    );
  }

  return (
    <View style={styles.fila}>
      <View style={[styles.punto, { backgroundColor: categoria.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.filaNombre}>{categoria.nombre}</Text>
        {!esPropia && <Text style={styles.filaGlobal}>Categoría global</Text>}
      </View>
      {esPropia && (
        <View style={{ flexDirection: "row", gap: spacing(2) }}>
          <Pressable onPress={() => setEditando(true)} hitSlop={8}>
            <Ionicons name="pencil-outline" size={18} color={color.textMuted} />
          </Pressable>
          <Pressable onPress={() => eliminarCategoria(categoria.id).then(onCambio)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={color.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  tituloCard: { fontSize: 15, fontWeight: "700", color: color.text },
  etiquetaColor: { fontSize: 13, fontWeight: "600", color: color.textMuted },
  paleta: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  swatch: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 2, borderColor: "transparent" },
  swatchActivo: { borderColor: color.text },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  filaEditar: { flexDirection: "row", alignItems: "center", gap: spacing(2), paddingVertical: spacing(2.5) },
  punto: { width: 10, height: 10, borderRadius: 5 },
  filaNombre: { fontSize: 14, fontWeight: "600", color: color.text },
  filaGlobal: { fontSize: 11, color: color.textMuted },
});
