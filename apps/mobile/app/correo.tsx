import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mensajeError, resumenSincronizacion } from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import { spacing, useTheme, font, type Colors } from "../lib/theme";
import { BlurFade } from "../components/Motion";
import {
  ETIQUETA_PROVEEDOR,
  proveedorConfigurado,
  proveedorConectado,
  conectarProveedor,
  desconectarYBorrarCorreo,
  sincronizarCorreo,
  CLAVE_ULTIMA_SYNC,
  type ProveedorCorreo,
} from "../lib/correoProveedor";

const PROVEEDORES: ProveedorCorreo[] = ["gmail", "outlook"];

export default function CorreoScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [conectado, setConectado] = useState<
    ProveedorCorreo | null | undefined
  >(undefined);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [conectando, setConectando] = useState<ProveedorCorreo | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const desconexionEnCurso = useRef(false);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [avisoDesconexion, setAvisoDesconexion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    proveedorConectado()
      .then(setConectado)
      .catch((err) => {
        setError(mensajeError(err));
        setConectado(null);
      });
    AsyncStorage.getItem(CLAVE_ULTIMA_SYNC)
      .then(setUltimaSync)
      .catch((err) => setError(mensajeError(err)));
  }, []);
  useFocusEffect(cargar);

  async function conectar(proveedor: ProveedorCorreo) {
    setError(null);
    setConectando(proveedor);
    try {
      await conectarProveedor(proveedor);
      setConectado(proveedor);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setConectando(null);
    }
  }

  async function desconectar() {
    if (desconexionEnCurso.current || buscando) return;
    desconexionEnCurso.current = true;
    setDesconectando(true);
    setError(null);
    setAvisoDesconexion(null);
    try {
      // Borra lo leído de los correos y luego quita el permiso (ver lib/correoProveedor).
      const { proveedor, revocado, borrados } = await desconectarYBorrarCorreo();
      setConectado(null);
      setUltimaSync(null);
      setResultado(null);
      const permiso = revocado
        ? "Se quitó el permiso de la app en tu cuenta."
        : proveedor === "outlook"
          ? "Para quitar el permiso por completo, entrá a account.live.com/consent/Manage y eliminá esta app."
          : "No se pudo confirmar la revocación con el proveedor: revisá myaccount.google.com/permissions.";
      setAvisoDesconexion(
        `Correo desconectado. ${permiso} Se borraron ${borrados} registro(s) leídos de tus correos.`,
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      desconexionEnCurso.current = false;
      setDesconectando(false);
    }
  }

  async function buscarAhora() {
    if (desconexionEnCurso.current) return;
    setError(null);
    setResultado(null);
    setBuscando(true);
    try {
      // Paginación, marca de búsqueda y conteos: ver sincronizarCorreo en lib/correoProveedor.
      const r = await sincronizarCorreo();
      if (r.marca) setUltimaSync(r.marca);
      setResultado(resumenSincronizacion(r));
    } catch (err) {
      setError(mensajeError(err));
      // Si el permiso venció, los tokens ya se borraron: refleja "sin conectar".
      proveedorConectado().then(setConectado).catch(() => {});
    } finally {
      setBuscando(false);
    }
  }

  if (conectado === undefined)
    return (
      <View
        style={[
          styles.contenedor,
          {
            alignItems: "center",
            justifyContent: "center",
            padding: spacing(5),
          },
        ]}
      >
        <Text style={styles.textoMuted}>Cargando conexión de correo…</Text>
      </View>
    );

  return (
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
          gap: spacing(4),
        }}
      >
        <BlurFade style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.screenTitle}>
            Correo
          </Text>
          <Text style={styles.screenIntro}>
            Opcional y en prueba (beta): detectá movimientos desde los avisos
            de tus bancos. Podés usar la app sin conectar tu correo.
          </Text>
        </BlurFade>
        <Tarjeta>
          <View style={styles.filaTitulo}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={color.textMuted}
            />
            <Text style={styles.tituloCard}>Qué lee y qué guarda</Text>
          </View>
          <Text style={styles.textoMuted}>
            • Solo busca cuando tocás «Buscar ahora», y solo correos recientes
            (desde la última búsqueda; la primera vez, 14 días). El permiso de
            Google o Microsoft técnicamente permite leer tu bandeja.
          </Text>
          <Text style={styles.textoMuted}>
            • El texto del correo se analiza en tu teléfono. De cada aviso
            reconocido se guarda monto, fecha, banco y asunto; el asunto se
            borra al confirmarlo o descartarlo.
          </Text>
          <Text style={styles.textoMuted}>
            • Nada se convierte en gasto sin que lo confirmes en la Bandeja.
          </Text>
          <Text style={styles.textoMuted}>
            • Al desconectar se quita el permiso y se borran estos datos. Los
            gastos que ya confirmaste se quedan.
          </Text>
        </Tarjeta>
        {PROVEEDORES.every((p) => !proveedorConfigurado(p)) && (
          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Ionicons
                name="construct-outline"
                size={18}
                color={color.warning}
              />
              <Text style={styles.tituloCard}>
                Falta configurar la conexión
              </Text>
            </View>
            <Text style={styles.texto}>
              La conexión con Gmail y Outlook todavía no está disponible.
            </Text>
            <Text style={styles.textoMuted}>
              Podés seguir registrando movimientos manualmente mientras se
              habilita la conexión.
            </Text>
          </Tarjeta>
        )}

        <Tarjeta>
          <View style={styles.filaTitulo}>
            <Ionicons
              name={conectado ? "checkmark-circle" : "mail-outline"}
              size={20}
              color={conectado ? color.success : color.textMuted}
            />
            <Text style={styles.tituloCard}>
              {conectado
                ? `${ETIQUETA_PROVEEDOR[conectado]} conectado`
                : "Correo no conectado"}
            </Text>
          </View>
          <Text style={styles.textoMuted}>
            {conectado
              ? "La app puede leer tu bandeja de entrada para detectar avisos de tus bancos."
              : "Conectá tu correo para que la app detecte gastos e ingresos sola desde los avisos de tus bancos."}
          </Text>
          {conectado ? (
            <Boton
              titulo={desconectando ? "Desconectando…" : "Desconectar correo"}
              variante="peligro"
              onPress={desconectar}
              loading={desconectando}
              disabled={desconectando || buscando}
            />
          ) : (
            <View style={{ gap: spacing(2) }}>
              {PROVEEDORES.map((p) => (
                <Boton
                  key={p}
                  titulo={
                    conectando === p
                      ? "Conectando…"
                      : `Conectar ${ETIQUETA_PROVEEDOR[p]}`
                  }
                  variante="primario"
                  onPress={() => conectar(p)}
                  loading={conectando === p}
                  disabled={!proveedorConfigurado(p) || conectando !== null}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
          )}
          {avisoDesconexion && (
            <Text accessibilityLiveRegion="polite" style={styles.textoOk}>
              {avisoDesconexion}
            </Text>
          )}
        </Tarjeta>

        {conectado && (
          <Tarjeta>
            <Text style={styles.tituloCard}>Buscar movimientos nuevos</Text>
            <Text style={styles.textoMuted}>
              {ultimaSync
                ? `Última búsqueda: ${new Date(ultimaSync).toLocaleString("es-EC")}`
                : "Todavía no buscaste nunca."}
            </Text>
            <Boton
              titulo={buscando ? "Buscando…" : "Buscar ahora"}
              variante="primario"
              onPress={buscarAhora}
              loading={buscando}
              disabled={buscando || desconectando}
            />
            {resultado && <Text style={styles.textoOk}>{resultado}</Text>}
            <Boton
              titulo="Ver bandeja de revisión"
              onPress={() => router.push("/bandeja")}
            />
          </Tarjeta>
        )}

        {error && <ErrorTexto>{error}</ErrorTexto>}
      </ScrollView>
    </KeyboardAvoidingView>
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
    filaTitulo: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing(2),
    },
    tituloCard: { fontFamily: font.display, fontSize: 20, color: color.text },
    texto: {
      fontFamily: font.body,
      fontSize: 13.5,
      color: color.text,
      lineHeight: 20,
    },
    textoMuted: {
      fontFamily: font.body,
      fontSize: 13,
      color: color.textMuted,
      lineHeight: 19,
    },
    textoOk: { fontFamily: font.body, fontSize: 13, color: color.success },
  });
