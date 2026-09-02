import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  listarCuentas,
  crearCuenta,
  mensajeError,
  OPCIONES_BANCO,
  OPCIONES_MARCA,
  ETIQUETA_BANCO,
  ETIQUETA_MARCA,
  GRADIENTE_BANCO,
  type Cuenta,
  type Banco,
  type Marca,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import TarjetaVisual from "../../components/TarjetaVisual";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import EstadoVacio from "../../components/EstadoVacio";
import { color, spacing } from "../../lib/theme";

export default function TarjetasScreen() {
  const router = useRouter();
  const [tarjetas, setTarjetas] = useState<Cuenta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    listarCuentas()
      .then((todas) => setTarjetas(todas.filter((c) => c.tipo === "credito")))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">) {
    await crearCuenta(input);
    setMostrarForm(false);
    cargar();
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      {mostrarForm ? (
        <NuevaTarjeta onCrear={crearYCerrar} onCancelar={() => setMostrarForm(false)} />
      ) : (
        <Boton titulo="+ Agregar tarjeta" variante="primario" onPress={() => setMostrarForm(true)} />
      )}

      {!cargando && tarjetas.length === 0 ? (
        <EstadoVacio
          icono="card-outline"
          titulo="Todavía no agregaste tarjetas de crédito"
          subtitulo="Creá una arriba para empezar a controlar su cupo."
        />
      ) : (
        <View style={{ gap: spacing(3) }}>
          {tarjetas.map((t) => (
            <TarjetaVisual key={t.id} cuenta={t} onPress={() => router.push(`/tarjeta/${t.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NuevaTarjeta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [marca, setMarca] = useState<Marca>("visa");
  const [cupoTotal, setCupoTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la tarjeta.");
      return;
    }
    if (!cupoTotal || Number(cupoTotal) <= 0) {
      setError("Una tarjeta de crédito necesita un cupo total.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        nombre,
        tipo: "credito",
        banco,
        marca,
        cupoTotal: Number(cupoTotal),
        disponible: Number(cupoTotal),
      });
      setNombre("");
      setCupoTotal("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <Text style={styles.tituloCard}>Nueva tarjeta de crédito</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} />
      </View>
      <Campo etiqueta="Nombre" placeholder="Visa Clásica" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Cupo total" keyboardType="decimal-pad" value={cupoTotal} onChangeText={setCupoTotal} />
      <SelectorChips
        titulo="Banco"
        valor={banco}
        onCambiar={(v) => setBanco(v as Banco)}
        opciones={OPCIONES_BANCO.map((b) => ({ valor: b, etiqueta: ETIQUETA_BANCO[b], color: GRADIENTE_BANCO[b][0] }))}
      />
      <SelectorChips
        titulo="Marca"
        valor={marca}
        onCambiar={(v) => setMarca(v as Marca)}
        opciones={OPCIONES_MARCA.map((m) => ({ valor: m, etiqueta: ETIQUETA_MARCA[m] || "Otra" }))}
      />
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton titulo={guardando ? "Guardando…" : "Agregar"} variante="primario" onPress={agregar} disabled={guardando} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tituloCard: { fontSize: 15, fontWeight: "700", color: color.text },
});
