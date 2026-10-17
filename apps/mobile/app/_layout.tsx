import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { destinoPorAceptacion, documentosLegalesPendientes, mensajeError, type DocumentoLegal, type EstadoAceptacion } from "core";
import { supabase } from "../lib/supabase";
import { AceptacionContext, EXIGIR_ACEPTACION, type Aceptacion } from "../lib/legal";
import { ThemeProvider, useTheme, font } from "../lib/theme";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";

// Sin sesión, RLS bloquea toda lectura y escritura: la app se ve vacía y
// guardar un gasto falla. Por eso el login va activo también en desarrollo.
// Para revisar solo la interfaz sin iniciar sesión, poner
// EXPO_PUBLIC_SIN_LOGIN=1 en apps/mobile/.env (nunca aplica en producción).
const LOGIN_DESACTIVADO = __DEV__ && process.env.EXPO_PUBLIC_SIN_LOGIN === "1";

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
    IBMPlexSans: require("../assets/fonts/IBMPlexSans.ttf"),
    IBMPlexSansMedium: require("../assets/fonts/IBMPlexSansMedium.ttf"),
    IBMPlexSansSemiBold: require("../assets/fonts/IBMPlexSansSemiBold.ttf"),
    IBMPlexMono: require("../assets/fonts/IBMPlexMono.ttf"),
  });
  // undefined = todavía no sabemos si hay sesión; null = no hay sesión.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Aceptación de términos y privacidad (solo con EXPO_PUBLIC_EXIGIR_ACEPTACION=1).
  // Se comprueba una vez por persona que inicia sesión, no en cada pantalla.
  // `para` es la persona a quien corresponde el resultado: si inicia sesión
  // otra en el mismo teléfono, el resultado de la anterior no vale (así no se
  // ve ni un instante el resumen de alguien que aún no aceptó).
  const [legal, setLegal] = useState<{ para?: string; estado: EstadoAceptacion; pendientes: DocumentoLegal[]; error?: string }>({
    estado: "comprobando",
    pendientes: [],
  });
  const [intentoLegal, setIntentoLegal] = useState(0);
  const usuarioId = session?.user.id;
  const estadoLegal: EstadoAceptacion = legal.para === usuarioId ? legal.estado : "comprobando";
  useEffect(() => {
    if (!EXIGIR_ACEPTACION || LOGIN_DESACTIVADO || !usuarioId) return;
    let vigente = true;
    setLegal({ para: usuarioId, estado: "comprobando", pendientes: [] });
    documentosLegalesPendientes()
      .then((pendientes) => {
        if (vigente) setLegal({ para: usuarioId, estado: pendientes.length > 0 ? "pendiente" : "al-dia", pendientes });
      })
      .catch((err) => {
        if (vigente) setLegal({ para: usuarioId, estado: "error", pendientes: [], error: mensajeError(err) });
      });
    return () => {
      vigente = false;
    };
  }, [usuarioId, intentoLegal]);
  const aceptacion = useMemo<Aceptacion>(
    () => ({
      estado: estadoLegal,
      pendientes: legal.para === usuarioId ? legal.pendientes : [],
      error: legal.para === usuarioId ? legal.error : undefined,
      reintentar: () => setIntentoLegal((n) => n + 1),
      alDia: () => setLegal({ para: usuarioId, estado: "al-dia", pendientes: [] }),
    }),
    [legal, estadoLegal, usuarioId]
  );

  useEffect(() => {
    // Los grupos de rutas no aparecen en la URL. Comprobar la ruta visible
    // evita devolver a login mientras cambia entre login y registro.
    if (!pathname) return;
    const ruta = pathname.replace(/\/+$/, "") || "/";
    const enGrupoAuth = ruta === "/login" || ruta === "/registro" || ruta === "/confirmacion";
    const enRaiz = ruta === "/";
    // No navegar mientras el componente devuelve null (abajo): el Stack
    // todavía no existe y expo-router lanza "Attempted to navigate before
    // mounting the Root Layout component", que tumba la app al arrancar.
    if (session === undefined || !ready || (!fontsLoaded && !fontError)) return;

    if (LOGIN_DESACTIVADO) {
      if (enGrupoAuth || enRaiz) router.replace("/resumen");
      return;
    }

    // Con la aceptación exigida, quien inició sesión no pasa de la pantalla de
    // aceptación hasta aceptar la versión vigente (ver destinoPorAceptacion).
    const porAceptacion = destinoPorAceptacion({ exigir: EXIGIR_ACEPTACION, haySesion: !!session, estado: estadoLegal, ruta });
    if (porAceptacion === "esperar") return;
    if (porAceptacion) {
      router.replace(porAceptacion);
      return;
    }

    if (!session && !enGrupoAuth) {
      router.replace("/(auth)/login");
    } else if (session && enRaiz) {
      router.replace("/resumen");
    } else if (session && enGrupoAuth) {
      router.replace("/resumen");
    }
  }, [session, pathname, router, ready, fontsLoaded, fontError, estadoLegal]);

  if (session === undefined || !ready || (!fontsLoaded && !fontError)) return null;

  return (
    <AceptacionContext.Provider value={aceptacion}>
    <Animated.View style={{ flex: 1, backgroundColor: color.bg, opacity }}>
    <StatusBar style={mode === "dark" ? "light" : "dark"} backgroundColor={color.bg} />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.surface },
        headerTintColor: color.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.display },
        // Cada pantalla secundaria conserva su encabezado dentro del contenido;
        // el Stack muestra la navegación de regreso sin repetir ese título.
        headerTitle: "",
        contentStyle: { backgroundColor: color.bg },
        animation: reduceMotion ? "none" : "default",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="perfil" options={{ title: "Mi perfil" }} />
      <Stack.Screen name="cuentas" options={{ title: "Cuentas" }} />
      <Stack.Screen name="cuenta/[id]" options={{ title: "Cuenta" }} />
      <Stack.Screen name="deudas" options={{ title: "Deudas" }} />
      <Stack.Screen name="recordatorios" options={{ title: "Recordatorios" }} />
      <Stack.Screen name="categorias" options={{ title: "Categorías" }} />
      <Stack.Screen name="tarjeta/[id]" options={{ title: "Tarjeta" }} />
      <Stack.Screen name="importar-estado" options={{ title: "Importar estado de cuenta" }} />
      <Stack.Screen name="gasto/nuevo" options={{ title: "Nuevo gasto", presentation: "modal" }} />
      <Stack.Screen name="ingreso/nuevo" options={{ title: "Nuevo ingreso", presentation: "modal" }} />
      <Stack.Screen name="correo" options={{ title: "Correo" }} />
      <Stack.Screen name="bandeja" options={{ title: "Bandeja de revisión" }} />
      <Stack.Screen name="presupuestos" options={{ title: "Presupuestos" }} />
      <Stack.Screen name="ubicacion" options={{ title: "Ubicación de mis pagos" }} />
      <Stack.Screen name="apple-pay" options={{ title: "Conectar Apple Pay" }} />
      <Stack.Screen name="google-wallet" options={{ title: "Conectar Google Wallet" }} />
      <Stack.Screen name="lugares" options={{ title: "Lugares" }} />
      <Stack.Screen name="lugar/[id]" options={{ title: "Lugar" }} />
      <Stack.Screen name="aceptar-terminos" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
    {/* Mientras se comprueba la aceptación no se ve ninguna pantalla de la app. */}
    {EXIGIR_ACEPTACION && !!session && estadoLegal === "comprobando" && (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    )}
    </Animated.View>
    </AceptacionContext.Provider>
  );
}
