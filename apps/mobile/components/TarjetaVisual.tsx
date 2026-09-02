import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { Cuenta } from "core";
import {
  COLOR_CUENTA_BANCO,
  ETIQUETA_BANCO,
  ETIQUETA_MARCA,
  GRADIENTE_BANCO,
  TEXTO_CUENTA_BANCO,
  formatMonto,
} from "core";
import { logoDeBanco } from "../lib/logosBanco";
import BarraProgreso from "./BarraProgreso";
import { radius, spacing } from "../lib/theme";

const ICONO_TIPO: Record<Cuenta["tipo"], keyof typeof Ionicons.glyphMap> = {
  credito: "card-outline",
  debito: "card-outline",
  ahorro: "wallet-outline",
  efectivo: "cash-outline",
};

const ETIQUETA_TIPO: Record<Cuenta["tipo"], string> = {
  credito: "Tarjeta de crédito",
  debito: "Tarjeta de débito",
  ahorro: "Cuenta de ahorros",
  efectivo: "Efectivo",
};

/**
 * Versión mobile de `TarjetaVisual.tsx`/`CuentaVisual` de desktop: no hay
 * catálogo de fotos reales (a pedido, ver plan) — todas las cuentas usan
 * degradado/color de banco + logo si existe.
 */
export default function TarjetaVisual({
  cuenta,
  compacta,
  seleccionada,
  onPress,
}: {
  cuenta: Cuenta;
  compacta?: boolean;
  seleccionada?: boolean;
  onPress?: () => void;
}) {
  const logo = logoDeBanco(cuenta.banco);
  const esCredito = cuenta.tipo === "credito";
  const usoPorcentaje = cuenta.cupoTotal ? ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100 : undefined;

  const contenido = esCredito ? (
    <LinearGradient
      colors={GRADIENTE_BANCO[cuenta.banco]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, compacta && styles.baseCompacta]}
    >
      <View style={styles.encabezado}>
        {logo ? (
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text style={styles.bancoTexto}>{ETIQUETA_BANCO[cuenta.banco]}</Text>
        )}
        <Ionicons name="wifi-outline" size={16} color="rgba(255,255,255,0.85)" style={{ transform: [{ rotate: "90deg" }] }} />
      </View>

      <Text style={styles.nombre} numberOfLines={1}>
        {cuenta.nombre}
      </Text>
      {!compacta && <Text style={styles.tipo}>{ETIQUETA_TIPO[cuenta.tipo]}</Text>}

      {!compacta &&
        (cuenta.cupoTotal ? (
          <View style={{ gap: spacing(1.5) }}>
            <View style={styles.cupoLinea}>
              <Text style={styles.cupoTexto}>Disponible</Text>
              <Text style={styles.cupoTexto}>
                {formatMonto(cuenta.disponible)} / {formatMonto(cuenta.cupoTotal)}
              </Text>
            </View>
            <BarraProgreso porcentaje={usoPorcentaje ?? 0} claro />
          </View>
        ) : (
          <Text style={styles.saldo}>{formatMonto(cuenta.disponible)}</Text>
        ))}

      {!compacta && cuenta.marca && (
        <Text style={styles.marca}>{ETIQUETA_MARCA[cuenta.marca] || "Otra"}</Text>
      )}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.base,
        compacta && styles.baseCompacta,
        styles.cuentaBase,
        { backgroundColor: COLOR_CUENTA_BANCO[cuenta.banco] },
      ]}
    >
      <Text style={[styles.bancoTexto, { color: TEXTO_CUENTA_BANCO[cuenta.banco] }]}>
        {ETIQUETA_BANCO[cuenta.banco]}
      </Text>
      <View style={styles.cuentaCuerpo}>
        <View style={[styles.iconoRedondo, { borderColor: `${TEXTO_CUENTA_BANCO[cuenta.banco]}b3` }]}>
          <Ionicons name={ICONO_TIPO[cuenta.tipo]} size={18} color={TEXTO_CUENTA_BANCO[cuenta.banco]} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.nombre, { color: TEXTO_CUENTA_BANCO[cuenta.banco] }]} numberOfLines={1}>
            {cuenta.nombre}
          </Text>
          {!compacta && (
            <Text style={[styles.tipo, { color: TEXTO_CUENTA_BANCO[cuenta.banco] }]}>{ETIQUETA_TIPO[cuenta.tipo]}</Text>
          )}
        </View>
        {!compacta && (
          <Text style={[styles.saldo, { color: TEXTO_CUENTA_BANCO[cuenta.banco], marginTop: 0 }]}>
            {formatMonto(cuenta.disponible)}
          </Text>
        )}
      </View>
    </View>
  );

  if (!onPress) return contenido;

  return (
    <Pressable onPress={onPress} style={seleccionada ? styles.seleccionada : undefined}>
      {contenido}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing(5),
    minHeight: 170,
    justifyContent: "space-between",
    gap: spacing(2),
  },
  baseCompacta: { minHeight: 100, width: 190, padding: spacing(3.5) },
  cuentaBase: { minHeight: 110, justifyContent: "flex-start", gap: spacing(3) },
  seleccionada: { borderWidth: 2.5, borderColor: "#3b6ff2", borderRadius: radius.lg + 3 },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bancoTexto: { fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 0.4, textTransform: "uppercase" },
  logo: { height: 20, width: 90 },
  nombre: { fontSize: 16, fontWeight: "700", color: "#fff" },
  tipo: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  saldo: { fontSize: 20, fontWeight: "700", color: "#fff", marginTop: spacing(2) },
  marca: { fontSize: 13, fontWeight: "800", fontStyle: "italic", color: "#fff", alignSelf: "flex-end" },
  cupoLinea: { flexDirection: "row", justifyContent: "space-between" },
  cupoTexto: { fontSize: 11, color: "rgba(255,255,255,0.9)" },
  cuentaCuerpo: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  iconoRedondo: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
