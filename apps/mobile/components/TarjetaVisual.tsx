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
  cicloTarjeta,
  esCasaComercial,
  fechaLocal,
  inicialesDeEntidad,
  textoDias,
} from "core";
import { logoDeBanco, logoVaSobreBlanco } from "../lib/logosBanco";
import BarraProgreso from "./BarraProgreso";
import { useTheme, font, radius, spacing } from "../lib/theme";
import { imagenDe, productoDe } from "../lib/catalogoTarjetas";

const ICONO_TIPO: Record<Cuenta["tipo"], keyof typeof Ionicons.glyphMap> = {
  credito: "card-outline",
  debito: "card-outline",
  ahorro: "wallet-outline",
  efectivo: "cash-outline",
};

/** "Corta en 4 días · paga hasta el 2026-11-05", o nada si no tiene fecha de corte. */
function lineaCorte(cuenta: Cuenta): string | undefined {
  if (cuenta.tipo !== "credito" || !cuenta.diaCorte) return undefined;
  const c = cicloTarjeta(cuenta.diaCorte, fechaLocal(), cuenta.diaPago);
  return `Corta ${textoDias(c.diasHastaCorte)}` + (c.pago ? ` · paga hasta el ${c.pago.slice(8)}/${c.pago.slice(5, 7)}` : "");
}

const ETIQUETA_TIPO: Record<Cuenta["tipo"], string> = {
  credito: "Tarjeta de crédito",
  debito: "Tarjeta de débito",
  ahorro: "Cuenta de ahorros",
  efectivo: "Efectivo",
};

