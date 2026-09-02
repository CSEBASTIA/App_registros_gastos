import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  listarIngresos,
  listarCategorias,
  listarCuentas,
  eliminarIngreso,
  semanasDelMes,
  enRangoSemana,
  ultimosMeses,
  etiquetaMes,
  type Ingreso,
  type Categoria,
  type Cuenta,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import Boton from "../../components/Boton";
import GraficoBarras from "../../components/GraficoBarras";
import EstadoVacio from "../../components/EstadoVacio";
import SelectorMes from "../../components/SelectorMes";
import { color, radius, spacing } from "../../lib/theme";

const COLOR_INGRESOS = "#16a34a";

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

export default function IngresosScreen() {
  const router = useRouter();
  const [mes, setMes] = useState(mesActual());
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");

  const cargar = useCallback(() => {
    Promise.all([listarIngresos(), listarCategorias(), listarCuentas()]).then(([i, c, cu]) => {
      setIngresos(i);
      setCategorias(c);
      setCuentas(cu);
    });
  }, []);

  useFocusEffect(cargar);

  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));

  const datosSemana = semanasDelMes(mes).map((s) => ({
    etiqueta: `Sem ${s.numero}`,
    valor: ingresosDelMes.filter((i) => enRangoSemana(i.fecha, s)).reduce((a, i) => a + i.monto, 0),
    color: COLOR_INGRESOS,
  }));
  const datosMes = ultimosMeses(mes, 6).map((m) => ({
    etiqueta: etiquetaMes(m).slice(0, 3),
    valor: ingresos.filter((i) => i.fecha.startsWith(m)).reduce((a, i) => a + i.monto, 0),
    color: COLOR_INGRESOS,
  }));

  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }
  function categoriaDe(id?: string) {
    return id ? categorias.find((c) => c.id === id) : undefined;
  }

  function confirmarEliminar(ingreso: Ingreso) {
    Alert.alert("Eliminar ingreso", `¿Eliminar "${ingreso.descripcion}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => eliminarIngreso(ingreso.id).then(cargar) },
    ]);
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <View style={styles.encabezado}>
        <SelectorMes mes={mes} onCambiar={setMes} />
        <Boton titulo="+ Nuevo" variante="primario" onPress={() => router.push("/ingreso/nuevo")} />
      </View>

      <Tarjeta>
        <View style={styles.filaTitulo}>
          <Text style={styles.tituloCard}>Ingresos</Text>
          <View style={styles.toggle}>
            <Pressable onPress={() => setPeriodo("semana")} style={[styles.toggleBtn, periodo === "semana" && styles.toggleActivo]}>
              <Text style={[styles.toggleTexto, periodo === "semana" && styles.toggleTextoActivo]}>Semana</Text>
            </Pressable>
            <Pressable onPress={() => setPeriodo("mes")} style={[styles.toggleBtn, periodo === "mes" && styles.toggleActivo]}>
              <Text style={[styles.toggleTexto, periodo === "mes" && styles.toggleTextoActivo]}>Mes</Text>
            </Pressable>
          </View>
        </View>
        <GraficoBarras datos={periodo === "semana" ? datosSemana : datosMes} mensajeVacio="Sin ingresos en este período." />
      </Tarjeta>

      <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
        {ingresosDelMes.length === 0 ? (
          <EstadoVacio
            icono="trending-up-outline"
            titulo="Todavía no hay ingresos este mes"
            subtitulo="Registrá tu sueldo, freelance u otra entrada de dinero."
          />
        ) : (
          <View style={{ paddingHorizontal: spacing(4) }}>
            {ingresosDelMes.map((i) => {
              const cat = categoriaDe(i.categoriaId);
              return (
                <Pressable key={i.id} onLongPress={() => confirmarEliminar(i)} style={styles.fila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filaDescripcion} numberOfLines={1}>
                      {i.descripcion}
                    </Text>
                    <Text style={styles.filaMeta} numberOfLines={1}>
                      {cat?.nombre ?? "Sin fuente"}
                      {cat?.nombre === "Otros" && i.categoriaDetalle ? ` · ${i.categoriaDetalle}` : ""}
                      {" · "}
                      {cuentaDe(i.cuentaId)?.nombre ?? "Sin cuenta"} · {i.fecha}
                    </Text>
                  </View>
                  <Text style={styles.filaMonto}>${i.monto.toFixed(2)}</Text>
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
  filaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tituloCard: { fontSize: 14, fontWeight: "700", color: color.text },
  toggle: { flexDirection: "row", backgroundColor: color.bg, borderRadius: radius.pill, padding: 2 },
  toggleBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(3), borderRadius: radius.pill },
  toggleActivo: { backgroundColor: color.surface },
  toggleTexto: { fontSize: 11.5, color: color.textMuted, fontWeight: "600" },
  toggleTextoActivo: { color: color.text },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingVertical: spacing(3),
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  filaDescripcion: { fontSize: 14, fontWeight: "600", color: color.text },
  filaMeta: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
  filaMonto: { fontSize: 14, fontWeight: "700", color: color.success },
});
