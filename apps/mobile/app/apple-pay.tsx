import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  configuracionAtajo,
  crearClaveCaptura,
  listarClavesCaptura,
  mensajeError,
  revocarClaveCaptura,
  MAXIMO_CLAVES_CAPTURA,
  type ClaveCaptura,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import Campo from "../components/Campo";
import ErrorTexto from "../components/ErrorTexto";
import EstadoVacio from "../components/EstadoVacio";
import { BlurFade } from "../components/Motion";
import { confirmar } from "../lib/dialogo";
import { spacing, useTheme, font, radius, type Colors } from "../lib/theme";

const atajo = configuracionAtajo(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "");

function fechaCorta(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) : "nunca";
}

/** Copia o comparte un texto. Share no necesita librería nativa nueva; en la web, el portapapeles. */
async function compartir(texto: string) {
  if (Platform.OS === "web") {
    await navigator.clipboard?.writeText(texto);
    return;
  }
  await Share.share({ message: texto });
}

const PASOS = [
  "Crea una clave aquí y cópiala: solo se muestra una vez.",
  "En el iPhone, abre Atajos → Automatización → + → Transacción, elige tus tarjetas y «Ejecutar inmediatamente».",
  "Agrega «Obtener ubicación actual» (opcional) y «Obtener contenido de URL» con la dirección, el método POST, el encabezado apikey y un cuerpo JSON con p_clave, p_monto (Importe), p_comercio (Comerciante), p_tarjeta (Tarjeta), p_latitud y p_longitud.",
  "Paga con Apple Pay: el pago aparece en la bandeja para que lo confirmes.",
];

export default function ApplePayScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [claves, setClaves] = useState<ClaveCaptura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("Mi iPhone");
  const [nueva, setNueva] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    listarClavesCaptura()
      .then(setClaves)
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      // La clave nueva solo vive mientras la pantalla está abierta.
      return () => setNueva(null);
    }, [cargar]),
  );

  async function crear() {
    setError(null);
    setCopiado(null);
    setCreando(true);
    try {
      setNueva(await crearClaveCaptura(nombre));
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCreando(false);
    }
  }

  async function copiar(texto: string, que: string) {
    try {
      await compartir(texto);
      setCopiado(que);
    } catch {
      setCopiado(null);
    }
  }

  async function revocar(c: ClaveCaptura) {
    const ok = await confirmar("Revocar clave", `¿Revocar "${c.nombre}"? El atajo que la usa dejará de funcionar.`, "Revocar");
    if (!ok) return;
    try {
      await revocarClaveCaptura(c.id);
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  const lleno = claves.length >= MAXIMO_CLAVES_CAPTURA;

  return (
    <ScrollView style={styles.contenedor} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Conectar Apple Pay</Text>
        <Text style={styles.screenIntro}>
          Cada pago con Apple Pay llega a tu bandeja para que lo confirmes. Necesitas un iPhone con iOS 17 o más nuevo.
        </Text>
      </BlurFade>

      <Tarjeta>
        <Text style={styles.tituloCard}>Cómo se configura</Text>
        {PASOS.map((p, i) => (
          <View key={i} style={styles.paso}>
            <Text style={styles.pasoNumero}>{i + 1}</Text>
            <Text style={styles.pasoTexto}>{p}</Text>
          </View>
        ))}
      </Tarjeta>

      <Tarjeta>
        <Text style={styles.tituloCard}>Datos para el atajo</Text>
        <Text style={styles.etiqueta}>Dirección (URL), método POST</Text>
        <Text selectable style={styles.codigo}>{atajo.url}</Text>
        <Boton titulo={copiado === "url" ? "Copiada ✓" : "Copiar dirección"} onPress={() => copiar(atajo.url, "url")} />
        <Text style={styles.etiqueta}>Encabezado apikey (clave pública)</Text>
        <Text selectable style={styles.codigo}>{atajo.encabezados.apikey}</Text>
        <Boton titulo={copiado === "apikey" ? "Copiada ✓" : "Copiar clave pública"} onPress={() => copiar(atajo.encabezados.apikey, "apikey")} />
      </Tarjeta>

      <Tarjeta>
        <Text style={styles.tituloCard}>Crear una clave</Text>
        {nueva ? (
          <>
            <Text style={styles.aviso}>Guárdala ahora: no se vuelve a mostrar. Trátala como una contraseña.</Text>
            <Text selectable style={styles.codigo} accessibilityLabel="Clave de captura nueva">{nueva}</Text>
            <Boton
              titulo={copiado === "clave" ? "Copiada ✓" : Platform.OS === "web" ? "Copiar clave" : "Compartir o copiar clave"}
              variante="primario"
              onPress={() => copiar(nueva, "clave")}
            />
            <Boton titulo="Listo, ya la guardé" onPress={() => setNueva(null)} />
          </>
        ) : lleno ? (
          <Text style={styles.pasoTexto}>Ya tienes {MAXIMO_CLAVES_CAPTURA} claves. Revoca una para crear otra.</Text>
        ) : (
          <>
            <Campo etiqueta="Nombre del dispositivo" value={nombre} onChangeText={setNombre} maxLength={40} placeholder="Mi iPhone" />
            <Boton titulo={creando ? "Creando…" : "Crear clave"} variante="primario" onPress={crear} loading={creando} disabled={creando} />
          </>
        )}
      </Tarjeta>

      {error && <ErrorTexto>{error}</ErrorTexto>}

      <Tarjeta style={{ gap: spacing(2) }}>
        <Text style={styles.tituloCard}>Tus claves</Text>
        {cargando ? (
          <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
        ) : claves.length === 0 ? (
          <EstadoVacio icono="key-outline" titulo="Todavía no tienes claves" subtitulo="Crea una para conectar tu iPhone." />
        ) : (
          claves.map((c) => (
            <View key={c.id} style={styles.claveFila}>
              <View style={{ flex: 1 }}>
                <Text style={styles.claveNombre}>{c.nombre}</Text>
                <Text style={styles.claveMeta}>ft_{c.prefijo}… · creada {fechaCorta(c.createdAt)} · último uso {fechaCorta(c.ultimoUso)}</Text>
              </View>
              <Boton titulo="Revocar" variante="peligro" onPress={() => revocar(c)} />
            </View>
          ))
        )}
      </Tarjeta>
    </ScrollView>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    tituloCard: { fontFamily: font.display, fontSize: 18, color: color.text },
    etiqueta: { fontFamily: font.semibold, fontSize: 12, color: color.textMuted },
    codigo: {
      fontFamily: font.mono,
      fontSize: 12,
      color: color.text,
      backgroundColor: color.bg,
      borderRadius: radius.sm,
      padding: spacing(2.5),
    },
    paso: { flexDirection: "row", gap: spacing(2.5) },
    pasoNumero: { fontFamily: font.semibold, fontSize: 13, color: color.primary, width: 16 },
    pasoTexto: { flex: 1, fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.text },
    aviso: { fontFamily: font.semibold, fontSize: 13, color: color.danger, backgroundColor: color.dangerBg, padding: 10, borderRadius: 8 },
    claveFila: { flexDirection: "row", alignItems: "center", gap: spacing(3), borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing(2) },
    claveNombre: { fontFamily: font.semibold, fontSize: 14, color: color.text },
    claveMeta: { fontFamily: font.body, fontSize: 12, color: color.textMuted, marginTop: 2 },
  });
