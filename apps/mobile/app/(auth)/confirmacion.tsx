import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { mensajeError, sesionDesdeEnlace } from "core";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import Tarjeta from "../../components/Tarjeta";
import { font, spacing, useTheme, type Colors } from "../../lib/theme";

type Estado = "procesando" | "confirmado" | "error";

/** Recibe el código PKCE tras confirmar el correo en el mismo teléfono. */
export default function Confirmacion() {
  const enlace = Linking.useURL();
  const { color } = useTheme();
  const styles = createStyles(color);
  const [estado, setEstado] = useState<Estado>("procesando");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const solicitud = useRef<{ clave: string; promesa: Promise<void> } | null>(null);

  useEffect(() => {
    if (!enlace) return;

    // Reutilizar la promesa evita canjear dos veces un código de un solo uso
    // si React vuelve a ejecutar el efecto durante el montaje.
    const clave = `${intento}:${enlace}`;
    if (solicitud.current?.clave !== clave) {
      solicitud.current = { clave, promesa: sesionDesdeEnlace(enlace) };
    }

    let activo = true;
    setEstado("procesando");
    setError(null);
    solicitud.current.promesa
      .then(() => {
        if (activo) setEstado("confirmado");
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setError(mensajeError(err));
        setEstado("error");
      });
    return () => { activo = false; };
  }, [enlace, intento]);

  return (
    <SafeAreaView style={[styles.pantalla, { backgroundColor: color.bg }]} edges={["top", "bottom"]}>
      <View style={styles.contenido}>
        <Text accessibilityRole="header" style={styles.titulo}>Confirmación de correo</Text>
        <Tarjeta>
          {estado === "procesando" && (
            <View style={styles.espera}>
              <ActivityIndicator color={color.primary} />
              <Text style={styles.texto}>Confirmando tu cuenta…</Text>
            </View>
          )}
          {estado === "confirmado" && (
            <Text accessibilityLiveRegion="polite" style={styles.texto}>
              Tu correo está confirmado. Ya puedes usar la aplicación.
            </Text>
          )}
          {estado === "error" && (
            <>
              <ErrorTexto>{error ?? "No se pudo confirmar el correo."}</ErrorTexto>
              <Text style={styles.texto}>
                Si el enlace ya confirmó tu cuenta, prueba iniciar sesión. Si venció, pide otro correo desde Registro.
              </Text>
              <Boton titulo="Reintentar" onPress={() => setIntento((actual) => actual + 1)} />
            </>
          )}
        </Tarjeta>
        {estado !== "procesando" && (
          <Link href="/(auth)/login" style={styles.enlace}>Ir a iniciar sesión</Link>
        )}
        {estado === "error" && (
          <Link href="/(auth)/registro" style={styles.enlace}>Ir a Registro para pedir otro correo</Link>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) => StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: {
    flex: 1,
    justifyContent: "center",
    padding: spacing(6),
    gap: spacing(4),
  },
  titulo: {
    fontFamily: font.display,
    fontSize: 30,
    lineHeight: 36,
    color: color.text,
  },
  espera: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  texto: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: color.textMuted },
  enlace: {
    fontFamily: font.body,
    textAlign: "center",
    paddingVertical: spacing(3),
    color: color.primary,
    fontSize: 14,
  },
});
