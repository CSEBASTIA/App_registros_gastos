import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  listarCategorias,
  listarCuentas,
  crearGasto,
  mensajeError,
  sumarMeses,
  ETIQUETA_METODO_PAGO,
  OPCIONES_METODO_PAGO,
  OPCIONES_MESES_DIFERIDO,
  type Categoria,
  type Cuenta,
  type MetodoPago,
} from "core";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import { color, spacing } from "../../lib/theme";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function NuevoGasto() {
  const router = useRouter();
  const { cuentaId: cuentaIdInicial } = useLocalSearchParams<{ cuentaId?: string }>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | "">("");
  const [mesesDiferido, setMesesDiferido] = useState(3);
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listarCategorias(), listarCuentas()]).then(([c, cu]) => {
        setCategorias(c.filter((x) => x.tipo === "gasto"));
        setCuentas(cu);
        if (cuentaIdInicial) setCuentaId(cuentaIdInicial);
      });
    }, [cuentaIdInicial])
  );

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";
  const esDiferido = metodoPago === "diferido";

  async function agregar() {
    setError(null);
    if (!monto || Number(monto) <= 0) {
      setError("El monto no puede ser un valor negativo.");
      return;
    }
    if (!categoriaId) {
      setError("Elegí una categoría.");
      return;
    }
    if (esOtros && !categoriaDetalle.trim()) {
      setError("Contanos qué fue (categoría Otros).");
      return;
    }
    setGuardando(true);
    try {
      await crearGasto({
        monto: Number(monto),
        descripcion: descripcion || categoriaSeleccionada?.nombre || "Gasto",
        categoriaId,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        metodoPago: metodoPago || undefined,
        mesesDiferido: esDiferido ? mesesDiferido : undefined,
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
      <Campo
        etiqueta="Descripción"
        placeholder="Pago de la casa de Calceta"
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={40}
      />

      <SelectorChips
        titulo="Categoría"
        valor={categoriaId}
        onCambiar={setCategoriaId}
        opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre, color: c.color }))}
      />
      {esOtros && (
        <Campo etiqueta="¿Qué fue?" value={categoriaDetalle} onChangeText={setCategoriaDetalle} placeholder="Medicamentos" />
      )}

      <SelectorChips
        titulo="Cuenta / tarjeta"
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
      />

      <SelectorChips
        titulo="Método de pago"
        valor={metodoPago}
        onCambiar={(v) => setMetodoPago(v as MetodoPago)}
        opciones={[
          { valor: "", etiqueta: "Sin especificar" },
          ...OPCIONES_METODO_PAGO.map((m) => ({ valor: m, etiqueta: ETIQUETA_METODO_PAGO[m] })),
        ]}
      />

      {esDiferido && (
        <>
          <SelectorChips
            titulo="A cuántos meses"
            valor={String(mesesDiferido)}
            onCambiar={(v) => setMesesDiferido(Number(v))}
            opciones={OPCIONES_MESES_DIFERIDO.map((m) => ({ valor: String(m), etiqueta: `${m} meses` }))}
          />
          {monto && Number(monto) > 0 && (
            <View style={styles.ayuda}>
              <Text style={styles.ayudaTexto}>
                ${(Number(monto) / mesesDiferido).toFixed(2)}/mes · termina el {sumarMeses(fecha, mesesDiferido)} · esto
                crea una deuda automáticamente.
              </Text>
            </View>
          )}
        </>
      )}

      <Campo etiqueta="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} placeholder="2026-08-31" />

      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton titulo={guardando ? "Guardando…" : "Agregar"} variante="primario" onPress={agregar} disabled={guardando} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  ayuda: { backgroundColor: color.bg, borderRadius: 8, padding: spacing(3) },
  ayudaTexto: { fontSize: 12, color: color.textMuted, lineHeight: 18 },
});
