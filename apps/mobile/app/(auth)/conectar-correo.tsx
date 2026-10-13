import { BlurFade } from "../../components/Motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { mensajeError } from "core";
import { supabase } from "../../lib/supabase";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import Tarjeta from "../../components/Tarjeta";
import { radius, spacing, useTheme, font, type Colors } from "../../lib/theme";
import {
  ETIQUETA_PROVEEDOR,
  proveedorConfigurado,
  conectarProveedor,
  type ProveedorCorreo,
} from "../../lib/correoProveedor";

const PROVEEDORES: ProveedorCorreo[] = ["gmail", "outlook"];

/**
 * Último paso del registro: conectar el correo para que la app empiece a
 * detectar gastos e ingresos sola. Es opcional — "Ahora no" sigue de largo,
 * y siempre se puede conectar después desde Más → Correo.
 */
export default function ConectarCorreo() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [conectando, setConectando] = useState<ProveedorCorreo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function continuar() {
    const { data } = await supabase.auth.getSession();
    router.replace(data.session ? "/resumen" : "/login");
  }

  async function conectar(proveedor: ProveedorCorreo) {
    setError(null);
    setConectando(proveedor);
    try {
      await conectarProveedor(proveedor);
      await continuar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setConectando(null);
    }
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: color.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          <View style={styles.brand}>
            <Text style={styles.brandText}>@</Text>
          </View>
          <BlurFade style={{ gap: spacing(3) }}>
            <Text style={styles.eyebrow}>UN PASO MÁS · OPCIONAL</Text>
            <Text accessibilityRole="header" style={styles.titulo}>
              Conectá tu correo
            </Text>
            <Text style={styles.subtitulo}>
              Detectá los movimientos de tus bancos desde sus avisos por correo.
              Podés conectarlo ahora o después desde Más.
            </Text>
          </BlurFade>
          <Tarjeta>
            {PROVEEDORES.map((p) => (
              <Boton
                key={p}
                titulo={
                  conectando === p
                    ? "Conectando…"
                    : "Conectar " + ETIQUETA_PROVEEDOR[p]
                }
                variante="primario"
                onPress={() => conectar(p)}
                loading={conectando === p}
                disabled={!proveedorConfigurado(p) || conectando !== null}
              />
            ))}
            {PROVEEDORES.every((p) => !proveedorConfigurado(p)) && (
              <Text style={styles.subtitulo}>
                La conexión con correo todavía no está disponible. Podés
                continuar y agregar tus movimientos manualmente.
              </Text>
            )}
            {error && <ErrorTexto>{error}</ErrorTexto>}
          </Tarjeta>
          <Boton
            titulo="Ahora no, seguir sin conectar"
            onPress={continuar}
            disabled={conectando !== null}
          />
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
    brandText: { fontFamily: font.body, fontSize: 30, color: color.primary },
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
      color: color.textMuted,
      lineHeight: 23,
    },
  });
