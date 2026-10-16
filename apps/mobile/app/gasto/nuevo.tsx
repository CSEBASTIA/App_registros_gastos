import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  listarCategorias,
  listarCuentas,
  crearGasto,
  mensajeError,
  parsearMonto,
  calcularDiferido,
  sumarMeses,
  fechaLocal,
  ETIQUETA_METODO_PAGO,
  OPCIONES_METODO_PAGO,
  OPCIONES_MESES_DIFERIDO,
  ETIQUETA_BILLETERA,
  OPCIONES_BILLETERA,
  MENSAJE_SIN_UBICACION,
  billeteraCompatible,
  type Billetera,
  type Categoria,
  type Cuenta,
  type MetodoPago,
} from "core";
import { guardarUbicacionActiva, ubicacionParaNuevoGasto } from "../../lib/ubicacion";
import { avisar } from "../../lib/dialogo";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

// Fecha en la zona horaria del teléfono (toISOString es UTC: de noche en
// Ecuador ya daba el día siguiente).
const hoy = () => fechaLocal();

export default function NuevoGasto() {
  const [cargando, setCargando] = useState(true);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { cuentaId: cuentaIdInicial } = useLocalSearchParams<{
    cuentaId?: string;
  }>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | "">("");
  const [billetera, setBilletera] = useState<Billetera | "">("");
  const [conUbicacion, setConUbicacion] = useState(false);
  const [mesesDiferido, setMesesDiferido] = useState(3);
  const [tasaInteres, setTasaInteres] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      setError(null);
      Promise.all([listarCategorias(), listarCuentas()])
        .then(([c, cu]) => {
          setCategorias(c.filter((x) => x.tipo === "gasto"));
          setCuentas(cu);
          if (cuentaIdInicial) setCuentaId(cuentaIdInicial);
        })
        .catch((err) => setError(mensajeError(err)))
        .finally(() => setCargando(false));
      guardarUbicacionActiva().then(setConUbicacion).catch(() => setConUbicacion(false));
    }, [cuentaIdInicial]),
  );

  function cambiarMetodo(valor: MetodoPago | "") {
    setMetodoPago(valor);
    // Apple Pay y Google Wallet pagan con tarjeta: con efectivo o transferencia no aplican.
    if (!billeteraCompatible(valor)) setBilletera("");
  }

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";
  const esDiferido = metodoPago === "diferido";
  const cuentaSeleccionada = cuentas.find((c) => c.id === cuentaId);
  const montoNumerico = parsearMonto(monto);
  const tasaNumerica = tasaInteres.trim() ? parsearMonto(tasaInteres) : 0;
  const cupoInsuficiente = cuentaSeleccionada?.tipo === "credito" &&
    Number.isFinite(montoNumerico) && montoNumerico > cuentaSeleccionada.disponible;
  const plan = esDiferido && montoNumerico > 0 &&
    Number.isFinite(tasaNumerica) && tasaNumerica >= 0 && tasaNumerica <= 999.99
    ? calcularDiferido(montoNumerico, mesesDiferido, tasaNumerica) : null;

  async function agregar() {
    setError(null);
    if (!(montoNumerico > 0)) {
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
    if (esDiferido && cuentaSeleccionada?.tipo !== "credito") {
      setError("Elegí una tarjeta de crédito para el diferido.");
      return;
    }
    if (esDiferido && (!Number.isFinite(tasaNumerica) || tasaNumerica < 0 || tasaNumerica > 999.99)) {
      setError("Escribí una tasa anual válida entre 0 y 999,99 %.");
      return;
    }
    if (cupoInsuficiente) {
      setError(`El monto supera el cupo disponible de la tarjeta ($${cuentaSeleccionada!.disponible.toFixed(2)}).`);
      return;
    }
    setGuardando(true);
    try {
      // Nunca lanza ni pide permiso, y espera como mucho 8 s al GPS.
      const lugar = await ubicacionParaNuevoGasto();
      await crearGasto({
        monto: montoNumerico,
        descripcion: descripcion || categoriaSeleccionada?.nombre || "Gasto",
        categoriaId,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        metodoPago: metodoPago || undefined,
        mesesDiferido: esDiferido ? mesesDiferido : undefined,
        tasaInteres: esDiferido && tasaInteres.trim() ? tasaNumerica : undefined,
        billetera: billetera || undefined,
        ubicacion: lugar.ubicacion,
        fecha,
      });
      const aviso = lugar.motivo ? MENSAJE_SIN_UBICACION[lugar.motivo] : undefined;
      // El gasto ya se guardó: es un aviso, no un error.
      if (aviso) await avisar("Gasto guardado", aviso);
      router.back();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

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
            Nuevo gasto
          </Text>
          <Text style={styles.screenIntro}>
            Completá los datos de tu movimiento.
          </Text>
        </BlurFade>
        <Campo
          etiqueta="Monto"
          keyboardType="decimal-pad"
          value={monto}
          onChangeText={setMonto}
          placeholder="0.00"
        />
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
          opciones={categorias.map((c) => ({
            valor: c.id,
            etiqueta: c.nombre,
            color: c.color,
          }))}
        />
        {esOtros && (
          <Campo
            etiqueta="¿Qué fue?"
            value={categoriaDetalle}
            onChangeText={setCategoriaDetalle}
            placeholder="Medicamentos"
          />
        )}

        <SelectorChips
          titulo="Cuenta / tarjeta"
          valor={cuentaId}
          onCambiar={setCuentaId}
          opciones={[
            { valor: "", etiqueta: "Sin asignar" },
            ...cuentas.filter((c) => !esDiferido || c.tipo === "credito")
              .map((c) => ({ valor: c.id, etiqueta: c.nombre })),
          ]}
        />

        <SelectorChips
          titulo="Método de pago"
          valor={metodoPago}
          onCambiar={(v) => cambiarMetodo(v as MetodoPago | "")}
          opciones={[
            { valor: "", etiqueta: "Sin especificar" },
            ...OPCIONES_METODO_PAGO.map((m) => ({
              valor: m,
              etiqueta: ETIQUETA_METODO_PAGO[m],
            })),
          ]}
        />

        {billeteraCompatible(metodoPago) && (
          <SelectorChips
            titulo="Pagado con"
            valor={billetera}
            onCambiar={(v) => setBilletera(v as Billetera | "")}
            opciones={[
              { valor: "", etiqueta: "Tarjeta" },
              ...OPCIONES_BILLETERA.map((b) => ({ valor: b, etiqueta: ETIQUETA_BILLETERA[b] })),
            ]}
          />
        )}

        {esDiferido && (
          <>
            <SelectorChips
              titulo="A cuántos meses"
              valor={String(mesesDiferido)}
              onCambiar={(v) => setMesesDiferido(Number(v))}
              opciones={OPCIONES_MESES_DIFERIDO.map((m) => ({
                valor: String(m),
                etiqueta: `${m} meses`,
              }))}
            />
            <Campo
              etiqueta="Tasa de interés anual (%)"
              keyboardType="decimal-pad"
              value={tasaInteres}
              onChangeText={setTasaInteres}
              placeholder="0 si no hay interés"
            />
            {cuentaSeleccionada?.tipo === "credito" && (
              <Text style={styles.ayudaTexto}>
                Cupo disponible: ${cuentaSeleccionada.disponible.toFixed(2)}. La compra ocupa el monto completo.
              </Text>
            )}
            {plan && (
              <View style={styles.ayuda}>
                <Text style={styles.ayudaTexto}>
                  Cuota estimada: ${plan.cuotaMensual.toFixed(2)} al mes.
                  {"\n"}Primera cuota pendiente el {fecha}: ${plan.primeraCuota.total.toFixed(2)}
                  {" "}(capital ${plan.primeraCuota.capital.toFixed(2)} + interés ${plan.primeraCuota.interes.toFixed(2)}).
                  {"\n"}Interés total estimado: ${plan.interesTotal.toFixed(2)} · total a pagar: ${plan.totalEstimado.toFixed(2)}.
                  {"\n"}Última cuota: {sumarMeses(fecha, mesesDiferido - 1)}.
                  {!tasaInteres.trim() && " Tasa no indicada: esta estimación no incluye intereses."}
                </Text>
              </View>
            )}
            {cupoInsuficiente && (
              <ErrorTexto>El monto supera el cupo disponible de esta tarjeta.</ErrorTexto>
            )}
          </>
        )}

        <Campo
          etiqueta="Fecha (AAAA-MM-DD)"
          value={fecha}
          onChangeText={setFecha}
          placeholder="2026-08-31"
        />

        {conUbicacion && (
          <Text style={styles.ayudaTexto}>Se guardará dónde haces este pago (puedes apagarlo en Más → Ubicación de mis pagos).</Text>
        )}

        {error && <ErrorTexto>{error}</ErrorTexto>}
        <Boton
          titulo={guardando ? "Guardando…" : "Agregar"}
          variante="primario"
          onPress={agregar}
          loading={guardando}
          disabled={guardando}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
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
    ayuda: { backgroundColor: color.bg, borderRadius: 8, padding: spacing(3) },
    ayudaTexto: {
      fontFamily: font.body,
      fontSize: 12,
      color: color.textMuted,
      lineHeight: 18,
    },
  });
