import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
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
  parsearMonto,
  formatMonto,
  type Cuenta,
  type Gasto,
  type Ingreso,
  type PagoTarjeta,
  type Categoria,
  fechaLocal,
  actualizarFechasTarjeta,
  cicloTarjeta,
  sumarMontos,
  textoDias,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import TarjetaVisual from "../../components/TarjetaVisual";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import ItemMovimiento from "../../components/ItemMovimiento";
import EstadoVacio from "../../components/EstadoVacio";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

function hoy() {
  return fechaLocal(); // zona horaria del teléfono, no UTC
}

export default function DetalleTarjeta() {
  const [cargando, setCargando] = useState(true);
  const { color } = useTheme();
  const styles = createStyles(color);
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
    setCargando(true);
    setError(null);
    Promise.all([
      listarCuentas(),
      listarGastos(),
      listarIngresos(),
      listarPagosTarjeta(),
      listarCategorias(),
    ])
      .then(([todas, g, i, p, c]) => {
        setCuenta(todas.find((c) => c.id === id) ?? null);
        setCuentas(todas);
        setGastos(g);
        setIngresos(i);
        setPagos(p);
        setCategorias(c);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, [id]);

  useFocusEffect(cargar);

  if (cargando)
    return (
      <View
        style={[
          styles.contenedor,
          {
            alignItems: "center",
            justifyContent: "center",
            padding: spacing(6),
            gap: spacing(3),
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator
          color={color.primary}
          accessibilityLabel="Cargando"
        />
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 14,
            color: color.textMuted,
          }}
        >
          Cargando tus datos…
        </Text>
      </View>
    );

  if (!cuenta)
    return (
      <View style={[styles.contenedor, { padding: spacing(5) }]}>
        {error ? (
          <ErrorTexto>{error}</ErrorTexto>
        ) : (
          <EstadoVacio
            icono="wallet-outline"
            titulo="No encontramos esta cuenta"
            subtitulo="Volvé a la lista para elegir otra cuenta."
          />
        )}
      </View>
    );

  const movimientos = movimientosDe(
    cuenta.id,
    gastos,
    pagos,
    ingresos,
    categorias,
  ).slice(0, 30);
  const cuentasOrigen = cuentas.filter(
    (c) => c.tipo === "ahorro" || c.tipo === "debito",
  );

  function confirmarEliminar() {
    Alert.alert(
      "Eliminar tarjeta",
      `¿Eliminar "${cuenta!.nombre}"? Esto no se puede deshacer.`,
      [
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
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.contenedor}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: spacing(5),
          paddingBottom: spacing(8),
          gap: spacing(4),
        }}
      >
        <BlurFade style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.screenTitle}>
            Detalle de tarjeta
          </Text>
          <Text style={styles.screenIntro}>
            Saldo y movimientos de tu cuenta.
          </Text>
        </BlurFade>
        <TarjetaVisual cuenta={cuenta} />
        {cuenta.tipo === "credito" && <CicloDeTarjeta cuenta={cuenta} gastos={gastos} onGuardado={cargar} />}

        <PagarTarjeta
          cuentaId={cuenta.id}
          cuentasOrigen={cuentasOrigen}
          onPagado={cargar}
          onError={setError}
        />
        <Boton
          titulo="Registrar gasto"
          onPress={() =>
            router.push({
              pathname: "/gasto/nuevo",
              params: { cuentaId: cuenta.id },
            })
          }
        />
        <Boton
          titulo="Importar estado de cuenta"
          onPress={() => router.push({ pathname: "/importar-estado", params: { cuentaId: cuenta.id } })}
        />
        <Boton
          titulo="Eliminar tarjeta"
          variante="peligro"
          onPress={confirmarEliminar}
        />

        {error && <ErrorTexto>{error}</ErrorTexto>}

        <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
          <Text style={[styles.titulo, { paddingHorizontal: spacing(4) }]}>
            Movimientos
          </Text>
          {movimientos.length === 0 ? (
            <EstadoVacio
              icono="document-text-outline"
              titulo="Todavía no hay movimientos"
              subtitulo="Registrá un gasto o un pago."
            />
          ) : (
            <View style={{ paddingHorizontal: spacing(4) }}>
              {movimientos.map((item) => (
                <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
              ))}
            </View>
          )}
        </Tarjeta>
      </ScrollView>
    </KeyboardAvoidingView>
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
  const { color } = useTheme();
  const styles = createStyles(color);
  const [monto, setMonto] = useState("");
  const [cuentaOrigenId, setCuentaOrigenId] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!(parsearMonto(monto) > 0)) return;
    setGuardando(true);
    try {
      await registrarPagoTarjeta({
        cuentaId,
        cuentaOrigenId: cuentaOrigenId || undefined,
        monto: parsearMonto(monto),
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
      <Text accessibilityRole="header" style={styles.titulo}>
        Registrar pago
      </Text>
      <SelectorChips
        titulo="Pagar desde"
        valor={cuentaOrigenId}
        onCambiar={setCuentaOrigenId}
        opciones={[
          { valor: "", etiqueta: "Sin especificar" },
          ...cuentasOrigen.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
        ]}
      />
      <Campo
        etiqueta="Monto"
        keyboardType="decimal-pad"
        value={monto}
        onChangeText={setMonto}
        placeholder="0.00"
      />
      <Boton
        titulo={guardando ? "Pagando…" : "Pagar"}
        variante="primario"
        onPress={confirmar}
        loading={guardando}
        disabled={guardando}
      />
    </Tarjeta>
  );
}

/** Ciclo de facturación: cuándo corta, cuándo se paga y cuánto lleva el ciclo; editar los días. */
function CicloDeTarjeta({ cuenta, gastos, onGuardado }: { cuenta: Cuenta; gastos: Gasto[]; onGuardado: () => void }) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [editando, setEditando] = useState(false);
  const [diaCorte, setDiaCorte] = useState(cuenta.diaCorte ? String(cuenta.diaCorte) : "");
  const [diaPago, setDiaPago] = useState(cuenta.diaPago ? String(cuenta.diaPago) : "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const ciclo = cuenta.diaCorte ? cicloTarjeta(cuenta.diaCorte, hoy(), cuenta.diaPago) : undefined;
  const consumoCiclo = ciclo
    ? sumarMontos(gastos.filter((g) => g.cuentaId === cuenta.id && g.fecha >= ciclo.inicio && g.fecha <= ciclo.corte).map((g) => g.monto))
    : 0;

  async function guardar() {
    const leer = (t: string) => (t.trim() ? Number(t.trim()) : null);
    const corte = leer(diaCorte);
    const pago = leer(diaPago);
    const valido = (n: number | null) => n === null || (Number.isInteger(n) && n >= 1 && n <= 31);
    if (!valido(corte) || !valido(pago)) {
      setError("El día de corte y el de pago van de 1 a 31.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await actualizarFechasTarjeta(cuenta.id, { diaCorte: corte, diaPago: pago });
      setEditando(false);
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <Text style={styles.tituloCiclo}>Corte y pago</Text>
      {ciclo ? (
        <>
          <Text style={styles.textoCiclo}>
            Corta {textoDias(ciclo.diasHastaCorte)} ({ciclo.corte})
            {ciclo.pago ? ` · paga hasta el ${ciclo.pago}${ciclo.diasHastaPago !== undefined ? ` (${textoDias(ciclo.diasHastaPago)})` : ""}` : ""}.
          </Text>
          <Text style={styles.textoCiclo}>
            Consumos de este ciclo (desde el {ciclo.inicio}): {formatMonto(consumoCiclo)}. Lo que gastes después del corte se cobra en el siguiente estado de cuenta.
          </Text>
        </>
      ) : (
        <Text style={styles.textoCiclo}>Agrega el día de corte para saber cuándo corta tu tarjeta y cuánto lleva el ciclo.</Text>
      )}
      {editando ? (
        <>
          <View style={{ flexDirection: "row", gap: spacing(3) }}>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Día de corte" placeholder="15" keyboardType="number-pad" maxLength={2} value={diaCorte} onChangeText={setDiaCorte} />
            </View>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Día de pago" placeholder="30" keyboardType="number-pad" maxLength={2} value={diaPago} onChangeText={setDiaPago} />
            </View>
          </View>
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <Boton titulo={guardando ? "Guardando…" : "Guardar"} variante="primario" onPress={guardar} loading={guardando} disabled={guardando} />
        </>
      ) : (
        <Boton titulo={cuenta.diaCorte ? "Cambiar fechas" : "Agregar fecha de corte"} onPress={() => setEditando(true)} />
      )}
    </Tarjeta>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    tituloCiclo: { fontFamily: font.display, fontSize: 18, color: color.text },
    textoCiclo: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
    screenTitle: {
      fontFamily: font.display,
      fontSize: 30,
      lineHeight: 36,
      color: color.text,
    },
    screenIntro: {
      fontFamily: font.body,
      fontSize: 14,
      lineHeight: 21,
      color: color.textMuted,
    },
    contenedor: { flex: 1, backgroundColor: color.bg },
    titulo: { fontFamily: font.display, fontSize: 15, color: color.text },
  });
