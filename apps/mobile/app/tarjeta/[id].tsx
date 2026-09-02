import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  listarCuentas,
  listarGastos,
  listarIngresos,
  listarPagosTarjeta,
  listarCategorias,
  eliminarCuenta,
  registrarPagoTarjeta,
  movimientosDe,
  mensajeError,
  formatMonto,
  type Cuenta,
  type Gasto,
  type Ingreso,
  type PagoTarjeta,
  type Categoria,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import TarjetaVisual from "../../components/TarjetaVisual";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import ItemMovimiento from "../../components/ItemMovimiento";
import EstadoVacio from "../../components/EstadoVacio";
import { color, spacing } from "../../lib/theme";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function DetalleTarjeta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [pagos, setPagos] = useState<PagoTarjeta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    Promise.all([listarCuentas(), listarGastos(), listarIngresos(), listarPagosTarjeta(), listarCategorias()])
      .then(([todas, g, i, p, c]) => {
        setCuenta(todas.find((c) => c.id === id) ?? null);
        setCuentas(todas);
        setGastos(g);
        setIngresos(i);
        setPagos(p);
        setCategorias(c);
      })
      .catch((err) => setError(mensajeError(err)));
  }, [id]);

  useFocusEffect(cargar);

  if (!cuenta) return null;

  const movimientos = movimientosDe(cuenta.id, gastos, pagos, ingresos, categorias).slice(0, 30);
  const cuentasOrigen = cuentas.filter((c) => c.tipo === "ahorro" || c.tipo === "debito");

  function confirmarEliminar() {
    Alert.alert("Eliminar tarjeta", `¿Eliminar "${cuenta!.nombre}"? Esto no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarCuenta(cuenta!.id);
            router.back();
          } catch (err) {
            setError(mensajeError(err));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <TarjetaVisual cuenta={cuenta} />

      <PagarTarjeta
        cuentaId={cuenta.id}
        cuentasOrigen={cuentasOrigen}
        onPagado={cargar}
        onError={setError}
      />
      <Boton
        titulo="Registrar gasto"
        onPress={() => router.push({ pathname: "/gasto/nuevo", params: { cuentaId: cuenta.id } })}
      />
      <Boton titulo="Eliminar tarjeta" variante="peligro" onPress={confirmarEliminar} />

      {error && <ErrorTexto>{error}</ErrorTexto>}

      <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
        <Text style={[styles.titulo, { paddingHorizontal: spacing(4) }]}>Movimientos</Text>
        {movimientos.length === 0 ? (
          <EstadoVacio icono="document-text-outline" titulo="Todavía no hay movimientos" subtitulo="Registrá un gasto o un pago." />
        ) : (
          <View style={{ paddingHorizontal: spacing(4) }}>
            {movimientos.map((item) => (
              <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
            ))}
          </View>
        )}
      </Tarjeta>
    </ScrollView>
  );
}

function PagarTarjeta({
  cuentaId,
  cuentasOrigen,
  onPagado,
  onError,
}: {
  cuentaId: string;
  cuentasOrigen: Cuenta[];
  onPagado: () => void;
  onError: (msg: string) => void;
}) {
  const [monto, setMonto] = useState("");
  const [cuentaOrigenId, setCuentaOrigenId] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!monto || Number(monto) <= 0) return;
    setGuardando(true);
    try {
      await registrarPagoTarjeta({
        cuentaId,
        cuentaOrigenId: cuentaOrigenId || undefined,
        monto: Number(monto),
        fecha: hoy(),
      });
      setMonto("");
      onPagado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <Text style={styles.titulo}>Registrar pago</Text>
      <SelectorChips
        titulo="Pagar desde"
        valor={cuentaOrigenId}
        onCambiar={setCuentaOrigenId}
        opciones={[{ valor: "", etiqueta: "Sin especificar" }, ...cuentasOrigen.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
      />
      <Campo etiqueta="Monto" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} placeholder="0.00" />
      <Boton titulo={guardando ? "Pagando…" : "Pagar"} variante="primario" onPress={confirmar} disabled={guardando} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  titulo: { fontSize: 15, fontWeight: "700", color: color.text },
});
