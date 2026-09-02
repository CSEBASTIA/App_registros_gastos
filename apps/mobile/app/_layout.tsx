import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { color } from "../lib/theme";

export default function RootLayout() {
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

    if (!session && !enGrupoAuth) {
      router.replace("/login");
    } else if (session && (enGrupoAuth || enRaiz)) {
      router.replace("/resumen");
    }
  }, [session, segments]);

  if (session === undefined) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.surface },
        headerTintColor: color.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700" },
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
    </Stack>
  );
}
