import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  listarGastos,
  listarIngresos,
  listarCategorias,
  listarCuentas,
  listarDeudas,
  balanceGeneral,
  calcularEndeudamiento,
  generarRecomendaciones,
  formatMonto,
  type Gasto,
  type Ingreso,
  type Categoria,
  type Cuenta,
  type Deuda,
  type Recomendacion,
} from "core";
import { supabase } from "../../lib/supabase";
import Tarjeta from "../../components/Tarjeta";
import BarraProgreso from "../../components/BarraProgreso";
import EstadoVacio from "../../components/EstadoVacio";
import ItemMovimiento from "../../components/ItemMovimiento";
import { color, radius, spacing } from "../../lib/theme";

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const COLOR_NIVEL = { bajo: color.success, moderado: "#e0a53f", alto: color.danger };
const ETIQUETA_NIVEL = { bajo: "Bajo", moderado: "Moderado", alto: "Alto" };

export default function ResumenScreen() {
  const mes = mesActual();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [correo, setCorreo] = useState("");

  useFocusEffect(
    useCallback(() => {
      Promise.all([listarGastos(), listarIngresos(), listarCategorias(), listarCuentas(), listarDeudas()]).then(
        ([g, i, c, cu, d]) => {
          setGastos(g);
          setIngresos(i);
          setCategorias(c);
          setCuentas(cu);
          setDeudas(d);
        }
      );
      supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user.email ?? ""));
    }, [])
  );

  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const balance = balanceGeneral(gastosDelMes, ingresosDelMes);
  const endeudamiento = calcularEndeudamiento(deudas, balance.totalIngresos);
  const recomendaciones: Recomendacion[] = generarRecomendaciones({
    mes,
    gastos,
    ingresos,
    categorias,
    cuentas,
    endeudamiento,
  });

  const nombre = nombreDesdeCorreo(correo);
  const semana = construirSemana(gastos);
  const actividad = construirActividad(gastos, ingresos, categorias).slice(0, 8);
  const veredicto = veredictoFinanciero(balance, endeudamiento);
  const esPositivo = balance.balance >= 0;

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <View style={styles.saludo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{nombre.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.saludoHola}>Hola de nuevo,</Text>
          <Text style={styles.saludoNombre}>{nombre}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEtiqueta}>Balance del mes</Text>
        <Text style={styles.heroValor}>
          {esPositivo ? "+" : "-"}${Math.abs(balance.balance).toFixed(2)}
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Ionicons name="arrow-up-circle" size={22} color="#86efac" />
            <View>
              <Text style={styles.heroStatEtiqueta}>Ingresos del mes</Text>
              <Text style={styles.heroStatValor}>${balance.totalIngresos.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.heroStat}>
            <Ionicons name="arrow-down-circle" size={22} color="#fca5a5" />
            <View>
              <Text style={styles.heroStatEtiqueta}>Gastado este mes</Text>
              <Text style={styles.heroStatValor}>${balance.totalGastos.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>

      <Tarjeta>
        <View style={styles.filaTitulo}>
          <Text style={styles.tituloCard}>Resumen semanal</Text>
          <Text style={styles.etiquetaMuted}>Últimos 7 días</Text>
        </View>
        <View style={styles.grafico}>
          {semana.map((dia) => (
            <View key={dia.fecha} style={styles.diaColumna}>
              <View style={styles.diaPista}>
                <View
                  style={[
                    styles.diaRelleno,
                    { height: `${dia.alturaPorcentaje}%`, backgroundColor: dia.esHoy ? color.primary : color.border },
                  ]}
                />
              </View>
              <Text style={[styles.diaEtiqueta, dia.esHoy && { color: color.primary, fontWeight: "700" }]}>
                {dia.etiqueta}
              </Text>
            </View>
          ))}
        </View>
      </Tarjeta>

      <Tarjeta>
        <View style={styles.filaTitulo}>
          <Text style={styles.tituloCard}>Salud financiera</Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: COLOR_NIVEL[endeudamiento.nivel] }}>
            Endeudamiento: {ETIQUETA_NIVEL[endeudamiento.nivel]}
          </Text>
        </View>
        <View style={[styles.veredicto, { backgroundColor: veredicto.estado === "bien" ? color.successBg : veredicto.estado === "atencion" ? color.warningBg : color.dangerBg }]}>
          <Ionicons
            name={veredicto.estado === "bien" ? "checkmark-circle" : "alert-circle"}
            size={22}
            color={veredicto.estado === "bien" ? color.success : veredicto.estado === "atencion" ? color.warning : color.danger}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.veredictoTitulo}>{veredicto.titulo}</Text>
            <Text style={styles.veredictoDetalle}>{veredicto.detalle}</Text>
          </View>
        </View>
        <BarraProgreso porcentaje={endeudamiento.porcentaje} />
      </Tarjeta>

      <Tarjeta>
        <Text style={styles.tituloCard}>Recomendaciones</Text>
        {recomendaciones.length === 0 ? (
          <EstadoVacio
            icono="home-outline"
            titulo="Todavía no hay recomendaciones"
            subtitulo="Registrá más gastos e ingresos para que podamos analizar tus hábitos."
          />
        ) : (
          <View style={{ gap: spacing(2) }}>
            {recomendaciones.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.recomendacion,
                  { backgroundColor: r.severidad === "alerta" ? color.dangerBg : color.primaryBg },
                ]}
              >
                <Text style={{ fontSize: 13, color: r.severidad === "alerta" ? color.danger : color.primary }}>
                  {r.mensaje}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Tarjeta>

      <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
        <Text style={[styles.tituloCard, { paddingHorizontal: spacing(4) }]}>Actividad reciente</Text>
        {actividad.length === 0 ? (
          <EstadoVacio icono="home-outline" titulo="Sin movimientos todavía" subtitulo="Tus últimos gastos e ingresos aparecerán aquí." />
        ) : (
          <View style={{ paddingHorizontal: spacing(4) }}>
            {actividad.map((item) => (
              <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
            ))}
          </View>
        )}
      </Tarjeta>
    </ScrollView>
  );
}

