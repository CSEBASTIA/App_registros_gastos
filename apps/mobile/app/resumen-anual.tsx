import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  cifrasAnuales,
  etiquetaMes,
  formatMonto,
  mensajeError,
  mesLocal,
  obtenerResumenAnual,
  type ResumenAnual,
} from "core";
import Tarjeta from "../components/Tarjeta";
import Boton from "../components/Boton";
import ErrorTexto from "../components/ErrorTexto";
import EstadoVacio from "../components/EstadoVacio";
import GraficoBarras from "../components/GraficoBarras";
import { font, radius, spacing, useTheme, type Colors } from "../lib/theme";

/** «Marzo de 2026» */
const nombreMes = (mes: string) => `${etiquetaMes(mes)} de ${mes.slice(0, 4)}`;

/**
 * Resumen de un año: cuánto entró y salió cada mes, en qué categorías y
 * comercios se fue el dinero, y los meses que ya pasaron sin datos, con un
 * atajo para subir su estado de cuenta en PDF (se guarda en el historial,
 * sin cambiar el saldo de hoy).
 */
export default function ResumenAnualScreen() {
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const mesActual = mesLocal();
  const anioActual = Number(mesActual.slice(0, 4));
  const [anio, setAnio] = useState(anioActual);
  const [resumen, setResumen] = useState<ResumenOVacio>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      setResumen(undefined);
      setError(null);
      obtenerResumenAnual(anio)
        .then((r) => activo && setResumen(r))
        .catch((err) => {
          if (!activo) return;
          setError(mensajeError(err));
          setResumen(null);
        });
      return () => {
        activo = false;
      };
    }, [anio, intento]),
  );

  const cifras = resumen ? cifrasAnuales(resumen, mesActual) : null;
  const sinMovimientos = !!cifras && cifras.totalGastos === 0 && cifras.totalIngresos === 0;

  function subirEstado(mes?: string) {
    router.push({ pathname: "/importar-estado", params: mes ? { mes } : {} });
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.selectorAnio}>
          <Pressable
            onPress={() => setAnio((a) => a - 1)}
            disabled={anio <= 2000}
            accessibilityRole="button"
            accessibilityLabel="Año anterior"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={color.text} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.anio}>
            {anio}
          </Text>
          <Pressable
            onPress={() => setAnio((a) => a + 1)}
            disabled={anio >= anioActual}
            accessibilityRole="button"
            accessibilityLabel="Año siguiente"
            hitSlop={12}
          >
            <Ionicons name="chevron-forward" size={24} color={anio >= anioActual ? color.textFaint : color.text} />
          </Pressable>
        </View>

        {resumen === undefined && <ActivityIndicator color={color.primary} accessibilityLabel="Cargando el resumen" />}
        {error && (
          <>
            <ErrorTexto>{error}</ErrorTexto>
            <Boton titulo="Reintentar" onPress={() => setIntento((n) => n + 1)} />
          </>
        )}

        {resumen && cifras && sinMovimientos && (
          <>
            <EstadoVacio
              icono="calendar-outline"
              titulo={`Sin movimientos en ${anio}`}
              subtitulo="Sube los estados de cuenta en PDF de esos meses y se arma tu resumen del año, sin cambiar el saldo de hoy."
            />
            <Boton titulo="Subir un estado de cuenta" variante="primario" onPress={() => subirEstado()} />
          </>
        )}

        {resumen && cifras && !sinMovimientos && (
          <>
            <Tarjeta>
              <View style={styles.fila}>
                <Cifra etiqueta="Gastaste" valor={formatMonto(cifras.totalGastos)} styles={styles} />
                <Cifra etiqueta="Entró" valor={formatMonto(cifras.totalIngresos)} styles={styles} />
              </View>
              <View style={styles.fila}>
                <Cifra
                  etiqueta={cifras.ahorro >= 0 ? "Ahorraste" : "Gastaste de más"}
                  valor={formatMonto(Math.abs(cifras.ahorro))}
                  tono={cifras.ahorro >= 0 ? color.success : color.danger}
                  styles={styles}
                />
                <Cifra etiqueta="Promedio al mes" valor={formatMonto(cifras.promedioMensual)} styles={styles} />
              </View>
              {cifras.mesMayorGasto && (
                <Text style={styles.ayuda}>
                  El mes más caro fue {nombreMes(cifras.mesMayorGasto.mes)}: {formatMonto(cifras.mesMayorGasto.gastos)}.
                </Text>
              )}
            </Tarjeta>

            <Tarjeta>
              <Text style={styles.seccion}>Gastos por mes</Text>
              <GraficoBarras
                datos={resumen.meses.map((m) => ({
                  etiqueta: etiquetaMes(m.mes).slice(0, 3),
                  valor: m.gastos,
                  color: color.primary,
                }))}
              />
            </Tarjeta>

            {resumen.categorias.length > 0 && (
              <Tarjeta>
                <Text style={styles.seccion}>En qué se fue</Text>
                {resumen.categorias.map((c, i) => (
                  <View key={c.categoriaId ?? c.nombre} style={styles.filaLista}>
                    <View style={styles.filaListaTexto}>
                      <View style={styles.filaTitulo}>
                        <View style={[styles.punto, { backgroundColor: c.color ?? color.textMuted }]} />
                        <Text style={styles.nombre} numberOfLines={1}>
                          {c.nombre}
                        </Text>
                      </View>
                      <View style={styles.barraFondo}>
                        <View
                          style={[styles.barra, { width: `${Math.max(2, cifras.porcentajes[i])}%`, backgroundColor: c.color ?? color.primary }]}
                        />
                      </View>
                    </View>
                    <View style={styles.filaListaDerecha}>
                      <Text style={styles.monto}>{formatMonto(c.total)}</Text>
                      <Text style={styles.ayuda}>{cifras.porcentajes[i]} %</Text>
                    </View>
                  </View>
                ))}
              </Tarjeta>
            )}

            {resumen.comercios.length > 0 && (
              <Tarjeta>
                <Text style={styles.seccion}>Dónde más gastaste</Text>
                {resumen.comercios.map((c) => (
                  <View key={c.descripcion} style={styles.filaLista}>
                    <Text style={[styles.nombre, { flex: 1 }]} numberOfLines={1}>
                      {c.descripcion}
                    </Text>
                    <View style={styles.filaListaDerecha}>
                      <Text style={styles.monto}>{formatMonto(c.total)}</Text>
                      <Text style={styles.ayuda}>{c.cantidad === 1 ? "1 vez" : `${c.cantidad} veces`}</Text>
                    </View>
                  </View>
                ))}
              </Tarjeta>
            )}
          </>
        )}

        {resumen && cifras && cifras.mesesSinDatos.length > 0 && !sinMovimientos && (
          <Tarjeta>
            <Text style={styles.seccion}>Meses sin datos</Text>
            <Text style={styles.ayuda}>
              Sube el estado de cuenta en PDF de cada mes para completar tu año. Se guarda en tu historial: cuenta en este resumen sin
              cambiar el saldo de hoy.
            </Text>
            {cifras.mesesSinDatos.map((mes) => (
              <Pressable
                key={mes}
                onPress={() => subirEstado(mes)}
                style={styles.filaLista}
                accessibilityRole="button"
                accessibilityLabel={`Subir el estado de cuenta de ${nombreMes(mes)}`}
              >
                <Text style={[styles.nombre, { flex: 1 }]}>{nombreMes(mes)}</Text>
                <View style={styles.filaTitulo}>
                  <Ionicons name="document-attach-outline" size={18} color={color.primary} />
                  <Text style={styles.enlace}>Subir PDF</Text>
                </View>
              </Pressable>
            ))}
          </Tarjeta>
        )}

        {resumen && !sinMovimientos && (
          <Boton titulo="Subir el estado de cuenta de otro mes" onPress={() => subirEstado()} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type ResumenOVacio = ResumenAnual | null | undefined;

function Cifra({
  etiqueta,
  valor,
  tono,
  styles,
}: {
  etiqueta: string;
  valor: string;
  tono?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.cifra}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={[styles.valor, tono ? { color: tono } : null]}>{valor}</Text>
    </View>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: color.bg },
    contenido: { padding: spacing(5), paddingBottom: spacing(10), gap: spacing(4) },
    selectorAnio: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing(6) },
    anio: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    fila: { flexDirection: "row", gap: spacing(3) },
    cifra: { flex: 1, backgroundColor: color.surface2, borderRadius: radius.sm, padding: spacing(3), gap: spacing(1) },
    etiqueta: { fontFamily: font.semibold, fontSize: 12, color: color.textMuted },
    valor: { fontFamily: font.semibold, fontSize: 20, color: color.text },
    seccion: { fontFamily: font.semibold, fontSize: 18, color: color.text },
    ayuda: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
    filaLista: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(3),
      paddingVertical: spacing(2),
      borderTopWidth: 1,
      borderTopColor: color.border,
    },
    filaListaTexto: { flex: 1, gap: spacing(1.5) },
    filaListaDerecha: { alignItems: "flex-end", gap: spacing(0.5) },
    filaTitulo: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
    punto: { width: 10, height: 10, borderRadius: 5 },
    nombre: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    monto: { fontFamily: font.semibold, fontSize: 15, color: color.text },
    barraFondo: { height: 6, borderRadius: 3, backgroundColor: color.surface2, overflow: "hidden" },
    barra: { height: 6, borderRadius: 3 },
    enlace: { fontFamily: font.semibold, fontSize: 14, color: color.primary },
  });
