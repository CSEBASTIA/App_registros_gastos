import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  listarCuentas,
  listarGastos,
  listarIngresos,
  listarCategorias,
  eliminarCuenta,
  movimientosDe,
  mensajeError,
  type Cuenta,
  type Gasto,
  type Ingreso,
  type Categoria,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import TarjetaVisual from "../../components/TarjetaVisual";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import ItemMovimiento from "../../components/ItemMovimiento";
import EstadoVacio from "../../components/EstadoVacio";
import { color, spacing } from "../../lib/theme";

export default function DetalleCuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    Promise.all([listarCuentas(), listarGastos(), listarIngresos(), listarCategorias()])
      .then(([cuentas, g, i, c]) => {
        setCuenta(cuentas.find((c) => c.id === id) ?? null);
        setGastos(g);
        setIngresos(i);
        setCategorias(c);
      })
      .catch((err) => setError(mensajeError(err)));
  }, [id]);

  useFocusEffect(cargar);

  if (!cuenta) return null;

  const movimientos = movimientosDe(cuenta.id, gastos, [], ingresos, categorias).slice(0, 30);

  function confirmarEliminar() {
    Alert.alert("Eliminar cuenta", `¿Eliminar "${cuenta!.nombre}"? Esto no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarCuenta(cuenta!.id);
            router.back();
          } catch (err) {
            setError(mensajeError(err));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
      <TarjetaVisual cuenta={cuenta} />

      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Boton
          titulo="Registrar sueldo"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: "/ingreso/nuevo", params: { cuentaId: cuenta.id } })}
        />
        <Boton
          titulo="Registrar gasto"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: "/gasto/nuevo", params: { cuentaId: cuenta.id } })}
        />
      </View>
      <Boton titulo="Eliminar cuenta" variante="peligro" onPress={confirmarEliminar} />

      {error && <ErrorTexto>{error}</ErrorTexto>}

      <Tarjeta style={{ padding: 0, paddingVertical: spacing(2) }}>
        <Text style={[styles.titulo, { paddingHorizontal: spacing(4) }]}>Movimientos</Text>
        {movimientos.length === 0 ? (
          <EstadoVacio
            icono="document-text-outline"
            titulo="Todavía no hay movimientos"
            subtitulo="Registrá un gasto o un sueldo: el saldo se ajusta solo."
          />
        ) : (
          <View style={{ paddingHorizontal: spacing(4) }}>
            {movimientos.map((item) => (
              <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
            ))}
          </View>
        )}
      </Tarjeta>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.bg },
  titulo: { fontSize: 15, fontWeight: "700", color: color.text },
});
