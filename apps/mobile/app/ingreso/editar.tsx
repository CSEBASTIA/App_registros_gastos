import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  actualizarIngreso,
  cambiosDeIngreso,
  listarCategorias,
  listarCuentas,
  mensajeError,
  obtenerIngreso,
  sinCambios,
  type Categoria,
  type Cuenta,
  type Ingreso,
} from "core";
import FormularioEdicion from "../../components/FormularioEdicion";
import ErrorTexto from "../../components/ErrorTexto";
import { BlurFade } from "../../components/Motion";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";

const TODO_EDITABLE = { monto: true, cuenta: true, fecha: true };

export default function EditarIngreso() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [ingreso, setIngreso] = useState<Ingreso | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setError("No se encontró el ingreso.");
        return;
      }
      setError(null);
      Promise.all([obtenerIngreso(id), listarCategorias(), listarCuentas()])
        .then(([i, c, cu]) => {
          setIngreso(i);
          setCategorias(c.filter((x) => x.tipo === "ingreso"));
          // Un ingreso no entra a una tarjeta de crédito (igual que al crearlo).
          setCuentas(cu.filter((x) => x.tipo !== "credito"));
        })
        .catch((err) => setError(mensajeError(err)));
    }, [id]),
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Stack.Screen options={{ title: "Editar ingreso" }} />
      <ScrollView
        style={styles.contenedor}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}
      >
        <BlurFade style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.screenTitle}>Editar ingreso</Text>
          <Text style={styles.screenIntro}>Corrige lo que haga falta. Los saldos de tus cuentas se ajustan solos.</Text>
        </BlurFade>
        {error && <ErrorTexto>{error}</ErrorTexto>}
        {!ingreso && !error ? (
          <View style={{ alignItems: "center", padding: spacing(6) }}>
            <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
          </View>
        ) : ingreso ? (
          <FormularioEdicion
            tipo="ingreso"
            inicial={{
              monto: ingreso.monto,
              descripcion: ingreso.descripcion,
              categoriaId: ingreso.categoriaId,
              categoriaDetalle: ingreso.categoriaDetalle,
              cuentaId: ingreso.cuentaId ?? "",
              fecha: ingreso.fecha,
            }}
            categorias={categorias}
            cuentas={cuentas}
            permitido={TODO_EDITABLE}
            onGuardar={async (f) => {
              const cambios = cambiosDeIngreso(ingreso, f);
              if (!sinCambios(cambios)) await actualizarIngreso(ingreso.id, cambios);
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
