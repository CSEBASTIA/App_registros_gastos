import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ThemeProvider, useTheme, font } from "../lib/theme";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Animated } from "react-native";

export default function RootLayout() {
  return <ThemeProvider><ThemedLayout /></ThemeProvider>;
}

function ThemedLayout() {
  const { color, mode, ready, reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) { opacity.setValue(1); return; }
    opacity.setValue(0.85);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [mode, reduceMotion, opacity]);
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: require("../assets/fonts/Fraunces.ttf"),
    IBMPlexSans: require("../assets/fonts/IBMPlexSans.ttf"),
    IBMPlexSansMedium: require("../assets/fonts/IBMPlexSansMedium.ttf"),
    IBMPlexSansSemiBold: require("../assets/fonts/IBMPlexSansSemiBold.ttf"),
    IBMPlexMono: require("../assets/fonts/IBMPlexMono.ttf"),
  });
  // undefined = todavía no sabemos si hay sesión; null = no hay sesión.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // todavía cargando

    const enGrupoAuth = segments[0] === "(auth)";
    // segments vacío = ruta raíz "/" sin match (no hay index propio, el
    // tab por defecto es "resumen") — pasa también en el arranque en frío
    // con sesión ya guardada.
    const enRaiz = segments.length === 0;
    // último paso del registro: si la confirmación de email está apagada,
    // signUp ya deja sesión activa acá — no hay que sacar al usuario antes
    // de que decida si conecta el correo o no (esa pantalla navega ella
    // misma cuando termina).
    const enConectarCorreo = segments[1] === "conectar-correo";

    if (!session && !enGrupoAuth) {
      router.replace("/login");
    } else if (session && enRaiz) {
      router.replace("/resumen");
    } else if (session && enGrupoAuth && !enConectarCorreo) {
      router.replace("/resumen");
    }
  }, [session, segments]);

  if (session === undefined || !ready || (!fontsLoaded && !fontError)) return null;

  return (
    <Animated.View style={{ flex: 1, backgroundColor: color.bg, opacity }}>
    <StatusBar style={mode === "dark" ? "light" : "dark"} backgroundColor={color.bg} />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.surface },
        headerTintColor: color.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.display },
        contentStyle: { backgroundColor: color.bg },
        animation: reduceMotion ? "none" : "default",
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="cuentas" options={{ title: "Cuentas" }} />
      <Stack.Screen name="cuenta/[id]" options={{ title: "Cuenta" }} />
      <Stack.Screen name="deudas" options={{ title: "Deudas" }} />
      <Stack.Screen name="recordatorios" options={{ title: "Recordatorios" }} />
      <Stack.Screen name="categorias" options={{ title: "Categorías" }} />
      <Stack.Screen name="tarjeta/[id]" options={{ title: "Tarjeta" }} />
      <Stack.Screen name="gasto/nuevo" options={{ title: "Nuevo gasto", presentation: "modal" }} />
      <Stack.Screen name="ingreso/nuevo" options={{ title: "Nuevo ingreso", presentation: "modal" }} />
      <Stack.Screen name="correo" options={{ title: "Correo" }} />
      <Stack.Screen name="bandeja" options={{ title: "Bandeja de revisión" }} />
    </Stack>
    </Animated.View>
  );
}