/** Tarjeta móvil con arte local del catálogo y respaldo de marca cuando aún no existe una imagen frontal. */
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
  const { color } = useTheme();
  const logo = logoDeBanco(cuenta.banco);
  const esCredito = cuenta.tipo === "credito";
  const imagen = imagenDe(cuenta.estilo);
  const producto = productoDe(cuenta.estilo);
  const corte = compacta ? undefined : lineaCorte(cuenta);
  const tipoTexto = cuenta.tipo === "credito" && esCasaComercial(cuenta.banco) ? "Crédito directo" : ETIQUETA_TIPO[cuenta.tipo];
  const usoPorcentaje = cuenta.cupoTotal ? ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100 : undefined;
  // Solo una tarjeta puede quedar en negativo: se pasó del cupo (sobreendeudamiento).
  const sobreendeudada = esCredito && cuenta.disponible < 0;
  const textoExceso = `Sobreendeudada: te pasaste ${formatMonto(-cuenta.disponible)} del cupo`;

  const contenido = esCredito && imagen ? (
    <View
      style={[
        styles.imagenBase,
        compacta && styles.imagenBaseCompacta,
        { backgroundColor: color.surface, borderColor: color.border },
        sobreendeudada && { borderColor: color.danger, borderWidth: 2, backgroundColor: color.dangerBg },
      ]}
    >
      <View style={[styles.imagenMarco, compacta && styles.imagenMarcoCompacta]}>
        <Image source={imagen} style={[styles.imagenArte, compacta && styles.imagenArteCompacta]} resizeMode={producto?.ajusteImagen ?? "contain"} accessibilityLabel={producto?.nombre ?? cuenta.nombre} />
        <Text numberOfLines={1} style={styles.marcaAgua}>{ETIQUETA_BANCO[cuenta.banco]}</Text>
        {sobreendeudada && (
          <View style={[styles.sello, { backgroundColor: color.danger }]} accessibilityElementsHidden importantForAccessibility="no">
            <Ionicons name="warning" size={compacta ? 14 : 18} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.imagenInfo}>
        <Text style={[styles.nombreImagen, { color: color.text }]} numberOfLines={1}>{cuenta.nombre}</Text>
        {!compacta && (
          <>
            <Text style={[styles.tipoImagen, { color: color.textMuted }]} numberOfLines={1}>{producto?.nombre ?? tipoTexto}</Text>
            {corte && <Text style={[styles.tipoImagen, { color: color.textMuted }]}>{corte}</Text>}
            {sobreendeudada && (
              <View style={styles.alerta}>
                <Ionicons name="warning" size={16} color={color.danger} />
                <Text style={[styles.alertaTexto, { color: color.danger }]}>{textoExceso}</Text>
              </View>
            )}
            {cuenta.cupoTotal ? (
              <View style={{ gap: spacing(1.5) }}>
                <View style={styles.cupoLinea}>
                  <Text style={[styles.cupoTextoImagen, { color: sobreendeudada ? color.danger : color.textMuted }]}>Disponible</Text>
                  <Text style={[styles.cupoTextoImagen, { color: sobreendeudada ? color.danger : color.textMuted }]}>{formatMonto(cuenta.disponible)} / {formatMonto(cuenta.cupoTotal)}</Text>
                </View>
                <BarraProgreso porcentaje={usoPorcentaje ?? 0} />
              </View>
            ) : (
              <Text style={[styles.tipoImagen, { color: sobreendeudada ? color.danger : color.textMuted }]}>{formatMonto(cuenta.disponible)}</Text>
            )}
          </>
        )}
      </View>
    </View>
  ) : esCredito ? (
    <LinearGradient
      colors={sobreendeudada ? GRADIENTE_SOBREENDEUDADA : GRADIENTE_BANCO[cuenta.banco]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, compacta && styles.baseCompacta]}
    >
      <View style={styles.encabezado}>
        {logo && logoVaSobreBlanco(cuenta.banco) ? (
          // Letras oscuras sobre fondo transparente: no se veían sobre el degradado.
          <View style={styles.logoPastilla}>
            <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
          </View>
        ) : logo ? (
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.entidad}>
            <View style={styles.inicial} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={styles.inicialTexto}>{inicialesDeEntidad(cuenta.banco)}</Text>
            </View>
            <Text style={styles.bancoTexto} numberOfLines={1}>{ETIQUETA_BANCO[cuenta.banco]}</Text>
          </View>
        )}
        {sobreendeudada ? (
          <Ionicons name="warning" size={18} color="#fff" accessibilityElementsHidden importantForAccessibility="no" />
        ) : (
          <Ionicons name="wifi-outline" size={16} color="rgba(255,255,255,0.85)" style={{ transform: [{ rotate: "90deg" }] }} />
        )}
      </View>

      <Text style={styles.nombre} numberOfLines={1}>
        {cuenta.nombre}
      </Text>
      {!compacta && <Text style={styles.tipo}>{tipoTexto}</Text>}
      {corte && <Text style={styles.tipo}>{corte}</Text>}
      {sobreendeudada && !compacta && (
        <View style={[styles.alerta, styles.alertaClara]}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={[styles.alertaTexto, { color: "#fff" }]}>{textoExceso}</Text>
        </View>
      )}

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
      <View style={styles.entidad}>
        {logo ? (
          <View style={styles.logoPastilla}>
            <Image source={logo} style={styles.logoPequeno} resizeMode="contain" accessibilityIgnoresInvertColors />
          </View>
        ) : (
          <View style={[styles.inicial, { borderColor: `${TEXTO_CUENTA_BANCO[cuenta.banco]}80` }]}>
            <Text style={[styles.inicialTexto, { color: TEXTO_CUENTA_BANCO[cuenta.banco] }]}>{inicialesDeEntidad(cuenta.banco)}</Text>
          </View>
        )}
        <Text style={[styles.bancoTexto, { color: TEXTO_CUENTA_BANCO[cuenta.banco] }]} numberOfLines={1}>
          {ETIQUETA_BANCO[cuenta.banco]}
        </Text>
      </View>
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

  const accessibleLabel = [
    cuenta.nombre,
    ETIQUETA_BANCO[cuenta.banco],
    tipoTexto,
    cuenta.cupoTotal
      ? `Disponible ${formatMonto(cuenta.disponible)} de ${formatMonto(cuenta.cupoTotal)}`
      : `Saldo ${formatMonto(cuenta.disponible)}`,
    ...(sobreendeudada ? [textoExceso] : []),
  ].join(", ");

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!seleccionada }} accessibilityLabel={accessibleLabel} style={({ pressed }) => [seleccionada && styles.seleccionada, { borderColor: color.primary, opacity: pressed ? 0.86 : 1 }]}>
      {contenido}
    </Pressable>
  );
}

