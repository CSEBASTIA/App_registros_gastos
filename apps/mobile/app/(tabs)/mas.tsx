import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { contarTransaccionesPendientes } from "core";
import { supabase } from "../../lib/supabase";
import { DOCUMENTOS, abrirDocumento } from "../../lib/legal";
import { radius, spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

const ITEMS: {
  titulo: string;
  subtitulo: string;
  /** Pantalla de la app. Las filas de documentos legales llevan `url` en su lugar. */
  ruta?: string;
  /** Dirección que se abre en el navegador (documentos legales). */
  url?: string;
  icono: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    titulo: "Mi perfil",
    subtitulo: "Nombre, teléfono y correo de acceso",
    ruta: "/perfil",
    icono: "person-circle-outline",
  },
  {
    titulo: "Cuentas",
    subtitulo: "Ahorros, débito, efectivo",
    ruta: "/cuentas",
    icono: "wallet-outline",
  },
  {
    titulo: "Transferencias",
    subtitulo: "Pasar dinero entre tus cuentas",
    ruta: "/transferencias",
    icono: "swap-horizontal-outline",
  },
  {
    titulo: "Deudas",
    subtitulo: "Préstamos, endeudamiento",
    ruta: "/deudas",
    icono: "alert-circle-outline",
  },
  {
    titulo: "Presupuestos",
    subtitulo: "Controlá cuánto llevás usado este mes",
    ruta: "/presupuestos",
    icono: "pie-chart-outline",
  },
  {
    titulo: "Recordatorios",
    subtitulo: "Pagos y cuotas próximas",
    ruta: "/recordatorios",
    icono: "notifications-outline",
  },
  {
    titulo: "Notificaciones",
    subtitulo: "Pagos registrados, cuotas y presupuestos",
    ruta: "/notificaciones",
    icono: "notifications-circle-outline",
  },
  {
    titulo: "Categorías",
    subtitulo: "Organizá gastos e ingresos",
    ruta: "/categorias",
    icono: "pricetag-outline",
  },
  {
    titulo: "Lugares",
    subtitulo: "Cuánto pagas en cada sitio",
    ruta: "/lugares",
    icono: "location-outline",
  },
  {
    titulo: "Ubicación de mis pagos",
    subtitulo: "Activarla, apagarla o borrarla",
    ruta: "/ubicacion",
    icono: "navigate-outline",
  },
  {
    titulo: "Conectar Apple Pay",
    subtitulo: "Tus pagos del iPhone llegan solos a la bandeja",
    ruta: "/apple-pay",
    icono: "phone-portrait-outline",
  },
  {
    titulo: "Conectar Google Wallet",
    subtitulo: "En Android, tus pagos se registran solos",
    ruta: "/google-wallet",
    icono: "wallet-outline",
  },
  {
    titulo: "Correo (beta)",
    subtitulo: "Opcional: detectar avisos bancarios de Gmail u Outlook",
    ruta: "/correo",
    icono: "mail-outline",
  },
  // Documentos legales: solo se muestran si su dirección está configurada
  // (EXPO_PUBLIC_URL_TERMINOS / EXPO_PUBLIC_URL_PRIVACIDAD).
  ...(["terminos", "privacidad"] as const)
    .filter((doc) => !!DOCUMENTOS[doc].url)
    .map((doc) => ({
      titulo: DOCUMENTOS[doc].titulo,
      subtitulo: DOCUMENTOS[doc].subtitulo,
      url: DOCUMENTOS[doc].url,
      icono: "document-text-outline" as const,
    })),
];

export default function Mas() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      contarTransaccionesPendientes()
        .then(setPendientes)
        .catch(() => setPendientes(0));
    }, []),
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: color.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.contenedor}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: spacing(5),
            paddingBottom: spacing(8),
            gap: spacing(3),
          }}
        >
          <BlurFade style={{ gap: spacing(2) }}>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Tu espacio
            </Text>
            <Text style={styles.screenIntro}>
              Cuentas, pagos y herramientas para organizarte.
            </Text>
          </BlurFade>

          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: color.primaryBg }}
            style={({ pressed }) => [
              styles.fila,
              pressed && { backgroundColor: color.primaryBg },
            ]}
            onPress={() => router.push("/bandeja")}
          >
            <View style={styles.icono}>
              <Ionicons
                name="file-tray-full-outline"
                size={20}
                color={color.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filaTitulo}>Bandeja de revisión</Text>
              <Text style={styles.filaSubtitulo}>
                Movimientos detectados (correo y billeteras), sin confirmar
              </Text>
            </View>
            {pendientes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTexto}>{pendientes}</Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={18}
              color={color.textMuted}
            />
          </Pressable>

          {ITEMS.map((item) => (
            <Pressable
              key={item.ruta ?? item.url}
              accessibilityRole={item.url ? "link" : "button"}
              android_ripple={{ color: color.primaryBg }}
              style={({ pressed }) => [
                styles.fila,
                pressed && { backgroundColor: color.primaryBg },
              ]}
              onPress={() => (item.url ? abrirDocumento(item.url) : router.push(item.ruta as never))}
            >
              <View style={styles.icono}>
                <Ionicons name={item.icono} size={20} color={color.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.filaTitulo}>{item.titulo}</Text>
                <Text style={styles.filaSubtitulo}>{item.subtitulo}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={color.textMuted}
              />
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.fila,
              styles.salir,
              pressed && { backgroundColor: color.dangerBg },
            ]}
            onPress={() => supabase.auth.signOut()}
          >
            <View style={[styles.icono, { backgroundColor: color.dangerBg }]}>
              <Ionicons name="log-out-outline" size={20} color={color.danger} />
            </View>
            <Text style={[styles.filaTitulo, { color: color.danger }]}>
              Cerrar sesión
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    screenTitle: {
      fontFamily: font.display,
      fontSize: 30,
      lineHeight: 36,
      color: color.text,
    },
    screenIntro: {
      fontFamily: font.body,
      fontSize: 14,
      lineHeight: 21,
      color: color.textMuted,
    },
    contenedor: { flex: 1, backgroundColor: color.bg },
    titulo: {
      fontFamily: font.display,
      fontSize: 24,
      color: color.text,
      marginBottom: spacing(2),
    },
    fila: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      padding: spacing(3.5),
    },
    icono: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: color.primaryBg,
      alignItems: "center",
      justifyContent: "center",
    },
    filaTitulo: {
      fontFamily: font.semibold,
      fontSize: 15,
      fontWeight: "600",
      color: color.text,
    },
    filaSubtitulo: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.textMuted,
    },
    badge: {
      backgroundColor: color.dangerBg,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeTexto: {
      fontFamily: font.semibold,
      color: color.danger,
      fontSize: 11,
      fontWeight: "700",
    },
    salir: { marginTop: spacing(4) },
  });
