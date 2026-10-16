import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { crearClaveCaptura, listarClavesCaptura, mensajeError, revocarClaveCaptura } from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import { BlurFade } from "../components/Motion";
import { confirmar } from "../lib/dialogo";
import { spacing, useTheme, font, type Colors } from "../lib/theme";
import { capturaGoogleWallet, type EstadoCaptura, type ResultadoCaptura } from "../modules/captura-billetera";

const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const CLAVE_PUBLICA = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

function haceCuanto(ms: number): string {
  const minutos = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return new Date(ms).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

function textoUltimo(u: ResultadoCaptura): string {
  const monto = u.monto !== undefined ? ` $${u.monto.toFixed(2)}` : "";
  switch (u.estado) {
    case "recibido":
      return `Llegó a la bandeja un pago de${monto} · ${haceCuanto(u.cuando)}`;
    case "repetido":
      return `Aviso repetido de${monto}: no se duplicó · ${haceCuanto(u.cuando)}`;
    case "ignorado":
      return `Notificación de Google Wallet que no era un pago · ${haceCuanto(u.cuando)}`;
    case "pendiente":
      return `${u.mensaje ?? "Esperando internet"} · ${haceCuanto(u.cuando)}`;
    default:
      return `${u.mensaje ?? "No se pudo enviar"} · ${haceCuanto(u.cuando)}`;
  }
}

export default function GoogleWalletScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [estado, setEstado] = useState<EstadoCaptura | null>(() => capturaGoogleWallet?.estado() ?? null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(() => {
    if (!capturaGoogleWallet) return;
    const e = capturaGoogleWallet.estado();
    setEstado(e);
    if (e.conectado && e.pendientes > 0) capturaGoogleWallet.reintentar();
  }, []);

  useFocusEffect(refrescar);

  // Al volver de los ajustes de Android, el permiso puede haber cambiado.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && refrescar());
    return () => sub.remove();
  }, [refrescar]);

  async function conectar() {
    if (!capturaGoogleWallet) return;
    setError(null);
    setTrabajando(true);
    try {
      // La clave no se muestra: va directo al almacenamiento privado de la app.
      const clave = await crearClaveCaptura("Google Wallet (Android)");
      capturaGoogleWallet.conectar(URL_SUPABASE, CLAVE_PUBLICA, clave);
      refrescar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function desconectar() {
    if (!capturaGoogleWallet || !estado) return;
    const ok = await confirmar(
      "Desconectar Google Wallet",
      "Tus pagos dejarán de llegar solos a la bandeja. Lo que ya llegó se queda.",
      "Desconectar",
    );
    if (!ok) return;
    setError(null);
    setTrabajando(true);
    try {
      const clave = (await listarClavesCaptura()).find((c) => c.prefijo === estado.prefijo);
      if (clave) await revocarClaveCaptura(clave.id);
    } catch (err) {
      setError(`Se desconectó este teléfono, pero no se pudo revocar la clave (${mensajeError(err)}). Revócala en «Conectar Apple Pay» → Tus claves.`);
    } finally {
      capturaGoogleWallet.desconectar();
      refrescar();
      setTrabajando(false);
    }
  }

  const listo = !!estado?.conectado && !!estado?.permiso;

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Conectar Google Wallet</Text>
        <Text style={styles.screenIntro}>
          Cuando pagas con Google Wallet, el pago llega solo a tu bandeja para que lo confirmes.
        </Text>
      </BlurFade>

      {!capturaGoogleWallet ? (
        <Tarjeta style={{ gap: spacing(2) }}>
          <Text style={styles.tituloCard}>
            {Platform.OS === "ios" ? "En el iPhone se usa Apple Pay" : Platform.OS === "web" ? "Solo en el teléfono Android" : "Actualiza la app"}
          </Text>
          <Text style={styles.texto}>
            {Platform.OS === "ios"
              ? "Google Wallet es de Android. En el iPhone, tus pagos llegan con el atajo de Apple Pay."
              : Platform.OS === "web"
                ? "Esto funciona en la app de Android, que lee la notificación de Google Wallet al pagar. Ábrela en tu teléfono."
                : "Esta función necesita la versión 1.1.0 de FinTrack o más nueva. Instala el APK nuevo y vuelve a esta pantalla."}
          </Text>
          {Platform.OS === "ios" && <Boton titulo="Ir a Conectar Apple Pay" onPress={() => router.replace("/apple-pay")} />}
        </Tarjeta>
      ) : (
        <>
          {listo && (
            <View style={styles.listo} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={20} color={color.success} />
              <Text style={styles.listoTexto}>Listo: tus pagos con Google Wallet llegan a la bandeja.</Text>
            </View>
          )}

          <Tarjeta style={{ gap: spacing(2) }}>
            <Text style={styles.tituloCard}>Qué lee la app</Text>
            <Text style={styles.texto}>
              Solo las notificaciones de Google Wallet: el comercio, el monto y los últimos dígitos de la tarjeta. Las
              notificaciones de las demás apps se ignoran y no se guardan. Los pagos rechazados o reembolsos no se
              registran. Si no tienes internet, el aviso se envía después, con la fecha del pago.
            </Text>
          </Tarjeta>

          <Tarjeta style={{ gap: spacing(2) }}>
            <Paso numero={1} hecho={!!estado?.conectado} titulo="Conectar este teléfono" />
            {estado?.conectado ? (
              <Text style={styles.texto}>Conectado con la clave ft_{estado.prefijo}…</Text>
            ) : (
              <>
                <Text style={styles.texto}>Se crea una clave solo para este teléfono. Puedes revocarla cuando quieras.</Text>
                <Boton titulo={trabajando ? "Conectando…" : "Conectar"} variante="primario" onPress={conectar} loading={trabajando} disabled={trabajando} />
              </>
            )}
          </Tarjeta>

          <Tarjeta style={{ gap: spacing(2) }}>
            <Paso numero={2} hecho={!!estado?.permiso} titulo="Permitir leer las notificaciones" />
            {estado?.permiso ? (
              <Text style={styles.texto}>Permiso concedido. Puedes quitarlo en los ajustes de Android cuando quieras.</Text>
            ) : (
              <>
                <Text style={styles.texto}>
                  Android te pedirá activar «FinTrack: pagos con Google Wallet» en Acceso a notificaciones.
                </Text>
                <Text style={styles.nota}>
                  Si dice «Ajuste restringido» (Android 13 o más nuevo, con la app instalada desde un APK): ve a Ajustes →
                  Apps → FinTrack → menú ⋮ → «Permitir ajustes restringidos», y vuelve a intentarlo.
                </Text>
                <Boton titulo="Abrir ajustes de Android" variante={estado?.conectado ? "primario" : undefined} onPress={() => capturaGoogleWallet?.abrirPermiso()} />
              </>
            )}
          </Tarjeta>

          {estado?.conectado && (
            <Tarjeta style={{ gap: spacing(2) }}>
              <Text style={styles.tituloCard}>Último aviso</Text>
              <Text style={styles.texto}>{estado.ultimo ? textoUltimo(estado.ultimo) : "Todavía no llega ninguno. Paga con Google Wallet y aparecerá aquí."}</Text>
              {estado.pendientes > 0 && (
                <>
                  <Text style={styles.nota}>
                    {estado.pendientes === 1 ? "1 aviso espera" : `${estado.pendientes} avisos esperan`} a que haya internet.
                  </Text>
                  <Boton titulo="Reintentar ahora" onPress={() => { capturaGoogleWallet?.reintentar(); setTimeout(refrescar, 3000); }} />
                </>
              )}
              <Boton titulo="Ver la bandeja" onPress={() => router.push("/bandeja")} />
              <Boton titulo="Desconectar" variante="peligro" onPress={desconectar} disabled={trabajando} />
            </Tarjeta>
          )}
        </>
      )}

      {error && <ErrorTexto>{error}</ErrorTexto>}
    </ScrollView>
  );
}

function Paso({ numero, hecho, titulo }: { numero: number; hecho: boolean; titulo: string }) {
  const { color } = useTheme();
  const styles = createStyles(color);
  return (
    <View style={styles.paso}>
      {hecho ? (
        <Ionicons name="checkmark-circle" size={22} color={color.success} accessibilityLabel="Hecho" />
      ) : (
        <Text style={styles.pasoNumero}>{numero}</Text>
      )}
      <Text style={styles.tituloCard}>{titulo}</Text>
    </View>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    screenIntro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    tituloCard: { fontFamily: font.display, fontSize: 18, color: color.text, flexShrink: 1 },
    texto: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.text },
    nota: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: color.textMuted },
    paso: { flexDirection: "row", alignItems: "center", gap: spacing(2.5) },
    pasoNumero: {
      fontFamily: font.semibold,
      fontSize: 13,
      color: color.text,
      width: 22,
      height: 22,
      lineHeight: 22,
      textAlign: "center",
      borderRadius: 11,
      backgroundColor: color.surface2,
      overflow: "hidden",
    },
    listo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2),
      backgroundColor: color.successBg,
      borderRadius: 12,
      padding: spacing(3),
    },
    listoTexto: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: color.success },
  });
