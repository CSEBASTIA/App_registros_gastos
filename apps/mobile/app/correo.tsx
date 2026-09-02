import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
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
import { color, spacing } from "../lib/theme";
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

function cuentaParaTransaccion(cuentas: Cuenta[], banco: Cuenta["banco"] | undefined, identificador: string | undefined) {
  if (!banco) return undefined;
  const delBanco = cuentas.filter((c) => c.banco === banco);
  if (delBanco.length === 1) return delBanco[0].id;
  if (identificador) return delBanco.find((c) => c.identificador === identificador)?.id;
  return undefined; // ambiguo — se elige a mano en la Bandeja.
}

export default function CorreoScreen() {
  const router = useRouter();
  const [conectado, setConectado] = useState<ProveedorCorreo | null | undefined>(undefined);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [conectando, setConectando] = useState<ProveedorCorreo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    proveedorConectado().then(setConectado);
    AsyncStorage.getItem(CLAVE_ULTIMA_SYNC).then(setUltimaSync);
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
    await desconectarProveedorActivo();
    setConectado(null);
  }

  async function buscarAhora() {
    setError(null);
    setResultado(null);
    setBuscando(true);
    try {
      const desdeGuardado = await AsyncStorage.getItem(CLAVE_ULTIMA_SYNC);
      // primera vez: mira los últimos 14 días, no toda la casilla.
      const desde = desdeGuardado ? new Date(desdeGuardado) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const correos = await traerCorreosDelProveedorActivo(desde);
      const cuentas = await listarCuentas();

      const detectadas: TransaccionDetectadaInsert[] = [];
      for (const correo of correos) {
        const parseado = parsearCorreoBancario(correo.remitente, correo.asunto, correo.cuerpoTexto);
        if (!parseado.tipo || !parseado.monto) continue; // sin tipo o sin monto no sirve de nada en la cola

        detectadas.push({
          mensajeId: correo.mensajeId,
          tipo: parseado.tipo,
          monto: parseado.monto,
          descripcion: parseado.descripcion,
          banco: parseado.banco,
          cuentaId: cuentaParaTransaccion(cuentas, parseado.banco, parseado.identificadorCuenta),
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
          : `Encontré ${detectadas.length} movimiento(s) nuevo(s) — revisalos en la Bandeja.`
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBuscando(false);
    }
  }

  if (conectado === undefined) return null;

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      {PROVEEDORES.every((p) => !proveedorConfigurado(p)) && (
        <Tarjeta>
          <View style={styles.filaTitulo}>
            <Ionicons name="construct-outline" size={18} color={color.warning} />
            <Text style={styles.tituloCard}>Falta configurar la conexión</Text>
          </View>
          <Text style={styles.texto}>
            Conectar Gmail u Outlook necesita un Client ID que todavía no está configurado.
          </Text>
          <Text style={styles.textoMuted}>
            <Text style={{ fontWeight: "700" }}>Gmail</Text> (variable{" "}
            <Text style={styles.mono}>EXPO_PUBLIC_GOOGLE_CLIENT_ID</Text>):{"\n"}
            1. console.cloud.google.com → crear proyecto → APIs & Services → Credentials → Create Credentials →
            OAuth client ID → tipo "Web application".{"\n"}
            2. Habilitar la Gmail API para ese proyecto.{"\n"}
            3. Agregar <Text style={styles.mono}>gastosapp://redirect</Text> como URI de redirección autorizado.{"\n"}
            4. Copiar el Client ID a la variable de entorno.
          </Text>
          <Text style={styles.textoMuted}>
            <Text style={{ fontWeight: "700" }}>Outlook</Text> (variable{" "}
            <Text style={styles.mono}>EXPO_PUBLIC_MS_CLIENT_ID</Text>):{"\n"}
            1. portal.azure.com → Microsoft Entra ID → App registrations → New registration.{"\n"}
            2. Tipo de cuenta: "Accounts in any organizational directory and personal Microsoft accounts".{"\n"}
            3. En Authentication, agregar plataforma "Mobile and desktop applications" con el redirect URI{" "}
            <Text style={styles.mono}>gastosapp://redirect</Text>.{"\n"}
            4. Copiar el "Application (client) ID" a la variable de entorno.
          </Text>
        </Tarjeta>
      )}

      <Tarjeta>
        <View style={styles.filaTitulo}>
          <Ionicons name={conectado ? "checkmark-circle" : "mail-outline"} size={20} color={conectado ? color.success : color.textMuted} />
          <Text style={styles.tituloCard}>
            {conectado ? `${ETIQUETA_PROVEEDOR[conectado]} conectado` : "Correo no conectado"}
          </Text>
        </View>
        <Text style={styles.textoMuted}>
          {conectado
            ? "La app puede leer tu bandeja de entrada para detectar avisos de tus bancos."
            : "Conectá tu correo para que la app detecte gastos e ingresos sola desde los avisos de tus bancos."}
        </Text>
        {conectado ? (
          <Boton titulo="Desconectar correo" variante="peligro" onPress={desconectar} />
        ) : (
          <View style={{ flexDirection: "row", gap: spacing(2) }}>
            {PROVEEDORES.map((p) => (
              <Boton
                key={p}
                titulo={conectando === p ? "Conectando…" : `Conectar ${ETIQUETA_PROVEEDOR[p]}`}
                variante="primario"
                onPress={() => conectar(p)}
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
            {ultimaSync ? `Última búsqueda: ${new Date(ultimaSync).toLocaleString("es-EC")}` : "Todavía no buscaste nunca."}
          </Text>
          <Boton titulo={buscando ? "Buscando…" : "Buscar ahora"} variante="primario" onPress={buscarAhora} disabled={buscando} />
          {resultado && <Text style={styles.textoOk}>{resultado}</Text>}
          <Boton titulo="Ver bandeja de revisión" onPress={() => router.push("/bandeja")} />
        </Tarjeta>
      )}

      {error && <ErrorTexto>{error}</ErrorTexto>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  filaTitulo: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  tituloCard: { fontSize: 15, fontWeight: "700", color: color.text },
  texto: { fontSize: 13.5, color: color.text, lineHeight: 20 },
  textoMuted: { fontSize: 13, color: color.textMuted, lineHeight: 19 },
  textoOk: { fontSize: 13, color: color.success },
  mono: { fontFamily: "monospace", fontSize: 12.5, backgroundColor: color.bg, color: color.text },
});
