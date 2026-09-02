import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { mensajeError } from "core";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion() {
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setError(mensajeError(error));
    // Si no hay error, el RootLayout detecta la sesión nueva y redirige solo.
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Iniciar sesión</Text>
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
      <Pressable style={styles.boton} onPress={iniciarSesion} disabled={cargando}>
        <Text style={styles.botonTexto}>{cargando ? "Ingresando…" : "Ingresar"}</Text>
      </Pressable>
      <Link href="/registro" style={styles.link}>
        ¿No tenés cuenta? Creá una
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
