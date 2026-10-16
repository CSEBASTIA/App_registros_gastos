// Formulario para corregir un gasto o un ingreso ya guardado: monto,
// descripción, categoría, cuenta y fecha. Lo que no se puede cambiar (en un
// diferido: monto, tarjeta y fecha) se muestra, pero sin poder editarlo.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fechaLarga, mensajeError, parsearMonto, type Categoria, type Cuenta, type EdicionPermitida, type FormularioMovimiento } from "core";
import Campo from "./Campo";
import Boton from "./Boton";
import ErrorTexto from "./ErrorTexto";
import SelectorChips from "./SelectorChips";
import { spacing, useTheme, font, type Colors } from "../lib/theme";

type Props = {
  tipo: "gasto" | "ingreso";
  inicial: FormularioMovimiento;
  categorias: Categoria[];
  cuentas: Cuenta[];
  permitido: EdicionPermitida;
  onGuardar: (f: FormularioMovimiento) => Promise<void>;
};

export default function FormularioEdicion({ tipo, inicial, categorias, cuentas, permitido, onGuardar }: Props) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [monto, setMonto] = useState(inicial.monto.toFixed(2));
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [categoriaId, setCategoriaId] = useState(inicial.categoriaId ?? "");
  const [categoriaDetalle, setCategoriaDetalle] = useState(inicial.categoriaDetalle ?? "");
  const [cuentaId, setCuentaId] = useState(inicial.cuentaId ?? "");
  const [fecha, setFecha] = useState(inicial.fecha);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const categoria = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoria?.nombre === "Otros";
  const cuentaActual = cuentas.find((c) => c.id === inicial.cuentaId);

  async function guardar() {
    setError(null);
    const montoNumerico = permitido.monto ? parsearMonto(monto) : inicial.monto;
    if (!(montoNumerico > 0)) {
      setError("Escribe un monto mayor que cero.");
      return;
    }
    if (tipo === "gasto" && !categoriaId) {
      setError("Elige una categoría.");
      return;
    }
    if (esOtros && !categoriaDetalle.trim()) {
      setError("Cuéntanos qué fue (categoría Otros).");
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({
        monto: montoNumerico,
        descripcion: descripcion.trim() || categoria?.nombre || inicial.descripcion,
        categoriaId: categoriaId || undefined,
        // El detalle solo vale con «Otros»: al cambiar de categoría se quita.
        categoriaDetalle: esOtros ? categoriaDetalle : "",
        cuentaId: permitido.cuenta ? cuentaId : inicial.cuentaId ?? "",
        fecha: permitido.fecha ? fecha.trim() : inicial.fecha,
      });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={{ gap: spacing(4) }}>
      {permitido.aviso && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>{permitido.aviso}</Text>
        </View>
      )}

      {permitido.monto ? (
        <Campo etiqueta="Monto" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} placeholder="0.00" />
      ) : (
        <SoloLectura etiqueta="Monto" valor={`$${inicial.monto.toFixed(2)}`} />
      )}

      <Campo
        etiqueta="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={tipo === "gasto" ? 40 : undefined}
      />

      <SelectorChips
        titulo={tipo === "gasto" ? "Categoría" : "Fuente"}
        valor={categoriaId}
        onCambiar={setCategoriaId}
        opciones={[
          ...(tipo === "ingreso" ? [{ valor: "", etiqueta: "Sin especificar" }] : []),
          ...categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre, color: c.color })),
        ]}
      />
      {esOtros && (
        <Campo
          etiqueta={tipo === "gasto" ? "¿Qué fue?" : "Detalle"}
          value={categoriaDetalle}
          onChangeText={setCategoriaDetalle}
        />
      )}

      {permitido.cuenta ? (
        <SelectorChips
          titulo={tipo === "gasto" ? "Cuenta / tarjeta" : "Cuenta destino"}
          valor={cuentaId}
          onCambiar={setCuentaId}
          opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
        />
      ) : (
        <SoloLectura etiqueta="Tarjeta" valor={cuentaActual?.nombre ?? "Sin asignar"} />
      )}

      {permitido.fecha ? (
        <Campo etiqueta="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} placeholder="2026-10-16" />
      ) : (
        <SoloLectura etiqueta="Fecha" valor={fechaLarga(inicial.fecha)} />
      )}

      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton
        titulo={guardando ? "Guardando…" : "Guardar cambios"}
        variante="primario"
        onPress={guardar}
        loading={guardando}
        disabled={guardando}
      />
    </View>
  );
}

function SoloLectura({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const { color } = useTheme();
  const styles = createStyles(color);
  return (
    <View style={{ gap: 4 }} accessible accessibilityLabel={`${etiqueta}: ${valor}. No se puede cambiar.`}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.soloLectura}>{valor}</Text>
    </View>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    aviso: { backgroundColor: color.warningBg, borderRadius: 10, padding: spacing(3) },
    avisoTexto: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.warning },
    etiqueta: { fontFamily: font.body, fontSize: 13, fontWeight: "600", color: color.textMuted },
    soloLectura: {
      fontFamily: font.body,
      fontSize: 15,
      color: color.textMuted,
      backgroundColor: color.surface2,
      borderRadius: 10,
      paddingHorizontal: spacing(3),
      paddingVertical: spacing(3),
    },
  });
