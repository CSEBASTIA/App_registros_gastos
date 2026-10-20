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
import { useFocusEffect } from "expo-router";
import {
  listarTransaccionesPendientes,
  listarCategorias,
  listarCuentas,
  marcarTransaccionDetectada,
  confirmarTransaccionDetectada,
  confirmarAvisoComoTransferencia,
  confirmarAvisoComoPagoTarjeta,
  mensajeError,
  parsearMonto,
  ETIQUETA_BANCO,
  ETIQUETA_ORIGEN_TRANSACCION,
  filasDetalleAviso,
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
import { spacing, useTheme, font, type Colors } from "../lib/theme";
import { BlurFade } from "../components/Motion";
import { Ionicons } from "@expo/vector-icons";
import { abrirEnMapas } from "../lib/ubicacion";
import IslaDetalle from "../components/IslaDetalle";
import { avisarPresupuestos, sincronizarNotificaciones } from "../lib/notificaciones";

export default function BandejaScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [items, setItems] = useState<TransaccionDetectada[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([
      listarTransaccionesPendientes(),
      listarCategorias(),
      listarCuentas(),
    ])
      .then(([t, c, cu]) => {
        setItems(t);
        setCategorias(c);
        setCuentas(cu);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      // Al salir, el aviso «tienes N movimientos por confirmar» se reprograma.
      return () => {
        sincronizarNotificaciones();
      };
    }, [cargar]),
  );

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
          gap: spacing(3),
        }}
      >
        <BlurFade style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.screenTitle}>
            Bandeja de revisión
          </Text>
          <Text style={styles.screenIntro}>
            Revisá cada movimiento antes de confirmarlo.
          </Text>
        </BlurFade>
        {error && <ErrorTexto>{error}</ErrorTexto>}
        {!cargando && !error && items.length === 0 ? (
          <EstadoVacio
            icono="checkmark-done-outline"
            titulo="No hay nada pendiente de revisar"
            subtitulo="Los movimientos que la app detecte en tu correo o en tus pagos con Apple Pay o Google Wallet van a aparecer aquí. Los pagos con una tarjeta que reconoce por sus últimos dígitos se registran solos."
          />
        ) : (
          items.map((item) => (
            <ItemBandeja
              key={item.id}
              item={item}
              categorias={categorias}
              cuentas={cuentas}
              onResuelto={cargar}
            />
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  const { color } = useTheme();
  const styles = createStyles(color);
  const [monto, setMonto] = useState(String(item.monto));
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [categoriaId, setCategoriaId] = useState(item.categoriaId ?? "");
  const [cuentaId, setCuentaId] = useState(item.cuentaId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [verDetalle, setVerDetalle] = useState(false);
  // Un aviso del correo puede ser una transferencia entre cuentas propias.
  const [comoTransferencia, setComoTransferencia] = useState(false);
  const [otraCuentaId, setOtraCuentaId] = useState(item.contraparteCuentaId ?? "");
  // Un pago de tarjeta: qué tarjeta se pagó y desde qué cuenta salió el dinero.
  const esPagoTarjeta = item.clase === "pago_tarjeta";
  const tarjetas = cuentas.filter((c) => c.tipo === "credito");
  const cuentasConSaldo = cuentas.filter((c) => c.tipo !== "credito");

  async function confirmarPagoTarjeta() {
    setError(null);
    if (!cuentaId || !otraCuentaId) {
      setError("Elige la tarjeta que pagaste y la cuenta desde la que pagaste.");
      return;
    }
    setGuardando(true);
    try {
      // Sube el cupo de la tarjeta y baja la cuenta de origen; si el mismo pago llegó en otro correo, se resuelve junto.
      await confirmarAvisoComoPagoTarjeta(item.id, { tarjetaId: cuentaId, origenId: otraCuentaId, monto: parsearMonto(monto) });
      onResuelto();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const categoriasDelTipo = categorias.filter((c) => c.tipo === item.tipo);
  // Si salió de esta cuenta, la otra recibe (no puede ser una tarjeta de crédito: eso es «Pagar tarjeta»).
  const otrasCuentas = cuentas.filter(
    (c) => c.id !== cuentaId && (item.tipo === "ingreso" || c.tipo !== "credito"),
  );

  async function confirmarTransferencia() {
    setError(null);
    if (!cuentaId || !otraCuentaId) {
      setError("Elige las dos cuentas de la transferencia.");
      return;
    }
    setGuardando(true);
    try {
      // Si la otra mitad (el aviso de la otra cuenta) está en la bandeja, se resuelve junto.
      await confirmarAvisoComoTransferencia(item.id, {
        cuentaId,
        otraCuentaId,
        monto: parsearMonto(monto),
        descripcion: descripcion.trim() || undefined,
      });
      onResuelto();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmar() {
    setError(null);
    setGuardando(true);
    try {
      if (item.tipo === "gasto" && !categoriaId)
        throw new Error("Elegí una categoría antes de confirmar.");
      // Un solo paso en la base: crea el gasto/ingreso y marca el aviso
      // juntos, así reintentar tras un error de red nunca lo duplica.
      await confirmarTransaccionDetectada(item.id, {
        monto: parsearMonto(monto),
        descripcion,
        categoriaId: categoriaId || undefined,
        cuentaId: cuentaId || undefined,
      });
      if (item.tipo === "gasto") avisarPresupuestos(item.fecha);
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
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(1.5), flexShrink: 1 }}>
          <Ionicons
            name={item.origen === "correo" ? "mail-outline" : "phone-portrait-outline"}
            size={16}
            color={color.primary}
            accessibilityLabel={ETIQUETA_ORIGEN_TRANSACCION[item.origen]}
          />
          <Text style={styles.tipo}>
            {esPagoTarjeta ? "Pago de tarjeta detectado" : item.tipo === "gasto" ? "Gasto detectado" : "Ingreso detectado"} ·{" "}
            {ETIQUETA_ORIGEN_TRANSACCION[item.origen]}
          </Text>
        </View>
        <Text style={styles.fecha}>{item.fecha}</Text>
      </View>
      <Boton titulo="Ver detalles (id, hora, lugar)" onPress={() => setVerDetalle(true)} />
      {verDetalle && (
        <IslaDetalle
          visible
          onCerrar={() => setVerDetalle(false)}
          icono={item.origen === "correo" ? "mail-outline" : "phone-portrait-outline"}
          titulo={item.comercio ?? item.descripcion}
          monto={`$${item.monto.toFixed(2)}`}
          filas={filasDetalleAviso(item, { cuenta: cuentas.find((c) => c.id === item.cuentaId) })}
          ubicacion={item.ubicacion}
          onAbrirMapa={() => item.ubicacion && abrirEnMapas(item.ubicacion).catch(() => undefined)}
          sinUbicacion={
            item.origen === "google_wallet"
              ? "Los pagos con Google Wallet llegan sin ubicación (con la app cerrada, el teléfono no puede leerla). Al confirmarlo, si ya tienes un lugar con el nombre del comercio, se asigna a ese lugar."
              : item.origen === "apple_pay"
                ? "Este pago llegó sin ubicación (el atajo no la incluyó)."
                : undefined
          }
        />
      )}
      {item.comercio && (
        <Text style={styles.asunto} numberOfLines={2}>
          {item.comercio}
          {item.banco ? ` · ${ETIQUETA_BANCO[item.banco]}` : ""}
          {item.tarjetaFinal ? ` · ••${item.tarjetaFinal}` : ""}
        </Text>
      )}
      {item.ubicacion && (
        <Boton titulo="Abrir en Mapas" onPress={() => abrirEnMapas(item.ubicacion!).catch(() => undefined)} />
      )}
      {item.correoAsunto && (
        <Text style={styles.asunto} numberOfLines={2}>
          “{item.correoAsunto}”{" "}
          {item.banco ? `· ${ETIQUETA_BANCO[item.banco]}` : ""}
        </Text>
      )}

      <View style={{ gap: spacing(3) }}>
        <Campo
          etiqueta="Monto"
          keyboardType="decimal-pad"
          value={monto}
          onChangeText={setMonto}
        />
        <Campo
          etiqueta="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
        />
      </View>

      {item.origen === "correo" && item.esTransferencia && !comoTransferencia && (
        <Text style={styles.pista}>
          Parece una transferencia. Si fue entre tus cuentas, márcala así para que no cuente como {item.tipo}.
        </Text>
      )}
      {!!item.comision && (
        <Text style={styles.pista}>
          El banco cobró además una comisión de ${item.comision.toFixed(2)}: es un gasto aparte (regístralo si quieres llevarlo).
        </Text>
      )}

      {esPagoTarjeta ? (
        <>
          <Text style={styles.pista}>
            Es un pago a tu tarjeta de crédito: sube su cupo y baja la cuenta desde la que pagaste. No cuenta como gasto.
          </Text>
          <SelectorChips
            titulo={cuentaId ? "Tarjeta que pagaste" : "Tarjeta que pagaste — no pude reconocerla, elígela"}
            valor={tarjetas.some((c) => c.id === cuentaId) ? cuentaId : ""}
            onCambiar={setCuentaId}
            opciones={tarjetas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          />
          <SelectorChips
            titulo="Pagada desde"
            valor={otraCuentaId}
            onCambiar={setOtraCuentaId}
            opciones={cuentasConSaldo.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          />
          {error && <ErrorTexto>{error}</ErrorTexto>}
          <View style={{ flexDirection: "row", gap: spacing(2) }}>
            <Boton
              titulo="Confirmar pago"
              variante="primario"
              onPress={confirmarPagoTarjeta}
              loading={guardando}
              disabled={guardando}
              style={{ flex: 1 }}
            />
            <Boton titulo="Descartar" variante="peligro" onPress={descartar} loading={guardando} disabled={guardando} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
      <>
      {!comoTransferencia && (
        <SelectorChips
          titulo="Categoría"
          valor={categoriaId}
          onCambiar={setCategoriaId}
          opciones={categoriasDelTipo.map((c) => ({
            valor: c.id,
            etiqueta: c.nombre,
            color: c.color,
          }))}
        />
      )}

      <SelectorChips
        titulo={cuentaId ? "Cuenta" : "Cuenta — no pude determinarla, elegila"}
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
      />

      {comoTransferencia && (
        <SelectorChips
          titulo={item.tipo === "gasto" ? "¿A qué cuenta tuya fue?" : "¿De qué cuenta tuya vino?"}
          valor={otraCuentaId}
          onCambiar={setOtraCuentaId}
          opciones={otrasCuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        />
      )}

      {error && <ErrorTexto>{error}</ErrorTexto>}

      {item.origen === "correo" && (
        <Boton
          titulo={comoTransferencia ? "No, era un " + item.tipo : "Fue entre mis cuentas (transferencia)"}
          onPress={() => {
            setComoTransferencia((v) => !v);
            setError(null);
          }}
          disabled={guardando}
        />
      )}

      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Boton
          titulo={comoTransferencia ? "Confirmar transferencia" : "Confirmar"}
          variante="primario"
          onPress={comoTransferencia ? confirmarTransferencia : confirmar}
          loading={guardando}
          disabled={guardando}
          style={{ flex: 1 }}
        />
        <Boton
          titulo="Descartar"
          variante="peligro"
          onPress={descartar}
          loading={guardando}
          disabled={guardando}
          style={{ flex: 1 }}
        />
      </View>
      </>
      )}
    </Tarjeta>
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
    encabezado: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    tipo: {
      fontFamily: font.semibold,
      fontSize: 15,
      fontWeight: "700",
      color: color.text,
    },
    fecha: { fontFamily: font.body, fontSize: 12, color: color.textMuted },
    asunto: {
      fontFamily: font.body,
      fontSize: 12.5,
      color: color.textMuted,
      fontStyle: "italic",
    },
    pista: {
      fontFamily: font.body,
      fontSize: 12.5,
      lineHeight: 18,
      color: color.text,
      backgroundColor: color.primaryBg,
      borderRadius: 8,
      padding: spacing(2.5),
    },
  });
