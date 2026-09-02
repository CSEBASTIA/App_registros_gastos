import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { mensajeError } from "core";
import { supabase } from "../../lib/supabase";
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
    <View style={styles.container}>
      <Text style={styles.titulo}>Conectá tu correo</Text>
      <Text style={styles.subtitulo}>
        Cuenta creada. Si querés, conectá tu correo ahora para que la app detecte sola los gastos e ingresos que
        avisan tus bancos — un débito de Pichincha resta de esa cuenta, una transferencia de Guayaquil de esa otra,
        y así con cada banco.
      </Text>

      {PROVEEDORES.map((p) => (
        <Pressable
          key={p}
          style={[styles.boton, !proveedorConfigurado(p) && styles.botonDeshabilitado]}
          onPress={() => conectar(p)}
          disabled={!proveedorConfigurado(p) || conectando !== null}
        >
          {conectando === p ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>Conectar {ETIQUETA_PROVEEDOR[p]}</Text>
          )}
        </Pressable>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={continuar} disabled={conectando !== null}>
        <Text style={styles.link}>Ahora no, seguir sin conectar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  titulo: { fontSize: 24, fontWeight: "600" },
  subtitulo: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 8 },
  boton: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  botonDeshabilitado: { opacity: 0.4 },
  botonTexto: { color: "white", fontWeight: "600" },
  error: { color: "crimson" },
  link: { textAlign: "center", marginTop: 8, color: "#2563eb" },
});
