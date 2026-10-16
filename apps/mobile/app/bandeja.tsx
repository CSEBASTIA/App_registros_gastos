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
  mensajeError,
  parsearMonto,
  ETIQUETA_BANCO,
  ETIQUETA_ORIGEN_TRANSACCION,
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
            subtitulo="Los movimientos que la app detecte en tu correo o en tus pagos con Apple Pay van a aparecer aquí."
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

  const categoriasDelTipo = categorias.filter((c) => c.tipo === item.tipo);

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
            {item.tipo === "gasto" ? "Gasto detectado" : "Ingreso detectado"} · {ETIQUETA_ORIGEN_TRANSACCION[item.origen]}
          </Text>
        </View>
        <Text style={styles.fecha}>{item.fecha}</Text>
      </View>
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

      <SelectorChips
        titulo={cuentaId ? "Cuenta" : "Cuenta — no pude determinarla, elegila"}
        valor={cuentaId}
        onCambiar={setCuentaId}
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
      />

      {error && <ErrorTexto>{error}</ErrorTexto>}

      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Boton
          titulo="Confirmar"
          variante="primario"
          onPress={confirmar}
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
  });
