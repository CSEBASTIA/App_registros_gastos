import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  listarCuentas,
  crearCuenta,
  mensajeError,
  parsearMonto,
  OPCIONES_BANCO,
  OPCIONES_CASA_COMERCIAL,
  OPCIONES_MARCA,
  ETIQUETA_BANCO,
  ETIQUETA_MARCA,
  GRADIENTE_BANCO,
  type Cuenta,
  type Banco,
  type Marca,
} from "core";
import Tarjeta from "../../components/Tarjeta";
import TarjetaVisual from "../../components/TarjetaVisual";
import Campo from "../../components/Campo";
import Boton from "../../components/Boton";
import ErrorTexto from "../../components/ErrorTexto";
import SelectorChips from "../../components/SelectorChips";
import EstadoVacio from "../../components/EstadoVacio";
import { spacing, useTheme, font, type Colors } from "../../lib/theme";
import { BlurFade } from "../../components/Motion";
import {
  gruposDelCatalogo,
  productoDe,
  type ProductoTarjeta,
} from "../../lib/catalogoTarjetas";

export default function TarjetasScreen() {
  const [error, setError] = useState<string | null>(null);
  const { color } = useTheme();
  const styles = createStyles(color);
  const router = useRouter();
  const [tarjetas, setTarjetas] = useState<Cuenta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    listarCuentas()
      .then((todas) => setTarjetas(todas.filter((c) => c.tipo === "credito")))
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">) {
    await crearCuenta(input);
    setMostrarForm(false);
    cargar();
  }

  if (cargando)
    return (
      <View
        style={[
          styles.contenedor,
          {
            alignItems: "center",
            justifyContent: "center",
            padding: spacing(6),
            gap: spacing(3),
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator
          color={color.primary}
          accessibilityLabel="Cargando"
        />
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 14,
            color: color.textMuted,
          }}
        >
          Cargando tus datos…
        </Text>
      </View>
    );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: color.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.contenedor}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: spacing(5),
            paddingBottom: spacing(8),
            gap: spacing(4),
          }}
        >
          <BlurFade style={{ gap: spacing(2) }}>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              Tarjetas
            </Text>
            <Text style={styles.screenIntro}>
              Tu cupo y tus movimientos, a mano.
            </Text>
          </BlurFade>
          {error && <ErrorTexto>{error}</ErrorTexto>}
          {mostrarForm ? (
            <NuevaTarjeta
              onCrear={crearYCerrar}
              onCancelar={() => setMostrarForm(false)}
            />
          ) : (
            <Boton
              titulo="+ Agregar tarjeta"
              variante="primario"
              onPress={() => setMostrarForm(true)}
            />
          )}

          {!cargando && tarjetas.length === 0 ? (
            <EstadoVacio
              icono="card-outline"
              titulo="Todavía no agregaste tarjetas de crédito"
              subtitulo="Creá una arriba para empezar a controlar su cupo."
            />
          ) : (
            <View style={{ gap: spacing(3) }}>
              {tarjetas.map((t) => (
                <TarjetaVisual
                  key={t.id}
                  cuenta={t}
                  onPress={() => router.push(`/tarjeta/${t.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NuevaTarjeta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const { color } = useTheme();
  const styles = createStyles(color);
  const [nombre, setNombre] = useState("American Express® Clásica Crédito");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [marca, setMarca] = useState<Marca>("amex");
  const [estilo, setEstilo] = useState<string | undefined>("amex-clasica-credito");
  const [usarCatalogo, setUsarCatalogo] = useState(true);
  const [cupoTotal, setCupoTotal] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [clase, setClase] = useState<"banco" | "casa">("banco");
  const [diaCorte, setDiaCorte] = useState("");
  const [diaPago, setDiaPago] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const grupos = clase === "casa" ? [] : gruposDelCatalogo(banco);

  function cambiarClase(valor: string) {
    if (valor === "casa") {
      setClase("casa");
      seleccionarCasa(OPCIONES_CASA_COMERCIAL[0]);
    } else {
      setClase("banco");
      seleccionarBanco("banco_guayaquil");
    }
  }

  // Casa comercial o crédito directo: una tarjeta de crédito sin catálogo ni marca.
  function seleccionarCasa(valor: string) {
    const casa = valor as Banco;
    setBanco(casa);
    setEstilo(undefined);
    setUsarCatalogo(false);
    setMarca("otro");
    setNombre(casa === "otra_casa_comercial" ? "" : `${ETIQUETA_BANCO[casa]} crédito directo`);
  }

  /** "" = no indicado; un número de 1 a 31; NaN = inválido. */
  function leerDia(texto: string): number | undefined {
    if (!texto.trim()) return undefined;
    const n = Number(texto.trim());
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : NaN;
  }
  const tarjetaElegida = productoDe(estilo);

  function seleccionarProducto(producto: ProductoTarjeta) {
    setBanco(producto.banco);
    setMarca(producto.marca);
    setEstilo(producto.id);
    setNombre(producto.nombre);
    setUsarCatalogo(true);
  }

  function seleccionarBanco(valor: string) {
    const bancoNuevo = valor as Banco;
    setBanco(bancoNuevo);
    const primerProducto = gruposDelCatalogo(bancoNuevo)[0]?.items[0];
    if (primerProducto) {
      seleccionarProducto(primerProducto);
    } else {
      setEstilo(undefined);
      setNombre("");
      setMarca("visa");
      setUsarCatalogo(false);
    }
  }

  async function agregar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la tarjeta.");
      return;
    }
    if (!(parsearMonto(cupoTotal) > 0)) {
      setError(clase === "casa" ? "Escribe el cupo que te aprobó la casa comercial." : "Una tarjeta de crédito necesita un cupo total.");
      return;
    }
    const corte = leerDia(diaCorte);
    const pago = leerDia(diaPago);
    if (Number.isNaN(corte) || Number.isNaN(pago)) {
      setError("El día de corte y el de pago van de 1 a 31.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        nombre,
        tipo: "credito",
        banco,
        marca,
        estilo,
        cupoTotal: parsearMonto(cupoTotal),
        disponible: parsearMonto(cupoTotal),
        identificador: identificador.trim() || undefined,
        diaCorte: corte,
        diaPago: pago,
      });
      setNombre("");
      setEstilo(undefined);
      setUsarCatalogo(true);
      setCupoTotal("");
      setIdentificador("");
      setDiaCorte("");
      setDiaPago("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.encabezado}>
        <Text style={styles.tituloCard}>{clase === "casa" ? "Nuevo crédito directo" : "Nueva tarjeta de crédito"}</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} />
      </View>
      <SelectorChips
        titulo="¿De dónde es el crédito?"
        valor={clase}
        onCambiar={cambiarClase}
        opciones={[
          { valor: "banco", etiqueta: "Tarjeta de banco" },
          { valor: "casa", etiqueta: "Casa comercial o crédito directo" },
        ]}
      />
      {clase === "casa" && (
        <SelectorChips
          titulo="Casa comercial"
          valor={banco}
          onCambiar={seleccionarCasa}
          opciones={OPCIONES_CASA_COMERCIAL.map((b) => ({ valor: b, etiqueta: ETIQUETA_BANCO[b], color: GRADIENTE_BANCO[b][0] }))}
        />
      )}
      <Campo etiqueta="Nombre" placeholder={clase === "casa" ? "Crédito Comandato" : "Visa Clásica"} value={nombre} onChangeText={setNombre} />
      <Campo etiqueta={clase === "casa" ? "Cupo aprobado" : "Cupo total"} keyboardType="decimal-pad" value={cupoTotal} onChangeText={setCupoTotal} />
      <View style={{ flexDirection: "row", gap: spacing(3) }}>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Día de corte (opcional)" placeholder="15" keyboardType="number-pad" maxLength={2} value={diaCorte} onChangeText={setDiaCorte} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Día de pago (opcional)" placeholder="30" keyboardType="number-pad" maxLength={2} value={diaPago} onChangeText={setDiaPago} />
        </View>
      </View>
      <Campo etiqueta="Últimos dígitos (opcional)" placeholder="1234" keyboardType="number-pad" maxLength={4} value={identificador} onChangeText={setIdentificador} />
      {clase === "banco" && <SelectorChips
        titulo="Banco"
        valor={banco}
        onCambiar={seleccionarBanco}
        opciones={OPCIONES_BANCO.map((b) => ({
          valor: b,
          etiqueta: ETIQUETA_BANCO[b],
          color: GRADIENTE_BANCO[b][0],
        }))}
      />}
      {clase === "casa" ? (
        <TarjetaVisual
          cuenta={{
            id: "vista-previa",
            nombre: nombre || ETIQUETA_BANCO[banco],
            tipo: "credito",
            banco,
            cupoTotal: parsearMonto(cupoTotal) > 0 ? parsearMonto(cupoTotal) : 1,
            disponible: parsearMonto(cupoTotal) > 0 ? parsearMonto(cupoTotal) : 1,
            diaCorte: leerDia(diaCorte) || undefined,
            diaPago: leerDia(diaPago) || undefined,
            createdAt: "",
          }}
        />
      ) : grupos.length > 0 && usarCatalogo ? (
        <View style={{ gap: spacing(3) }}>
          <Text style={styles.etiquetaCatalogo}>Tarjetas de {ETIQUETA_BANCO[banco]}</Text>
          {grupos.map((grupo) => (
            <View key={grupo.familia} style={{ gap: spacing(2) }}>
              <Text style={styles.nombreFamilia}>{grupo.familia}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filaProductos}>
                {grupo.items.map((producto) => {
                  const cuentaProducto: Cuenta = {
                    id: producto.id,
                    nombre: producto.nombre,
                    tipo: "credito",
                    banco: producto.banco,
                    marca: producto.marca,
                    estilo: producto.id,
                    disponible: 0,
                    createdAt: "",
                  };
                  const seleccionada = producto.id === estilo;
                  return (
                    <Pressable
                      key={producto.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: seleccionada }}
                      accessibilityLabel={`Seleccionar ${producto.nombre}`}
                      onPress={() => seleccionarProducto(producto)}
                      style={({ pressed }) => [styles.opcionProducto, seleccionada && { borderColor: color.primary }, pressed && { opacity: 0.8 }]}
                    >
                      <TarjetaVisual cuenta={cuentaProducto} compacta seleccionada={seleccionada} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setUsarCatalogo(false);
              setEstilo(undefined);
              setNombre("");
            }}
            style={styles.otraTarjeta}
          >
            <Text style={styles.otraTarjetaTexto}>Mi tarjeta no aparece</Text>
          </Pressable>
        </View>
      ) : (
        <SelectorChips
          titulo="Marca"
          valor={marca}
          onCambiar={(v) => setMarca(v as Marca)}
          opciones={OPCIONES_MARCA.map((m) => ({ valor: m, etiqueta: ETIQUETA_MARCA[m] || "Otra" }))}
        />
      )}
      {usarCatalogo && tarjetaElegida && (
        <View style={{ gap: spacing(2) }}>
          <Text style={styles.nombreFamilia}>Vista previa · {tarjetaElegida.nombre}</Text>
          <TarjetaVisual
            cuenta={{
              id: "vista-previa",
              nombre: nombre || tarjetaElegida.nombre,
              tipo: "credito",
              banco,
              marca,
              estilo,
              cupoTotal: parsearMonto(cupoTotal) > 0 ? parsearMonto(cupoTotal) : 1,
              disponible: parsearMonto(cupoTotal) > 0 ? parsearMonto(cupoTotal) : 1,
              createdAt: "",
            }}
          />
        </View>
      )}
      {error && <ErrorTexto>{error}</ErrorTexto>}
      <Boton
        titulo={guardando ? "Guardando…" : "Agregar"}
        variante="primario"
        onPress={agregar}
        loading={guardando}
        disabled={guardando}
      />
    </Tarjeta>
  );
}

const createStyles = (color: Colors) =>
  StyleSheet.create({
    screenTitle: {
      fontFamily: font.display,
      fontSize: 30,
      lineHeight: 36,
      color: color.text,
    },
    screenIntro: {
      fontFamily: font.body,
      fontSize: 14,
      lineHeight: 21,
      color: color.textMuted,
    },
    contenedor: { flex: 1, backgroundColor: color.bg },
    encabezado: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(3),
      justifyContent: "space-between",
      alignItems: "center",
    },
    tituloCard: { fontFamily: font.display, fontSize: 20, color: color.text },
    etiquetaCatalogo: { fontFamily: font.semibold, fontSize: 14, color: color.text },
    nombreFamilia: { fontFamily: font.medium, fontSize: 12, color: color.textMuted },
    filaProductos: { gap: spacing(3), paddingVertical: spacing(1), paddingHorizontal: spacing(1) },
    opcionProducto: { width: 184, borderWidth: 1, borderColor: color.border, borderRadius: 18 },
    otraTarjeta: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center", paddingHorizontal: spacing(3), borderWidth: 1, borderColor: color.border, borderRadius: 999 },
    otraTarjetaTexto: { fontFamily: font.medium, fontSize: 12, color: color.textMuted },
  });
