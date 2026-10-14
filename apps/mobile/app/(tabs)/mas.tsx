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
import { listarTransaccionesPendientes } from "core";
import { supabase } from "../../lib/supabase";
import { radius, spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";

const ITEMS: {
  titulo: string;
  subtitulo: string;
  ruta: string;
  icono: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    titulo: "Cuentas",
    subtitulo: "Ahorros, débito, efectivo",
    ruta: "/cuentas",
    icono: "wallet-outline",
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
    titulo: "Categorías",
    subtitulo: "Organizá gastos e ingresos",
    ruta: "/categorias",
    icono: "pricetag-outline",
  },
  {
    titulo: "Correo (beta)",
    subtitulo: "Opcional: detectar avisos bancarios de Gmail u Outlook",
    ruta: "/correo",
    icono: "mail-outline",
  },
];

export default function Mas() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      listarTransaccionesPendientes()
        .then((items) => setPendientes(items.length))
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
                Movimientos detectados en tu correo, sin confirmar
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
              key={item.ruta}
              accessibilityRole="button"
              android_ripple={{ color: color.primaryBg }}
              style={({ pressed }) => [
                styles.fila,
                pressed && { backgroundColor: color.primaryBg },
              ]}
              onPress={() => router.push(item.ruta as never)}
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