/** Rojo de peligro para una tarjeta que se pasó del cupo (en lugar del color del banco). */
const GRADIENTE_SOBREENDEUDADA: [string, string] = ["#c23b34", "#7a1714"];

const styles = StyleSheet.create({
  alerta: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  alertaClara: { backgroundColor: "rgba(0,0,0,0.22)", borderRadius: radius.sm, paddingHorizontal: spacing(2), paddingVertical: spacing(1), alignSelf: "flex-start" },
  alertaTexto: { fontFamily: font.semibold, fontSize: 12.5, flexShrink: 1 },
  sello: { position: "absolute", top: spacing(2), left: spacing(2), borderRadius: radius.pill, padding: 5 },
  base: {
    borderRadius: radius.lg,
    padding: spacing(5),
    minHeight: 170,
    justifyContent: "space-between",
    gap: spacing(2),
  },
  baseCompacta: { minHeight: 100, width: 190, padding: spacing(3.5) },
  imagenBase: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", minHeight: 0 },
  imagenBaseCompacta: { width: 182, borderRadius: radius.md },
  imagenMarco: { height: 158, justifyContent: "center", alignItems: "center", position: "relative" },
  imagenMarcoCompacta: { height: 98 },
  imagenArte: { height: 158, width: "100%" },
  imagenArteCompacta: { height: 94 },
  marcaAgua: { position: "absolute", top: spacing(2), right: spacing(3), maxWidth: "55%", fontFamily: font.semibold, fontSize: 10, letterSpacing: 0.7, color: "#181818", opacity: 0.22, textTransform: "uppercase" },
  imagenInfo: { paddingHorizontal: spacing(4), paddingTop: spacing(2), paddingBottom: spacing(4), gap: spacing(1) },
  nombreImagen: { fontFamily: font.semibold, fontSize: 15 },
  tipoImagen: { fontFamily: font.body, fontSize: 12 },
  cupoTextoImagen: { fontFamily: font.mono, fontSize: 11 },
  cuentaBase: { minHeight: 110, justifyContent: "flex-start", gap: spacing(3) },
  seleccionada: { borderWidth: 2.5, borderRadius: radius.lg + 3 },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bancoTexto: { fontFamily: font.body, fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 0.4, textTransform: "uppercase" },
  logo: { height: 18, width: 80 },
  logoPastilla: { backgroundColor: "#ffffff", borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3 },
  logoPequeno: { height: 16, width: 64 },
  entidad: { flexDirection: "row", alignItems: "center", gap: spacing(2), flexShrink: 1 },
  inicial: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  inicialTexto: { fontFamily: font.semibold, fontSize: 12, color: "#fff" },
  nombre: { fontFamily: font.body, fontSize: 16, fontWeight: "700", color: "#fff" },
  tipo: { fontFamily: font.body, fontSize: 12, color: "rgba(255,255,255,0.85)" },
  saldo: { fontFamily: font.mono, fontSize: 20, fontWeight: "700", color: "#fff", marginTop: spacing(2) },
  marca: { fontFamily: font.body, fontSize: 13, fontWeight: "800", fontStyle: "italic", color: "#fff", alignSelf: "flex-end" },
  cupoLinea: { flexDirection: "row", justifyContent: "space-between" },
  cupoTexto: { fontFamily: font.mono, fontSize: 11, color: "rgba(255,255,255,0.9)" },
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
