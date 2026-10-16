// «Isla» de detalle: una tarjeta oscura que flota sobre la pantalla, como la
// isla dinámica del iPhone, con todos los datos de una transacción (id,
// fecha, hora, lugar…). Se cierra tocando afuera, con «Cerrar» o con el botón
// atrás de Android.
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { FilaDetalle, Ubicacion } from "core";
import { font, spacing } from "../lib/theme";
import MapaUbicacion from "./MapaUbicacion";

// La isla es oscura en los dos temas, como la del iPhone.
const ISLA = {
  fondo: "#0d0d0f",
  borde: "#2a2a2e",
  texto: "#f5f5f5",
  suave: "#a1a1aa",
  chip: "#1f1f23",
  peligro: "#ff8a80",
};

export type AccionIsla = {
  titulo: string;
  icono: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  peligro?: boolean;
};

type Props = {
  visible: boolean;
  onCerrar: () => void;
  icono: keyof typeof Ionicons.glyphMap;
  /** Color del círculo del ícono (por ejemplo, el de la categoría). */
  colorIcono?: string;
  titulo: string;
  monto?: string;
  filas: FilaDetalle[];
  acciones?: AccionIsla[];
  /** Si la transacción tiene ubicación, se muestra el mapa con el punto. */
  ubicacion?: Pick<Ubicacion, "latitud" | "longitud" | "precisionM">;
  onAbrirMapa?: () => void;
  /** Texto en lugar del mapa cuando no hay ubicación (por ejemplo, en Google Wallet). */
  sinUbicacion?: string;
};

async function copiarTexto(texto: string) {
  if (Platform.OS === "web") {
    if (!navigator.clipboard) throw new Error("Sin portapapeles");
    await navigator.clipboard.writeText(texto);
    return;
  }
  // Sin librería nativa nueva: el menú de compartir del sistema incluye «Copiar».
  await Share.share({ message: texto });
}

export default function IslaDetalle({
  visible,
  onCerrar,
  icono,
  colorIcono,
  titulo,
  monto,
  filas,
  acciones = [],
  ubicacion,
  onAbrirMapa,
  sinUbicacion,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const entrada = useRef(new Animated.Value(0)).current;
  const [copia, setCopia] = useState<"nada" | "copiado" | "error">("nada");
  const id = filas.find((f) => f.clave === "id")?.valor;

  useEffect(() => {
    if (!visible) return;
    setCopia("nada");
    entrada.setValue(0);
    Animated.timing(entrada, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible, entrada]);

  async function copiarId() {
    if (!id) return;
    try {
      await copiarTexto(id);
      setCopia("copiado");
    } catch {
      // Sin permiso del navegador para el portapapeles: el ID se puede seleccionar a mano.
      setCopia("error");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar detalles" accessibilityRole="button" />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.isla,
            {
              marginBottom: Math.max(insets.bottom, spacing(3)),
              maxHeight: height * 0.82,
              opacity: entrada,
              transform: [
                { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.muesca} />

          <View style={styles.encabezado}>
            <View style={[styles.circulo, { backgroundColor: colorIcono ?? ISLA.chip }]}>
              <Ionicons name={icono} size={20} color="#ffffff" />
            </View>
            <Text style={styles.titulo} numberOfLines={2} accessibilityRole="header">
              {titulo}
            </Text>
            {monto && (
              <Text style={styles.monto} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {monto}
              </Text>
            )}
          </View>

          {ubicacion ? (
            <MapaUbicacion ubicacion={ubicacion} onPress={onAbrirMapa} />
          ) : (
            sinUbicacion && (
              <View style={styles.sinUbicacion}>
                <Ionicons name="location-outline" size={16} color={ISLA.suave} />
                <Text style={styles.sinUbicacionTexto}>{sinUbicacion}</Text>
              </View>
            )
          )}

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing(2.5) }}>
            {filas.map((f) => (
              <View key={f.clave} style={styles.fila} accessible accessibilityLabel={`${f.etiqueta}: ${f.valor}`}>
                <Text style={styles.etiqueta}>{f.etiqueta}</Text>
                <Text selectable style={[styles.valor, f.mono && styles.valorMono]}>
                  {f.valor}
                </Text>
              </View>
            ))}
          </ScrollView>

          {copia === "error" && (
            <Text style={styles.etiqueta} accessibilityLiveRegion="polite">
              No se pudo copiar: mantén presionado el ID para seleccionarlo.
            </Text>
          )}
          <View style={styles.acciones}>
            {id && (
              <Chip
                titulo={copia === "copiado" ? "ID copiado ✓" : Platform.OS === "web" ? "Copiar ID" : "Copiar o compartir ID"}
                icono="copy-outline"
                onPress={copiarId}
              />
            )}
            {acciones.map((a) => (
              <Chip key={a.titulo} titulo={a.titulo} icono={a.icono} peligro={a.peligro} onPress={a.onPress} />
            ))}
            <Chip titulo="Cerrar" icono="close" onPress={onCerrar} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Chip({ titulo, icono, onPress, peligro }: AccionIsla) {
  const color = peligro ? ISLA.peligro : ISLA.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icono} size={15} color={color} />
      <Text style={[styles.chipTexto, { color }]}>{titulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: spacing(3),
  },
  isla: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: ISLA.fondo,
    borderColor: ISLA.borde,
    borderWidth: 1,
    borderRadius: 32,
    padding: spacing(5),
    paddingTop: spacing(3),
    gap: spacing(4),
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  muesca: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: ISLA.borde },
  encabezado: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  circulo: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  titulo: { flex: 1, fontFamily: font.semibold, fontSize: 16, lineHeight: 21, color: ISLA.texto },
  monto: { fontFamily: font.mono, fontSize: 20, color: ISLA.texto, maxWidth: "45%" },
  fila: { gap: 2 },
  etiqueta: { fontFamily: font.body, fontSize: 12, color: ISLA.suave },
  valor: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: ISLA.texto },
  valorMono: { fontFamily: font.mono, fontSize: 13 },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  sinUbicacion: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    backgroundColor: ISLA.chip,
    borderRadius: 16,
    padding: spacing(3),
  },
  sinUbicacionTexto: { flex: 1, fontFamily: font.body, fontSize: 12, lineHeight: 17, color: ISLA.suave },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing(3.5),
    borderRadius: 999,
    backgroundColor: ISLA.chip,
  },
  chipTexto: { fontFamily: font.semibold, fontSize: 13 },
});
