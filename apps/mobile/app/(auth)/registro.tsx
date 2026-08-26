import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function Registro() {
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
      setError(error.message);
      return;
    }
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Crear cuenta</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.boton} onPress={crearCuenta} disabled={cargando}>
        <Text style={styles.botonTexto}>{cargando ? "Creando…" : "Crear cuenta"}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>
        ¿Ya tenés cuenta? Iniciá sesión
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  titulo: { fontSize: 24, fontWeight: "600", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  boton: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  botonTexto: { color: "white", fontWeight: "600" },
  error: { color: "crimson" },
  link: { textAlign: "center", marginTop: 16, color: "#2563eb" },
});
