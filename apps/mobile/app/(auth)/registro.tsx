import { BlurFade } from "../../components/Motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { mensajeError } from "core";
import { supabase } from "../../lib/supabase";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import Tarjeta from "../../components/Tarjeta";
import { radius, spacing, useTheme, font, type Colors } from "../../lib/theme";

export default function Registro() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function crearCuenta() {
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setCargando(false);
    if (error) {
      setError(mensajeError(error));
      return;
    }
    router.replace("/conectar-correo");
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.brand}>
            <Text style={styles.brandText}>G</Text>
          </View>
          <BlurFade style={{ gap: spacing(3) }}>
            <Text style={styles.eyebrow}>GASTOS · TUS FINANZAS</Text>
            <Text accessibilityRole="header" style={styles.titulo}>
              Empezá a ordenar tus finanzas
            </Text>
            <Text style={styles.subtitulo}>
              Creá tu cuenta para registrar tus ingresos y gastos.
            </Text>
          </BlurFade>
          <Tarjeta>
            <Campo
              etiqueta="Correo electrónico"
              placeholder="nombre@correo.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Campo
              etiqueta="Contraseña"
              placeholder="Tu contraseña"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />
            {error && <ErrorTexto>{error}</ErrorTexto>}
            <Boton
              titulo={cargando ? "Creando…" : "Crear cuenta"}
              variante="primario"
              onPress={crearCuenta}
              loading={cargando}
              disabled={cargando}
            />
          </Tarjeta>
          <Link href="/login" style={styles.link}>
            ¿Ya tenés cuenta? Iniciá sesión
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing(6),
      paddingVertical: spacing(12),
      gap: spacing(4),
    },
    brand: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: color.primaryBg,
      alignItems: "center",
      justifyContent: "center",
    },
    brandText: {
      fontFamily: font.semibold,
      fontSize: 30,
      fontWeight: "700",
      color: color.primary,
    },
    eyebrow: {
      fontFamily: font.semibold,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.8,
      color: color.primary,
    },
    titulo: {
      fontFamily: font.display,
      fontSize: 34,
      lineHeight: 40,
      color: color.text,
    },
    subtitulo: {
      fontFamily: font.body,
      fontSize: 15,
      lineHeight: 23,
      color: color.textMuted,
      marginBottom: spacing(2),
    },
    link: {
      fontFamily: font.body,
      textAlign: "center",
      paddingVertical: spacing(3),
      color: color.primary,
      fontSize: 14,
    },
  });
