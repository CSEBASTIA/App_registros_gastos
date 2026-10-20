import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { escucharNotificaciones, type Notificacion } from "../lib/notificaciones";
import { font, useTheme } from "../lib/theme";

const ESTILO = {
  success: { icono: "checkmark-circle" as const, color: "#69d391" },
  error: { icono: "close-circle" as const, color: "#ff827d" },
  warning: { icono: "warning" as const, color: "#f2c66d" },
  info: { icono: "information-circle" as const, color: "#a8c8ff" },
};

/** Aviso móvil inspirado en el morph pill-to-card de Sileo. */
export default function NotificacionSileo() {
  const [notificacion, setNotificacion] = useState<Notificacion | null>(null);
  const progreso = useRef(new Animated.Value(0)).current;
  const opacidad = useRef(new Animated.Value(0)).current;
  const desplazamiento = useRef(new Animated.Value(-12)).current;
  const { color, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();

  useEffect(() => escucharNotificaciones(setNotificacion), []);

  const cerrar = useCallback(
    (id: number) => {
      if (reduceMotion) {
        setNotificacion((actual) => (actual?.id === id ? null : actual));
        return;
      }
      Animated.parallel([
        Animated.spring(progreso, {
          toValue: 0,
          damping: 18,
          stiffness: 240,
          useNativeDriver: false,
        }),
        Animated.timing(opacidad, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.timing(desplazamiento, {
          toValue: -12,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setNotificacion((actual) => (actual?.id === id ? null : actual));
      });
    },
    [desplazamiento, opacidad, progreso, reduceMotion],
  );

  useEffect(() => {
    if (!notificacion) return;
    progreso.stopAnimation();
    opacidad.stopAnimation();
    desplazamiento.stopAnimation();
    progreso.setValue(0);
    opacidad.setValue(reduceMotion ? 1 : 0);
    desplazamiento.setValue(reduceMotion ? 0 : -12);

    if (reduceMotion) {
      progreso.setValue(1);
    } else {
      Animated.parallel([
        Animated.spring(progreso, {
          toValue: 1,
          damping: 15,
          stiffness: 190,
          mass: 0.8,
          useNativeDriver: false,
        }),
        Animated.timing(opacidad, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(desplazamiento, {
          toValue: 0,
          damping: 17,
          stiffness: 210,
          useNativeDriver: true,
        }),
      ]).start();
    }

    const timer = setTimeout(() => cerrar(notificacion.id), notificacion.duracion);
    return () => clearTimeout(timer);
  }, [cerrar, desplazamiento, notificacion, opacidad, progreso, reduceMotion]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evento, gesto) =>
          gesto.dy < -8 && Math.abs(gesto.dy) > Math.abs(gesto.dx),
        onPanResponderMove: (_evento, gesto) => {
          if (gesto.dy < 0) desplazamiento.setValue(Math.max(gesto.dy, -64));
        },
        onPanResponderRelease: (_evento, gesto) => {
          if (notificacion && gesto.dy < -38) cerrar(notificacion.id);
          else
            Animated.spring(desplazamiento, {
              toValue: 0,
              damping: 18,
              stiffness: 220,
              useNativeDriver: true,
            }).start();
        },
      }),
    [cerrar, desplazamiento, notificacion],
  );

  if (!notificacion) return null;

  const estilo = ESTILO[notificacion.tipo];
  const ancho = Math.max(44, Math.min(anchoPantalla - 32, 440));
  const alto = notificacion.descripcion ? 76 : 54;
  const anchoAnimado = progreso.interpolate({ inputRange: [0, 1], outputRange: [44, ancho] });
  const altoAnimado = progreso.interpolate({ inputRange: [0, 1], outputRange: [44, alto] });
  const radioAnimado = progreso.interpolate({ inputRange: [0, 1], outputRange: [22, 19] });
  const contenidoVisible = progreso.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: "center" }]}>
        <Animated.View
          pointerEvents="box-none"
          style={{
            marginTop: Math.max(insets.top, 8) + 8,
            opacity: opacidad,
            transform: [{ translateY: desplazamiento }],
          }}
        >
          <Animated.View
            {...panResponder.panHandlers}
            accessibilityRole="alert"
            accessibilityLabel={`${notificacion.titulo}. ${notificacion.descripcion}`}
            accessibilityLiveRegion={notificacion.tipo === "error" ? "assertive" : "polite"}
            style={{
              width: anchoAnimado,
              height: altoAnimado,
              borderRadius: radioAnimado,
              overflow: "hidden",
              backgroundColor: "#17191c",
              borderColor: "rgba(255,255,255,0.1)",
              borderWidth: 1,
              elevation: 10,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <View style={{ flex: 1, position: "relative" }}>
              <View
                pointerEvents="none"
                style={{ position: "absolute", left: 13, top: 13, width: 18, height: 18 }}
              >
                <Ionicons name={estilo.icono} size={18} color={estilo.color} />
              </View>
              <Animated.View
                pointerEvents="none"
                style={{ position: "absolute", top: 10, left: 43, right: 38, opacity: contenidoVisible }}
              >
                <Text numberOfLines={1} style={{ color: estilo.color, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 }}>
                  {notificacion.titulo}
                </Text>
                {!!notificacion.descripcion && (
                  <Text numberOfLines={2} style={{ color: "#c2c6c3", fontFamily: font.body, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
                    {notificacion.descripcion}
                  </Text>
                )}
              </Animated.View>
              <Animated.View style={{ position: "absolute", right: 6, top: 7, opacity: contenidoVisible }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar notificación"
                  hitSlop={8}
                  onPress={() => cerrar(notificacion.id)}
                  style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="close" size={15} color={color.textMuted} />
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
