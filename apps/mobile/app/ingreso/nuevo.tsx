import { useCallback, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { listarCategorias, listarCuentas, crearIngreso, mensajeError, type Categoria, type Cuenta } from "core";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import { color, spacing } from "../../lib/theme";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function NuevoIngreso() {
  const router = useRouter();
  const { cuentaId: cuentaIdInicial } = useLocalSearchParams<{ cuentaId?: string }>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listarCategorias(), listarCuentas()]).then(([c, cu]) => {
        setCategorias(c.filter((x) => x.tipo === "ingreso"));
        setCuentas(cu.filter((c) => c.tipo !== "credito"));
        if (cuentaIdInicial) setCuentaId(cuentaIdInicial);
      });
    }, [cuentaIdInicial])
  );

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";

  async function agregar() {
    setError(null);
    if (!monto || Number(monto) <= 0) {
      setError("El monto no puede ser un valor negativo.");
      return;
    }
    setGuardando(true);
    try {
      await crearIngreso({
        monto: Number(monto),
        descripcion: descripcion || categoriaSeleccionada?.nombre || "Ingreso",
        categoriaId: categoriaId || undefined,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        fecha,
      });
      router.back();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <Campo etiqueta="Monto" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} placeholder="0.00" />
      <Campo etiqueta="Descripción" placeholder="Sueldo, freelance…" value={descripcion} onChangeText={setDescripcion} />

      <SelectorChips
        titulo="Fuente"
        valor={categoriaId}
        onCambiar={setCategoriaId}
        opciones={[{ valor: "", etiqueta: "Sin especificar" }, ...categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre, color: c.color }))]}
      />
      {esOtros && (
        <Campo etiqueta="Detalle" value={categoriaDetalle} onChangeText={setCategoriaDetalle} placeholder="¿De dónde viene?" />
      )}

      <SelectorChips
        titulo="Cuenta destino"
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
      />

      <Campo etiqueta="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} placeholder="2026-08-31" />

      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton titulo={guardando ? "Guardando…" : "Agregar"} variante="primario" onPress={agregar} disabled={guardando} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
});
