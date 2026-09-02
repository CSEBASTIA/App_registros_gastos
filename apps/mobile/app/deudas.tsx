import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  listarDeudas,
  listarCuentas,
  listarIngresos,
  crearDeuda,
  registrarAbonoDeuda,
  eliminarDeuda,
  calcularEndeudamiento,
  mensajeError,
  type Deuda,
  type Cuenta,
  type TipoDeuda,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Campo from "../components/Campo";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import SelectorChips from "../components/SelectorChips";
import BarraProgreso from "../components/BarraProgreso";
import EstadoVacio from "../components/EstadoVacio";
import { color, radius, spacing } from "../lib/theme";

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const ETIQUETA_TIPO: Record<TipoDeuda, string> = {
  prestamo: "Préstamo",
  tarjeta: "Tarjeta",
  diferido: "Diferido",
  otro: "Otro",
};
const ETIQUETA_NIVEL = { bajo: "Bajo", moderado: "Moderado", alto: "Alto" };
const COLOR_NIVEL = { bajo: color.success, moderado: "#e0a53f", alto: color.danger };

export default function DeudasScreen() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [ingresoMensual, setIngresoMensual] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    Promise.all([listarDeudas(), listarCuentas(), listarIngresos()])
      .then(([d, c, i]) => {
        setDeudas(d);
        setCuentas(c);
        setIngresoMensual(i.filter((x) => x.fecha.startsWith(mesActual())).reduce((a, x) => a + x.monto, 0));
      })
      .catch((err) => setError(mensajeError(err)));
  }, []);

  useFocusEffect(cargar);

  const endeudamiento = calcularEndeudamiento(deudas, ingresoMensual);

  function confirmarEliminar(deuda: Deuda) {
    Alert.alert("Eliminar deuda", `¿Eliminar "${deuda.nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => eliminarDeuda(deuda.id).then(cargar) },
    ]);
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <Tarjeta>
        <View style={styles.resumenFila}>
          <View>
            <Text style={styles.etiqueta}>Saldo pendiente total</Text>
            <Text style={styles.valorGrande}>${endeudamiento.totalPendiente.toFixed(2)}</Text>
          </View>
          <View>
            <Text style={styles.etiqueta}>Cuotas mensuales</Text>
            <Text style={styles.valorGrande}>${endeudamiento.cuotasMensuales.toFixed(2)}</Text>
          </View>
        </View>
        <View style={{ gap: spacing(1.5) }}>
          <View style={styles.resumenFila}>
            <Text style={styles.etiqueta}>Nivel de endeudamiento</Text>
            <Text style={[styles.nivel, { color: COLOR_NIVEL[endeudamiento.nivel] }]}>
              {endeudamiento.porcentaje.toFixed(0)}% · {ETIQUETA_NIVEL[endeudamiento.nivel]}
            </Text>
          </View>
          <BarraProgreso porcentaje={endeudamiento.porcentaje} />
        </View>
      </Tarjeta>

      <NuevaDeuda cuentas={cuentas} onCreada={cargar} />

      {error && <ErrorTexto>{error}</ErrorTexto>}

      {deudas.length === 0 ? (
        <EstadoVacio
          icono="alert-circle-outline"
          titulo="No tenés deudas ni préstamos registrados"
          subtitulo="Cuando agregues una, vas a ver acá tu nivel de endeudamiento."
        />
      ) : (
        <View style={{ gap: spacing(3) }}>
          {deudas.map((d) => (
            <FilaDeuda key={d.id} deuda={d} onCambio={cargar} onEliminar={() => confirmarEliminar(d)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function FilaDeuda({ deuda, onCambio, onEliminar }: { deuda: Deuda; onCambio: () => void; onEliminar: () => void }) {
  const [abonando, setAbonando] = useState(false);
  const [monto, setMonto] = useState("");

  async function confirmar() {
    if (!monto) return;
    await registrarAbonoDeuda(deuda.id, Number(monto));
    setMonto("");
    setAbonando(false);
    onCambio();
  }

  return (
    <Tarjeta>
      <View style={styles.resumenFila}>
        <View style={{ flex: 1 }}>
          <Text style={styles.deudaNombre}>{deuda.nombre}</Text>
          {deuda.gastoId && <Text style={styles.etiquetaAuto}>Generada automáticamente</Text>}
        </View>
        <Text style={styles.tipoTexto}>{ETIQUETA_TIPO[deuda.tipo]}</Text>
      </View>
      <View style={styles.resumenFila}>
        <View>
          <Text style={styles.etiqueta}>Saldo pendiente</Text>
          <Text style={styles.valorMedio}>${deuda.saldoPendiente.toFixed(2)}</Text>
        </View>
        <View>
          <Text style={styles.etiqueta}>Cuota mensual</Text>
          <Text style={styles.valorMedio}>${deuda.cuotaMensual.toFixed(2)}</Text>
        </View>
      </View>
      {abonando ? (
        <View style={{ flexDirection: "row", gap: spacing(2), alignItems: "center" }}>
          <Campo etiqueta="" placeholder="Monto" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} style={{ flex: 1 }} />
          <Boton titulo="Abonar" variante="primario" onPress={confirmar} />
          <Boton titulo="Cancelar" onPress={() => setAbonando(false)} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing(2) }}>
          <Boton
            titulo="Registrar abono"
            style={{ flex: 1 }}
            onPress={() => setAbonando(true)}
            disabled={deuda.saldoPendiente <= 0}
          />
          <Boton titulo="Eliminar" variante="peligro" onPress={onEliminar} />
        </View>
      )}
    </Tarjeta>
  );
}

function NuevaDeuda({ cuentas, onCreada }: { cuentas: Cuenta[]; onCreada: () => void }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Exclude<TipoDeuda, "diferido">>("prestamo");
  const [montoTotal, setMontoTotal] = useState("");
  const [cuotaMensual, setCuotaMensual] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return <Boton titulo="+ Nueva deuda / préstamo" onPress={() => setAbierto(true)} />;
  }

  async function agregar() {
    if (!nombre.trim() || !montoTotal) {
      setError("Completá nombre y monto total.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await crearDeuda({
        nombre,
        tipo,
        montoTotal: Number(montoTotal),
        saldoPendiente: Number(montoTotal),
        cuotaMensual: Number(cuotaMensual || 0),
        fechaInicio: hoy(),
        cuentaId: cuentaId || undefined,
      });
      setNombre("");
      setMontoTotal("");
      setCuotaMensual("");
      setAbierto(false);
      onCreada();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.resumenFila}>
        <Text style={styles.deudaNombre}>Nueva deuda / préstamo</Text>
        <Boton titulo="Cancelar" onPress={() => setAbierto(false)} />
      </View>
      <Campo etiqueta="Nombre" placeholder="Préstamo carro" value={nombre} onChangeText={setNombre} />
      <SelectorChips
        titulo="Tipo"
        valor={tipo}
        onCambiar={(v) => setTipo(v as Exclude<TipoDeuda, "diferido">)}
        opciones={[
          { valor: "prestamo", etiqueta: "Préstamo" },
          { valor: "tarjeta", etiqueta: "Tarjeta" },
          { valor: "otro", etiqueta: "Otro" },
        ]}
      />
      <Campo etiqueta="Monto total" keyboardType="decimal-pad" value={montoTotal} onChangeText={setMontoTotal} />
      <Campo etiqueta="Cuota mensual" keyboardType="decimal-pad" value={cuotaMensual} onChangeText={setCuotaMensual} />
      <SelectorChips
        titulo="Cuenta asociada"
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
      />
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton titulo={guardando ? "Guardando…" : "Agregar"} variante="primario" onPress={agregar} disabled={guardando} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  resumenFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  etiqueta: { fontSize: 12, color: color.textMuted, fontWeight: "600" },
  valorGrande: { fontSize: 18, fontWeight: "800", color: color.text, marginTop: 2 },
  valorMedio: { fontSize: 15, fontWeight: "700", color: color.text, marginTop: 2 },
  nivel: { fontSize: 13, fontWeight: "700" },
  deudaNombre: { fontSize: 15, fontWeight: "700", color: color.text },
  etiquetaAuto: { fontSize: 11, color: "#b8790a", marginTop: 2 },
  tipoTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: color.textMuted,
    backgroundColor: color.bg,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
});
