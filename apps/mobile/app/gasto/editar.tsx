import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  actualizarGasto,
  cambiosDeGasto,
  edicionPermitida,
  listarCategorias,
  listarCuentas,
  mensajeError,
  obtenerGasto,
  sinCambios,
  type Categoria,
  type Cuenta,
  type Gasto,
} from "core";
import FormularioEdicion from "../../components/FormularioEdicion";
import ErrorTexto from "../../components/ErrorTexto";
import { BlurFade } from "../../components/Motion";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";

export default function EditarGasto() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [gasto, setGasto] = useState<Gasto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setError("No se encontró el gasto.");
        return;
      }
      setError(null);
      Promise.all([obtenerGasto(id), listarCategorias(), listarCuentas()])
        .then(([g, c, cu]) => {
          setGasto(g);
          setCategorias(c.filter((x) => x.tipo === "gasto"));
          setCuentas(cu);
        })
        .catch((err) => setError(mensajeError(err)));
    }, [id]),
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Stack.Screen options={{ title: "Editar gasto" }} />
      <ScrollView
        style={styles.contenedor}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}
      >
        <BlurFade style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.screenTitle}>Editar gasto</Text>
          <Text style={styles.screenIntro}>Corrige lo que haga falta. Los saldos de tus cuentas se ajustan solos.</Text>
        </BlurFade>
        {error && <ErrorTexto>{error}</ErrorTexto>}
        {!gasto && !error ? (
          <View style={{ alignItems: "center", padding: spacing(6) }}>
            <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
          </View>
        ) : gasto ? (
          <FormularioEdicion
            tipo="gasto"
            inicial={{
              monto: gasto.monto,
              descripcion: gasto.descripcion,
              categoriaId: gasto.categoriaId,
              categoriaDetalle: gasto.categoriaDetalle,
              cuentaId: gasto.cuentaId ?? "",
              fecha: gasto.fecha,
            }}
            categorias={categorias}
            cuentas={cuentas}
            permitido={edicionPermitida(gasto)}
            onGuardar={async (f) => {
              const cambios = cambiosDeGasto(gasto, f);
              if (!sinCambios(cambios)) await actualizarGasto(gasto.id, cambios);
              router.back();
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
  });
