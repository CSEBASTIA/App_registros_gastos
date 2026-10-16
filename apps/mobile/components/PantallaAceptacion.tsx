import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { DocumentoLegal, EstadoAceptacion } from "core";
import Boton from "./Boton";
import ErrorTexto from "./ErrorTexto";
import Tarjeta from "./Tarjeta";
import { BlurFade } from "./Motion";
import { DOCUMENTOS, abrirDocumento } from "../lib/legal";
import { radius, spacing, useTheme, font, type Colors } from "../lib/theme";

interface Props {
  estado: Exclude<EstadoAceptacion, "al-dia">;
  pendientes: DocumentoLegal[];
  /** Por qué no se pudo comprobar (con `estado: "error"`). */
  errorCarga?: string;
  guardando: boolean;
  /** Fallo al guardar la aceptación. */
  error: string | null;
  onAceptar: () => void;
  onReintentar: () => void;
  onCerrarSesion: () => void;
}

/**
 * Pantalla que ve quien inició sesión y todavía no aceptó la versión vigente
 * de los términos o de la política de privacidad (cuentas anteriores, o tras
 * un cambio de fondo). Solo dibuja: de la lógica se encarga `app/aceptar-terminos.tsx`.
 */
export default function PantallaAceptacion({
  estado,
  pendientes,
  errorCarga,
  guardando,
  error,
  onAceptar,
  onReintentar,
  onCerrarSesion,
}: Props) {
  const { color } = useTheme();
  const styles = createStyles(color);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "bottom"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>G</Text>
        </View>

        {estado === "comprobando" && (
          <View style={styles.centro}>
            <ActivityIndicator color={color.primary} />
            <Text style={styles.subtitulo}>Verificando…</Text>
          </View>
        )}

        {estado === "error" && (
          <BlurFade style={{ gap: spacing(3) }}>
            <Text accessibilityRole="header" style={styles.titulo}>
              No pudimos comprobar tu aceptación
            </Text>
            <Text style={styles.subtitulo}>
              Para cuidar tus datos, no entras hasta comprobar que aceptaste los términos y la política de privacidad vigentes.
            </Text>
            {!!errorCarga && <ErrorTexto>{errorCarga}</ErrorTexto>}
            <Boton titulo="Reintentar" variante="primario" onPress={onReintentar} />
            <Boton titulo="Cerrar sesión" onPress={onCerrarSesion} />
          </BlurFade>
        )}

        {estado === "pendiente" && (
          <BlurFade style={{ gap: spacing(3) }}>
            <Text style={styles.eyebrow}>ANTES DE SEGUIR</Text>
            <Text accessibilityRole="header" style={styles.titulo}>
              Revisa y acepta para continuar
            </Text>
            <Text style={styles.subtitulo}>
              {pendientes.length > 1
                ? "Para usar fintrack necesitas aceptar estos documentos. Puedes leerlos antes de aceptar."
                : "Para usar fintrack necesitas aceptar este documento. Puedes leerlo antes de aceptar."}
            </Text>

            <Tarjeta>
              {pendientes.map((doc) => {
                const info = DOCUMENTOS[doc];
                return (
                  <Pressable
                    key={doc}
                    accessibilityRole={info.url ? "link" : undefined}
                    disabled={!info.url}
                    onPress={() => info.url && abrirDocumento(info.url)}
                    style={({ pressed }) => [styles.fila, pressed && { backgroundColor: color.primaryBg }]}
                  >
                    <View style={styles.icono}>
                      <Ionicons name="document-text-outline" size={20} color={color.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.filaTitulo}>{info.titulo}</Text>
                      <Text style={styles.filaSubtitulo}>{info.subtitulo}</Text>
                    </View>
                    {!!info.url && <Ionicons name="open-outline" size={18} color={color.textMuted} />}
                  </Pressable>
                );
              })}
            </Tarjeta>

            <Text style={styles.nota}>
              Guardamos qué versión aceptaste y cuándo, como constancia de tu consentimiento.
            </Text>

            {!!error && <ErrorTexto>{error}</ErrorTexto>}
            <Boton
              titulo={guardando ? "Guardando…" : "Acepto y continuar"}
              variante="primario"
              onPress={onAceptar}
              loading={guardando}
              disabled={guardando}
            />
            <Boton titulo="No acepto: cerrar sesión" onPress={onCerrarSesion} disabled={guardando} />
          </BlurFade>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
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
    brandText: { fontFamily: font.semibold, fontSize: 30, fontWeight: "700", color: color.primary },
    centro: { alignItems: "center", gap: spacing(3), paddingVertical: spacing(6) },
    eyebrow: { fontFamily: font.semibold, fontSize: 11, fontWeight: "700", letterSpacing: 1.8, color: color.primary },
    titulo: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    subtitulo: { fontFamily: font.body, fontSize: 15, lineHeight: 23, color: color.textMuted },
    nota: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: color.textFaint },
    fila: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
      borderRadius: radius.sm,
      padding: spacing(1),
    },
    icono: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: color.primaryBg,
      alignItems: "center",
      justifyContent: "center",
    },
    filaTitulo: { fontFamily: font.semibold, fontSize: 15, fontWeight: "600", color: color.text },
    filaSubtitulo: { fontFamily: font.body, fontSize: 13, color: color.textMuted },
  });
