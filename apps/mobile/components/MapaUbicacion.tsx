// Mapa pequeño con un alfiler donde se hizo la transacción. Usa teselas de
// OpenStreetMap con <Image> (sin librerías nativas). Tocarlo abre la app de
// Mapas. Solo se carga al abrir el detalle, porque pedir las teselas le dice
// al servidor de mapas la zona aproximada.
import { useMemo, useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ATRIBUCION_MAPA, TAMANO_TESELA, URL_ATRIBUCION_MAPA, mapaEstatico, type Ubicacion } from "core";
import { font } from "../lib/theme";

// Política de uso de OpenStreetMap: la app se identifica. En la web lo hace el navegador.
const ENCABEZADOS = Platform.OS === "web" ? undefined : { "User-Agent": "FinTrack/1.1 (com.csebastia.gastosapp)" };
const TAMANO_ALFILER = 34;

type Props = {
  ubicacion: Pick<Ubicacion, "latitud" | "longitud" | "precisionM">;
  alto?: number;
  onPress?: () => void;
};

export default function MapaUbicacion({ ubicacion, alto = 150, onPress }: Props) {
  const [ancho, setAncho] = useState(0);
  const [sinMapa, setSinMapa] = useState(false);
  const mapa = useMemo(
    () => mapaEstatico(ubicacion),
    [ubicacion.latitud, ubicacion.longitud, ubicacion.precisionM],
  );
  // La cuadrícula se mueve para que el punto quede en el centro del recuadro.
  const izquierda = ancho / 2 - mapa.puntoX;
  const arriba = alto / 2 - mapa.puntoY;
  const radio = mapa.radioPrecisionPx !== undefined ? Math.min(mapa.radioPrecisionPx, alto) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mapa de dónde se hizo la transacción. Toca para abrirlo en Mapas."
      onPress={onPress}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.marco, { height: alto }, pressed && { opacity: 0.85 }]}
    >
      {ancho > 0 &&
        mapa.teselas.map((t) => (
          <Image
            key={t.url}
            source={{ uri: t.url, headers: ENCABEZADOS }}
            onError={() => setSinMapa(true)}
            style={[
              styles.tesela,
              { left: izquierda + t.columna * TAMANO_TESELA, top: arriba + t.fila * TAMANO_TESELA },
            ]}
            accessibilityIgnoresInvertColors
          />
        ))}
      {ancho > 0 && radio >= 8 && (
        <View
          pointerEvents="none"
          style={[
            styles.precision,
            { width: radio * 2, height: radio * 2, borderRadius: radio, left: ancho / 2 - radio, top: alto / 2 - radio },
          ]}
        />
      )}
      {ancho > 0 && (
        <View pointerEvents="none" style={[styles.alfiler, { left: ancho / 2 - TAMANO_ALFILER / 2, top: alto / 2 - TAMANO_ALFILER }]}>
          <Ionicons name="location" size={TAMANO_ALFILER} color="#e5484d" />
        </View>
      )}
      {sinMapa && (
        <View pointerEvents="none" style={styles.aviso}>
          <Text style={styles.avisoTexto}>Sin conexión para ver el mapa</Text>
        </View>
      )}
      <View pointerEvents="none" style={styles.abrir}>
        <Ionicons name="open-outline" size={12} color="#111111" />
        <Text style={styles.abrirTexto}>Abrir en Mapas</Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${ATRIBUCION_MAPA}: ver los derechos del mapa`}
        hitSlop={6}
        onPress={() => Linking.openURL(URL_ATRIBUCION_MAPA).catch(() => undefined)}
        style={styles.atribucion}
      >
        <Text style={styles.atribucionTexto}>{ATRIBUCION_MAPA}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  marco: { width: "100%", overflow: "hidden", borderRadius: 20, backgroundColor: "#e8e4dc" },
  tesela: { position: "absolute", width: TAMANO_TESELA, height: TAMANO_TESELA },
  precision: {
    position: "absolute",
    backgroundColor: "rgba(59,130,246,0.18)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.7)",
  },
  alfiler: { position: "absolute", width: TAMANO_ALFILER, height: TAMANO_ALFILER, alignItems: "center" },
  aviso: { position: "absolute", left: 8, top: 8, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  avisoTexto: { fontFamily: font.body, fontSize: 11, color: "#111111" },
  abrir: {
    position: "absolute",
    right: 8,
    top: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  abrirTexto: { fontFamily: font.semibold, fontSize: 11, color: "#111111" },
  atribucion: {
    position: "absolute",
    right: 6,
    bottom: 4,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  atribucionTexto: { fontFamily: font.body, fontSize: 10, color: "#333333" },
});
