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
import {
  listarCuentas,
  parsearCorreoBancario,
  insertarTransaccionesDetectadas,
  mensajeError,
  type Cuenta,
  type TransaccionDetectadaInsert,
} from "core";
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
  desconectarProveedorActivo,
  traerCorreosDelProveedorActivo,
  type ProveedorCorreo,
} from "../lib/correoProveedor";

const CLAVE_ULTIMA_SYNC = "correo_ultima_sync";
const PROVEEDORES: ProveedorCorreo[] = ["gmail", "outlook"];

function cuentaParaTransaccion(
  cuentas: Cuenta[],
  banco: Cuenta["banco"] | undefined,
  identificador: string | undefined,
) {
  if (!banco) return undefined;
  const delBanco = cuentas.filter((c) => c.banco === banco);
  if (delBanco.length === 1) return delBanco[0].id;
  if (identificador)
    return delBanco.find((c) => c.identificador === identificador)?.id;
  return undefined; // ambiguo — se elige a mano en la Bandeja.
}

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
    try {
      await desconectarProveedorActivo();
      setConectado(null);
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
      const desdeGuardado = await AsyncStorage.getItem(CLAVE_ULTIMA_SYNC);
      // primera vez: mira los últimos 14 días, no toda la casilla.
      const desde = desdeGuardado
        ? new Date(desdeGuardado)
        : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const correos = await traerCorreosDelProveedorActivo(desde);
      const cuentas = await listarCuentas();

      const detectadas: TransaccionDetectadaInsert[] = [];
      for (const correo of correos) {
        const parseado = parsearCorreoBancario(
          correo.remitente,
          correo.asunto,
          correo.cuerpoTexto,
        );
        if (!parseado.tipo || !parseado.monto) continue; // sin tipo o sin monto no sirve de nada en la cola

        detectadas.push({
          mensajeId: correo.mensajeId,
          tipo: parseado.tipo,
          monto: parseado.monto,
          descripcion: parseado.descripcion,
          banco: parseado.banco,
          cuentaId: cuentaParaTransaccion(
            cuentas,
            parseado.banco,
            parseado.identificadorCuenta,
          ),
          fecha: parseado.fecha ?? correo.fecha,
          correoAsunto: correo.asunto,
        });
      }

      await insertarTransaccionesDetectadas(detectadas);
      await AsyncStorage.setItem(CLAVE_ULTIMA_SYNC, new Date().toISOString());
      setUltimaSync(new Date().toISOString());
      setResultado(
        detectadas.length === 0
          ? "No encontré movimientos nuevos que reconocer."
          : `Encontré ${detectadas.length} movimiento(s) nuevo(s) — revisalos en la Bandeja.`,
      );
    } catch (err) {
      setError(mensajeError(err));
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
            Detectá movimientos desde los avisos de tus bancos.
          </Text>
        </BlurFade>
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
