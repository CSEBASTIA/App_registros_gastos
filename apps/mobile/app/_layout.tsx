import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

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

    if (!session && !enGrupoAuth) {
      router.replace("/login");
    } else if (session && enGrupoAuth) {
      router.replace("/");
    }
  }, [session, segments]);

  if (session === undefined) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
