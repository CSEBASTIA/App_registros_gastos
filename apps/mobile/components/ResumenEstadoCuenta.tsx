import { StyleSheet, Text, View } from "react-native";
import { formatMonto, rangoDeFilas, type Cuenta, type FilaImportacion, type ResumenImportacion } from "core";
import Tarjeta from "./Tarjeta";
import { font, spacing, useTheme, type Colors } from "../lib/theme";

type Props = {
  archivo: string | null;
  cuenta: Pick<Cuenta, "nombre" | "tipo">;
  filas: FilaImportacion[];
  resumen: ResumenImportacion;
  truncado: boolean;
};

const fechaCorta = (fecha: string) => fecha.split("-").reverse().join("/");

/** Vista previa de lo seleccionado; no representa el saldo oficial del banco. */
export default function ResumenEstadoCuenta({ archivo, cuenta, filas, resumen, truncado }: Props) {
  const { color } = useTheme();
  const styles = crearEstilos(color);
  const rango = rangoDeFilas(filas);
  const seleccionadas = resumen.gastos + resumen.ingresos;

  return (
    <Tarjeta>
      <View style={styles.grupo}>
        <Text accessibilityRole="header" style={styles.titulo}>Resumen del archivo</Text>
        <Text style={styles.secundario}>{archivo ?? "Estado de cuenta"} · {cuenta.nombre}</Text>
        {rango && (
          <Text style={styles.secundario}>
            Fechas de los movimientos: {fechaCorta(rango.desde)}
            {rango.hasta !== rango.desde ? ` – ${fechaCorta(rango.hasta)}` : ""}
          </Text>
        )}
      </View>
      <View style={styles.totales}>
        <View style={styles.metrica}>
          <Text style={styles.secundario}>Gastos seleccionados</Text>
          <Text style={styles.monto}>{formatMonto(resumen.totalGastos)}</Text>
        </View>
        {cuenta.tipo !== "credito" && (
          <View style={styles.metrica}>
            <Text style={styles.secundario}>Ingresos seleccionados</Text>
            <Text style={styles.monto}>{formatMonto(resumen.totalIngresos)}</Text>
          </View>
        )}
      </View>
      <View style={styles.pie}>
        <Text style={styles.texto} accessibilityLiveRegion="polite">
          {seleccionadas} de {filas.length} movimientos seleccionados
        </Text>
        <Text style={styles.secundario}>
          {cuenta.tipo === "credito" ? "Cupo" : "Saldo"} estimado después de importar:{" "}
          <Text style={styles.destacado}>{formatMonto(resumen.disponibleDespues)}</Text>
        </Text>
        <Text style={styles.secundario}>
          {truncado ? "Vista parcial del archivo. " : ""}
          Revisa los movimientos antes de confirmar. Los importes cambian con tu selección.
        </Text>
      </View>
    </Tarjeta>
  );
}

const crearEstilos = (color: Colors) => StyleSheet.create({
  grupo: { gap: spacing(1) },
  titulo: { fontFamily: font.semibold, fontSize: 18, color: color.text },
  secundario: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
  texto: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: color.text },
  destacado: { fontFamily: font.semibold, color: color.text },
  totales: { flexDirection: "row", flexWrap: "wrap", gap: spacing(4) },
  metrica: { flexGrow: 1, flexBasis: 140, gap: spacing(1) },
  monto: { fontFamily: font.mono, fontSize: 23, color: color.text },
  pie: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing(3), gap: spacing(1) },
});
