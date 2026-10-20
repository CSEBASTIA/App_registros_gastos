import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  eliminarLugar,
  fusionarLugares,
  listarCategorias,
  listarGastosDeLugar,
  listarLugares,
  mensajeError,
  mesLocal,
  rangoDelMes,
  renombrarLugar,
  resumenPorLugar,
  ETIQUETA_BILLETERA,
  type Categoria,
  type Gasto,
  type Lugar,
  type ResumenLugar,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import Boton from "../../components/Boton";
import Campo from "../../components/Campo";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import SelectorMes from "../../components/SelectorMes";
import EstadoVacio from "../../components/EstadoVacio";
import { BlurFade } from "../../components/Motion";
import { abrirEnMapas } from "../../lib/ubicacion";
import { confirmar } from "../../lib/dialogo";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";

export default function LugarScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const { id, mes: mesInicial } = useLocalSearchParams<{ id: string; mes?: string }>();
  const [mes, setMes] = useState(mesInicial ?? mesLocal());
  const [lugar, setLugar] = useState<Lugar | undefined>();
  const [otros, setOtros] = useState<Lugar[]>([]);
  const [resumen, setResumen] = useState<ResumenLugar | undefined>();
  const [pagos, setPagos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [destino, setDestino] = useState("");
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    const rango = rangoDelMes(mes);
    setCargando(true);
    setError(null);
    Promise.all([listarLugares(), resumenPorLugar(rango.desde, rango.hasta), listarGastosDeLugar(id, rango), listarCategorias()])
      .then(([todos, r, g, c]) => {
        const este = todos.find((l) => l.id === id);
        setLugar(este);
        setNombre(este?.nombre ?? "");
        setOtros(todos.filter((l) => l.id !== id));
        setResumen(r.find((x) => x.lugarId === id));
        setPagos(g);
        setCategorias(c);
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, [id, mes]);

  useFocusEffect(cargar);

  async function guardarNombre() {
    setError(null);
    setTrabajando(true);
    try {
      setLugar(await renombrarLugar(id, nombre));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function fusionar() {
    const otro = otros.find((l) => l.id === destino);
    if (!lugar || !otro) return;
    const ok = await confirmar(
      "Fusionar lugares",
      `Los pagos de "${lugar.nombre}" pasan a "${otro.nombre}" y "${lugar.nombre}" se borra.`,
      "Fusionar",
    );
    if (!ok) return;
    setTrabajando(true);
    try {
      await fusionarLugares(id, otro.id);
      router.replace({ pathname: "/lugar/[id]", params: { id: otro.id, mes } });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function borrar() {
    if (!lugar) return;
    const ok = await confirmar("Borrar lugar", `¿Borrar "${lugar.nombre}"? Los pagos no se borran: quedan sin lugar.`, "Borrar");
    if (!ok) return;
    setTrabajando(true);
    try {
      await eliminarLugar(id);
      router.back();
    } catch (err) {
      setError(mensajeError(err));
      setTrabajando(false);
    }
  }

  if (cargando && !lugar)
    return (
      <View style={[styles.contenedor, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
      </View>
    );

  if (!lugar)
    return (
      <View style={styles.contenedor}>
        <EstadoVacio icono="location-outline" titulo="Este lugar ya no existe" subtitulo="Quizá se fusionó con otro o se borró." />
        {error && <ErrorTexto>{error}</ErrorTexto>}
      </View>
    );

  return (
    <ScrollView style={styles.contenedor} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(8), gap: spacing(4) }}>
      <BlurFade style={{ gap: spacing(2) }}>
        <Text accessibilityRole="header" style={styles.screenTitle}>{lugar.nombre}</Text>
        {lugar.direccion && <Text style={styles.meta}>Ubicado en {lugar.direccion}</Text>}
        <SelectorMes mes={mes} onCambiar={setMes} />
      </BlurFade>

      <Tarjeta>
        {resumen ? (
          <View style={styles.cifras}>
            <Cifra etiqueta="Total" valor={`$${resumen.total.toFixed(2)}`} styles={styles} />
            <Cifra etiqueta="Pagos" valor={String(resumen.pagos)} styles={styles} />
            <Cifra etiqueta="Promedio" valor={`$${resumen.promedio.toFixed(2)}`} styles={styles} />
          </View>
        ) : (
          <Text style={styles.meta}>Sin pagos aquí en este mes.</Text>
        )}
        {resumen?.billetera && <Text style={styles.meta}>Pagas sobre todo con {ETIQUETA_BILLETERA[resumen.billetera]}.</Text>}
        <Boton titulo="Abrir en Mapas" onPress={() => abrirEnMapas(lugar).catch(() => undefined)} />
      </Tarjeta>

      <Tarjeta style={{ gap: spacing(2) }}>
        <Text style={styles.tituloCard}>Pagos del mes</Text>
        {pagos.length === 0 ? (
          <Text style={styles.meta}>No hay pagos en este mes.</Text>
        ) : (
          pagos.map((g) => (
            <View key={g.id} style={styles.pago}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pagoNombre} numberOfLines={1}>{g.descripcion}</Text>
                <Text style={styles.meta}>
                  {categorias.find((c) => c.id === g.categoriaId)?.nombre ?? "Sin categoría"} · {g.fecha}
                  {g.billetera ? ` · ${ETIQUETA_BILLETERA[g.billetera]}` : ""}
                </Text>
              </View>
              <Text style={styles.monto}>${g.monto.toFixed(2)}</Text>
            </View>
          ))
        )}
      </Tarjeta>

      <Tarjeta>
        <Text style={styles.tituloCard}>Renombrar</Text>
        <Campo etiqueta="Nombre del lugar" value={nombre} onChangeText={setNombre} maxLength={80} />
        <Text style={styles.meta}>Dos sucursales con el mismo nombre se suman juntas en «Por comercio».</Text>
        <Boton titulo="Guardar nombre" variante="primario" onPress={guardarNombre} disabled={trabajando || nombre.trim() === lugar.nombre} />
      </Tarjeta>

      {otros.length > 0 && (
        <Tarjeta>
          <Text style={styles.tituloCard}>Fusionar con otro lugar</Text>
          <SelectorChips titulo="Pasar sus pagos a" valor={destino} onCambiar={setDestino} opciones={otros.map((l) => ({ valor: l.id, etiqueta: l.nombre }))} />
          <Boton titulo="Fusionar" onPress={fusionar} disabled={!destino || trabajando} />
        </Tarjeta>
      )}

      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton titulo="Borrar lugar" variante="peligro" onPress={borrar} disabled={trabajando} />
    </ScrollView>
  );
}

function Cifra({ etiqueta, valor, styles }: { etiqueta: string; valor: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.meta}>{etiqueta}</Text>
      <Text style={styles.monto}>{valor}</Text>
    </View>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    screenTitle: { fontFamily: font.display, fontSize: 28, lineHeight: 34, color: color.text },
    tituloCard: { fontFamily: font.display, fontSize: 18, color: color.text },
    cifras: { flexDirection: "row", gap: spacing(3) },
    meta: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: color.textMuted },
    monto: { fontFamily: font.mono, fontSize: 15, color: color.text },
    pago: { flexDirection: "row", alignItems: "center", gap: spacing(3), borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing(2) },
    pagoNombre: { fontFamily: font.semibold, fontSize: 14, color: color.text },
  });
