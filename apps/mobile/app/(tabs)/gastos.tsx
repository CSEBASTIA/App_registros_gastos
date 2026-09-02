import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  listarGastos,
  listarCategorias,
  listarCuentas,
  eliminarGasto,
  semanasDelMes,
  enRangoSemana,
  agruparPorCategoriaODetalle,
  type Gasto,
  type Categoria,
  type Cuenta,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import Boton from "../../components/Boton";
import GraficoBarras from "../../components/GraficoBarras";
import EstadoVacio from "../../components/EstadoVacio";
import SelectorMes from "../../components/SelectorMes";
import { color, radius, spacing } from "../../lib/theme";

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

export default function GastosScreen() {
  const router = useRouter();
  const [mes, setMes] = useState(mesActual());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [semanaActiva, setSemanaActiva] = useState(1);

  const cargar = useCallback(() => {
    Promise.all([listarGastos(), listarCategorias(), listarCuentas()]).then(([g, c, cu]) => {
      setGastos(g);
      setCategorias(c);
      setCuentas(cu);
    });
  }, []);

  useFocusEffect(cargar);

  const categoriasGasto = categorias.filter((c) => c.tipo === "gasto");
  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const semanas = semanasDelMes(mes);
  const rango = semanas[semanaActiva - 1];
  const gastosSemana = gastosDelMes.filter((g) => enRangoSemana(g.fecha, rango));
  const totalMes = gastosDelMes.reduce((a, g) => a + g.monto, 0);
  const totalSemana = gastosSemana.reduce((a, g) => a + g.monto, 0);

  const desglose = agruparPorCategoriaODetalle(gastosSemana, categoriasGasto)
    .filter((d) => d.monto > 0)
    .sort((a, b) => b.monto - a.monto);
  const datosGrafico = desglose.map((d) => ({ etiqueta: d.etiqueta, valor: d.monto, color: d.color }));

  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }
  function categoriaDe(id: string) {
    return categorias.find((c) => c.id === id);
  }

  function confirmarEliminar(gasto: Gasto) {
    Alert.alert("Eliminar gasto", `¿Eliminar "${gasto.descripcion}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => eliminarGasto(gasto.id).then(cargar) },
    ]);
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <View style={styles.encabezado}>
        <SelectorMes mes={mes} onCambiar={setMes} />
        <Boton titulo="+ Nuevo" variante="primario" onPress={() => router.push({ pathname: "/gasto/nuevo", params: { mes } })} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2) }}>
        {semanas.map((s) => (
          <Pressable
            key={s.numero}
            onPress={() => setSemanaActiva(s.numero)}
            style={[styles.tab, semanaActiva === s.numero && styles.tabActivo]}
          >
            <Text style={[styles.tabTexto, semanaActiva === s.numero && styles.tabTextoActivo]}>
              Semana {s.numero} ({s.desde}–{s.hasta})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Tarjeta>
        <Text style={styles.tituloCard}>Gastos por categoría — Semana {semanaActiva}</Text>
        <GraficoBarras datos={datosGrafico} mensajeVacio="Sin gastos en este período." />
      </Tarjeta>

      <Tarjeta>
        <View style={styles.filaTotal}>
          <Text style={styles.etiqueta}>Total Semana {semanaActiva}</Text>
          <Text style={styles.valorGrande}>${totalSemana.toFixed(2)}</Text>
        </View>
        {desglose.map((d) => (
          <View key={d.clave} style={styles.filaDesglose}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2), flex: 1 }}>
              <View style={[styles.punto, { backgroundColor: d.color }]} />
              <Text style={styles.desgloseNombre} numberOfLines={1}>
                {d.etiqueta}
              </Text>
            </View>
            <Text style={styles.desglosePct}>{totalSemana > 0 ? ((d.monto / totalSemana) * 100).toFixed(0) : 0}%</Text>
            <Text style={styles.desgloseMonto}>${d.monto.toFixed(2)}</Text>
          </View>
        ))}
        <View style={[styles.filaTotal, { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing(3) }]}>
          <Text style={styles.etiqueta}>Acumulado del mes</Text>
          <Text style={styles.valorMedio}>${totalMes.toFixed(2)}</Text>
        </View>
      </Tarjeta>

      <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
        {gastosSemana.length === 0 ? (
          <EstadoVacio
            icono="document-text-outline"
            titulo="Todavía no hay gastos en esta semana"
            subtitulo="Agregalos con el botón + Nuevo."
          />
        ) : (
          <View style={{ paddingHorizontal: spacing(4) }}>
            {gastosSemana.map((g) => {
              const cat = categoriaDe(g.categoriaId);
              return (
                <Pressable
                  key={g.id}
                  onLongPress={() => confirmarEliminar(g)}
                  style={styles.filaGasto}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gastoDescripcion} numberOfLines={1}>
                      {g.descripcion}
                    </Text>
                    <Text style={styles.gastoMeta} numberOfLines={1}>
                      {cat?.nombre ?? "Sin categoría"}
                      {cat?.nombre === "Otros" && g.categoriaDetalle ? ` · ${g.categoriaDetalle}` : ""}
                      {" · "}
                      {cuentaDe(g.cuentaId)?.nombre ?? "Sin cuenta"} · {g.fecha}
                    </Text>
                  </View>
                  <Text style={styles.gastoMonto}>${g.monto.toFixed(2)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Tarjeta>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tab: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
    backgroundColor: color.surface,
  },
  tabActivo: { backgroundColor: color.primaryBg, borderColor: color.primary },
  tabTexto: { fontSize: 12, color: color.textMuted, fontWeight: "600" },
  tabTextoActivo: { color: color.primary },
  tituloCard: { fontSize: 14, fontWeight: "700", color: color.text },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  etiqueta: { fontSize: 12, color: color.textMuted, fontWeight: "600" },
  valorGrande: { fontSize: 20, fontWeight: "800", color: color.text },
  valorMedio: { fontSize: 16, fontWeight: "700", color: color.text },
  filaDesglose: { flexDirection: "row", alignItems: "center", gap: spacing(2), paddingVertical: spacing(1) },
  punto: { width: 8, height: 8, borderRadius: 4 },
  desgloseNombre: { fontSize: 13, color: color.text, flexShrink: 1 },
  desglosePct: { fontSize: 12, color: color.textMuted, width: 36, textAlign: "right" },
  desgloseMonto: { fontSize: 13, fontWeight: "700", color: color.text, width: 70, textAlign: "right" },
  filaGasto: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingVertical: spacing(3),
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  gastoDescripcion: { fontSize: 14, fontWeight: "600", color: color.text },
  gastoMeta: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
  gastoMonto: { fontSize: 14, fontWeight: "700", color: color.text },
});
