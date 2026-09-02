import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  listarTransaccionesPendientes,
  listarCategorias,
  listarCuentas,
  marcarTransaccionDetectada,
  crearGasto,
  crearIngreso,
  mensajeError,
  ETIQUETA_BANCO,
  type TransaccionDetectada,
  type Categoria,
  type Cuenta,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import EstadoVacio from "../components/EstadoVacio";
import { color, spacing } from "../lib/theme";

export default function BandejaScreen() {
  const [items, setItems] = useState<TransaccionDetectada[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([listarTransaccionesPendientes(), listarCategorias(), listarCuentas()])
      .then(([t, c, cu]) => {
        setItems(t);
        setCategorias(c);
        setCuentas(cu);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
      {error && <ErrorTexto>{error}</ErrorTexto>}
      {!cargando && !error && items.length === 0 ? (
        <EstadoVacio
          icono="checkmark-done-outline"
          titulo="No hay nada pendiente de revisar"
          subtitulo="Los movimientos que la app detecte en tu correo van a aparecer acá."
        />
      ) : (
        items.map((item) => (
          <ItemBandeja key={item.id} item={item} categorias={categorias} cuentas={cuentas} onResuelto={cargar} />
        ))
      )}
    </ScrollView>
  );
}

function ItemBandeja({
  item,
  categorias,
  cuentas,
  onResuelto,
}: {
  item: TransaccionDetectada;
  categorias: Categoria[];
  cuentas: Cuenta[];
  onResuelto: () => void;
}) {
  const [monto, setMonto] = useState(String(item.monto));
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [categoriaId, setCategoriaId] = useState(item.categoriaId ?? "");
  const [cuentaId, setCuentaId] = useState(item.cuentaId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const categoriasDelTipo = categorias.filter((c) => c.tipo === item.tipo);

  async function confirmar() {
    setError(null);
    setGuardando(true);
    try {
      const datos = {
        monto: Number(monto),
        descripcion,
        categoriaId: categoriaId || undefined,
        cuentaId: cuentaId || undefined,
        fecha: item.fecha,
      };
      if (item.tipo === "gasto") {
        if (!categoriaId) throw new Error("Elegí una categoría antes de confirmar.");
        await crearGasto({ ...datos, categoriaId });
      } else {
        await crearIngreso(datos);
      }
      await marcarTransaccionDetectada(item.id, "confirmado");
      onResuelto();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function descartar() {
    setGuardando(true);
    try {
      await marcarTransaccionDetectada(item.id, "descartado");
      onResuelto();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <Text style={styles.tipo}>{item.tipo === "gasto" ? "Gasto detectado" : "Ingreso detectado"}</Text>
        <Text style={styles.fecha}>{item.fecha}</Text>
      </View>
      {item.correoAsunto && (
        <Text style={styles.asunto} numberOfLines={2}>
          “{item.correoAsunto}” {item.banco ? `· ${ETIQUETA_BANCO[item.banco]}` : ""}
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Campo etiqueta="Monto" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} style={{ flex: 1 }} />
        <Campo etiqueta="Descripción" value={descripcion} onChangeText={setDescripcion} style={{ flex: 2 }} />
      </View>

      <SelectorChips
        titulo="Categoría"
        valor={categoriaId}
        onCambiar={setCategoriaId}
        opciones={categoriasDelTipo.map((c) => ({ valor: c.id, etiqueta: c.nombre, color: c.color }))}
      />

      <SelectorChips
        titulo={cuentaId ? "Cuenta" : "Cuenta — no pude determinarla, elegila"}
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
      />

      {error && <ErrorTexto>{error}</ErrorTexto>}

      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Boton titulo="Confirmar" variante="primario" onPress={confirmar} disabled={guardando} style={{ flex: 1 }} />
        <Boton titulo="Descartar" variante="peligro" onPress={descartar} disabled={guardando} style={{ flex: 1 }} />
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  tipo: { fontSize: 15, fontWeight: "700", color: color.text },
  fecha: { fontSize: 12, color: color.textMuted },
  asunto: { fontSize: 12.5, color: color.textMuted, fontStyle: "italic" },
});