function nombreDesdeCorreo(correo: string) {
  const local = correo.split("@")[0] || "Usuario";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function construirSemana(gastos: Gasto[]) {
  const hoy = new Date();
  const dias: { fecha: string; etiqueta: string; total: number; esHoy: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const clave = fecha.toISOString().slice(0, 10);
    const total = gastos.filter((g) => g.fecha === clave).reduce((acc, g) => acc + g.monto, 0);
    dias.push({ fecha: clave, etiqueta: DIAS_SEMANA[fecha.getDay()], total, esHoy: i === 0 });
  }
  const maximo = Math.max(...dias.map((d) => d.total), 1);
  return dias.map((d) => ({ ...d, alturaPorcentaje: Math.max(6, (d.total / maximo) * 100) }));
}

function construirActividad(gastos: Gasto[], ingresos: Ingreso[], categorias: Categoria[]) {
  const items = [
    ...gastos.map((g) => {
      const categoria = categorias.find((c) => c.id === g.categoriaId);
      const esOtrosConDetalle = categoria?.nombre === "Otros" && g.categoriaDetalle;
      return {
        id: g.id,
        tipo: "gasto" as const,
        descripcion: g.descripcion || categoria?.nombre || "Gasto",
        subtitulo: esOtrosConDetalle ? g.categoriaDetalle! : categoria?.nombre ?? "Sin categoría",
        monto: g.monto,
        fecha: g.fecha,
        createdAt: g.createdAt,
        color: categoria?.color ?? "#6b7280",
      };
    }),
    ...ingresos.map((i) => ({
      id: i.id,
      tipo: "ingreso" as const,
      descripcion: i.descripcion || "Ingreso",
      subtitulo: "Ingreso",
      monto: i.monto,
      fecha: i.fecha,
      createdAt: i.createdAt,
      color: "#16a34a",
    })),
  ];
  return items.sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
}

type EstadoFinanciero = "bien" | "atencion" | "riesgo";

function veredictoFinanciero(
  balance: { balance: number; totalIngresos: number },
  endeudamiento: { nivel: "bajo" | "moderado" | "alto"; porcentaje: number }
): { titulo: string; detalle: string; estado: EstadoFinanciero } {
  if (endeudamiento.nivel === "alto") {
    return {
      estado: "riesgo",
      titulo: "Endeudamiento alto",
      detalle: `El ${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso mensual se va en cuotas de deuda. Evitá tomar más deuda por ahora.`,
    };
  }
  if (balance.totalIngresos > 0 && balance.balance < 0) {
    return {
      estado: "riesgo",
      titulo: "Gastando más de lo que ingresa",
      detalle: `Este mes tus gastos superan tus ingresos por $${Math.abs(balance.balance).toFixed(2)}.`,
    };
  }
  if (endeudamiento.nivel === "moderado") {
    return {
      estado: "atencion",
      titulo: "Endeudamiento moderado",
      detalle: `El ${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso se va en cuotas. Vale la pena vigilarlo.`,
    };
  }
  return {
    estado: "bien",
    titulo: "Estás en buena forma",
    detalle: "Tus ingresos cubren tus gastos y cuotas de deuda sin problema.",
  };
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  saludo: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#fff", fontWeight: "700", fontSize: 16 },
  saludoHola: { fontSize: 12, color: color.textMuted },
  saludoNombre: { fontSize: 16, fontWeight: "700", color: color.text },
  hero: {
    backgroundColor: "#2c3560",
    borderRadius: radius.lg,
    padding: spacing(5),
    gap: spacing(2),
  },
  heroEtiqueta: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  heroValor: { color: "#fff", fontSize: 30, fontWeight: "800" },
  heroStats: { flexDirection: "row", gap: spacing(5), marginTop: spacing(2) },
  heroStat: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  heroStatEtiqueta: { color: "rgba(255,255,255,0.75)", fontSize: 11 },
  heroStatValor: { color: "#fff", fontSize: 14, fontWeight: "700" },
  filaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tituloCard: { fontSize: 14, fontWeight: "700", color: color.text },
  etiquetaMuted: { fontSize: 11, color: color.textMuted },
  grafico: { flexDirection: "row", alignItems: "flex-end", gap: spacing(2), height: 100 },
  diaColumna: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: spacing(1) },
  diaPista: { flex: 1, width: "100%", justifyContent: "flex-end" },
  diaRelleno: { width: "100%", borderRadius: 4, minHeight: 4 },
  diaEtiqueta: { fontSize: 11, color: color.textMuted },
  veredicto: { flexDirection: "row", gap: spacing(3), padding: spacing(3), borderRadius: radius.sm, alignItems: "flex-start" },
  veredictoTitulo: { fontSize: 13, fontWeight: "700", color: color.text },
  veredictoDetalle: { fontSize: 12, color: color.textMuted, marginTop: 2 },
  recomendacion: { padding: spacing(3), borderRadius: radius.sm },
});
