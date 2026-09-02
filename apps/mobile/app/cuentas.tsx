import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  listarCuentas,
  crearCuenta,
  mensajeError,
  OPCIONES_BANCO,
  COLOR_CUENTA_BANCO,
  ETIQUETA_BANCO,
  type Cuenta,
  type Banco,
  type TipoCuenta,
} from "core";
import Tarjeta from "../components/Tarjeta";
import TarjetaVisual from "../components/TarjetaVisual";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import EstadoVacio from "../components/EstadoVacio";
import { color, spacing } from "../lib/theme";

const OPCIONES_TIPO: { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: "ahorro", etiqueta: "Cuenta de ahorros" },
  { valor: "debito", etiqueta: "Tarjeta de débito" },
  { valor: "efectivo", etiqueta: "Efectivo" },
];

export default function CuentasScreen() {
  const router = useRouter();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    listarCuentas()
      .then((todas) => setCuentas(todas.filter((c) => c.tipo !== "credito")))
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
        <NuevaCuenta onCrear={crearYCerrar} onCancelar={() => setMostrarForm(false)} />
      ) : (
        <Boton titulo="+ Agregar cuenta" variante="primario" onPress={() => setMostrarForm(true)} />
      )}

      {!cargando && cuentas.length === 0 ? (
        <EstadoVacio
          icono="wallet-outline"
          titulo="Todavía no agregaste cuentas"
          subtitulo="Creá una arriba: ahorro, débito o efectivo, del banco que sea."
        />
      ) : (
        <View style={{ gap: spacing(3) }}>
          {cuentas.map((cuenta) => (
            <TarjetaVisual key={cuenta.id} cuenta={cuenta} onPress={() => router.push(`/cuenta/${cuenta.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NuevaCuenta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("ahorro");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la cuenta.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onCrear({ nombre, tipo, banco, disponible: Number(saldoInicial || 0) });
      setNombre("");
      setSaldoInicial("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <Text style={styles.tituloCard}>Nueva cuenta</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} />
      </View>
      <Campo etiqueta="Nombre" placeholder="Ahorros Pichincha" value={nombre} onChangeText={setNombre} />
      <SelectorChips
        titulo="Tipo"
        valor={tipo}
        onCambiar={(v) => setTipo(v as TipoCuenta)}
        opciones={OPCIONES_TIPO.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
      />
      <Campo etiqueta="Saldo inicial" keyboardType="decimal-pad" value={saldoInicial} onChangeText={setSaldoInicial} />
      <SelectorChips
        titulo="Banco"
        valor={banco}
        onCambiar={(v) => setBanco(v as Banco)}
        opciones={OPCIONES_BANCO.map((b) => ({ valor: b, etiqueta: ETIQUETA_BANCO[b], color: COLOR_CUENTA_BANCO[b] }))}
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
