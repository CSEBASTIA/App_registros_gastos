import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import type { User } from "@supabase/supabase-js";
import { mensajeError } from "core";
import { supabase } from "../lib/supabase";
import { font, radius, spacing, useTheme, type Colors } from "../lib/theme";
import Boton from "../components/Boton";
import Campo from "../components/Campo";
import ErrorTexto from "../components/ErrorTexto";
import Tarjeta from "../components/Tarjeta";

const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Perfil() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correoNuevo, setCorreoNuevo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [avisoDatos, setAvisoDatos] = useState<string | null>(null);
  const [avisoCorreo, setAvisoCorreo] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setUsuario(null);
    supabase.auth.getUser().then(({ data, error }) => {
      if (!activo) return;
      if (error) throw error;
      const u = data.user;
      setUsuario(u);
      setNombre(typeof u.user_metadata?.full_name === "string" ? u.user_metadata.full_name : "");
      setTelefono(typeof u.user_metadata?.phone_number === "string" ? u.user_metadata.phone_number : "");
      setCorreoNuevo("");
      setErrorDatos(null);
      setErrorCorreo(null);
      setAvisoDatos(null);
      setAvisoCorreo(null);
    }).catch((err: unknown) => {
      if (activo) setErrorDatos(mensajeError(err));
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [intento]));

  async function guardarDatos() {
    if (!usuario || guardando) return;
    setErrorDatos(null);
    setAvisoDatos(null);
    const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
    const telefonoLimpio = telefono.trim();
    if (nombreLimpio.length > 80) {
      setErrorDatos("El nombre puede tener hasta 80 caracteres.");
      return;
    }
    if (telefonoLimpio && (telefonoLimpio.replace(/\D/g, "").length < 7 || telefonoLimpio.replace(/\D/g, "").length > 15 || !/^\+?[\d ()-]+$/.test(telefonoLimpio))) {
      setErrorDatos("Escribe un teléfono válido o deja el campo vacío.");
      return;
    }
    setGuardando(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        // Conservar los otros metadatos de la cuenta, incluida la aceptación legal.
        data: { ...usuario.user_metadata, full_name: nombreLimpio, phone_number: telefonoLimpio },
      });
      if (error) throw error;
      setUsuario(data.user);
      setNombre(nombreLimpio);
      setTelefono(telefonoLimpio);
      setAvisoDatos("Tus datos se guardaron.");
    } catch (err) {
      setErrorDatos(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarCorreo() {
    if (!usuario || cambiandoCorreo) return;
    setErrorCorreo(null);
    setAvisoCorreo(null);
    const nuevo = correoNuevo.trim().toLowerCase();
    if (!correoValido.test(nuevo)) {
      setErrorCorreo("Escribe un correo válido.");
      return;
    }
    if (nuevo === usuario.email?.toLowerCase()) {
      setErrorCorreo("Ese ya es tu correo actual.");
      return;
    }
    setCambiandoCorreo(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: nuevo },
        { emailRedirectTo: Linking.createURL("confirmacion") },
      );
      if (error) throw error;
      setCorreoNuevo("");
      setAvisoCorreo("Si el correo puede utilizarse, recibirás un enlace de confirmación. Revisa también tu correo actual. El acceso seguirá con tu dirección actual hasta completar la verificación.");
    } catch (err) {
      setErrorCorreo(mensajeError(err));
    } finally {
      setCambiandoCorreo(false);
    }
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.encabezado}>
            <Text accessibilityRole="header" style={styles.titulo}>Mi perfil</Text>
            <Text style={styles.subtitulo}>Actualiza tus datos y el correo con el que entras a FinTrack.</Text>
          </View>

          {cargando ? <ActivityIndicator color={color.primary} accessibilityLabel="Cargando perfil" /> : (
            <>
              {usuario && <Tarjeta>
                <Text style={styles.seccion}>Datos personales</Text>
                <Campo etiqueta="Nombre (opcional)" value={nombre} onChangeText={setNombre} autoCapitalize="words" autoComplete="name" maxLength={80} placeholder="Tu nombre" />
                <Campo etiqueta="Teléfono (opcional)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" autoComplete="tel" maxLength={25} placeholder="Ej. +593 99 123 4567" />
                <Text style={styles.ayuda}>El teléfono es solo un dato de perfil; no se verifica ni se usa para iniciar sesión.</Text>
                {errorDatos && <ErrorTexto>{errorDatos}</ErrorTexto>}
                {avisoDatos && <Text accessibilityLiveRegion="polite" style={styles.exito}>{avisoDatos}</Text>}
                <Boton titulo="Guardar datos" variante="primario" onPress={guardarDatos} loading={guardando} disabled={cambiandoCorreo} />
              </Tarjeta>}

              {usuario && <Tarjeta>
                <Text style={styles.seccion}>Correo de acceso</Text>
                <View style={styles.correoActual}>
                  <Text style={styles.etiqueta}>Correo actual</Text>
                  <Text selectable style={styles.valorCorreo}>{usuario.email ?? "Sin correo"}</Text>
                </View>
                <Campo etiqueta="Nuevo correo" value={correoNuevo} onChangeText={setCorreoNuevo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} placeholder="nuevo@ejemplo.com" />
                <Text style={styles.ayuda}>Te enviaremos un enlace de confirmación. Según la configuración de seguridad, quizá también debas confirmar desde tu correo actual.</Text>
                {errorCorreo && <ErrorTexto>{errorCorreo}</ErrorTexto>}
                {avisoCorreo && <Text accessibilityLiveRegion="polite" style={styles.exito}>{avisoCorreo}</Text>}
                <Boton titulo="Solicitar cambio de correo" onPress={cambiarCorreo} loading={cambiandoCorreo} disabled={guardando} />
              </Tarjeta>}

              {!usuario && errorDatos && <ErrorTexto>{errorDatos}</ErrorTexto>}
              {!usuario && <Boton titulo="Reintentar" onPress={() => setIntento((n) => n + 1)} />}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (color: Colors) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.bg },
  contenido: { padding: spacing(5), paddingBottom: spacing(10), gap: spacing(5) },
  encabezado: { gap: spacing(1.5) },
  titulo: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
  subtitulo: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
  seccion: { fontFamily: font.semibold, fontSize: 18, color: color.text },
  ayuda: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
  correoActual: { backgroundColor: color.surface2, borderRadius: radius.sm, padding: spacing(3), gap: spacing(1) },
  etiqueta: { fontFamily: font.semibold, fontSize: 12, color: color.textMuted },
  valorCorreo: { fontFamily: font.body, fontSize: 15, color: color.text },
  exito: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.success, backgroundColor: color.successBg, borderRadius: radius.sm, padding: spacing(3) },
});
