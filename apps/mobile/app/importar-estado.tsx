import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  ErrorImportacionParcial,
  formatMonto,
  importarMovimientos,
  lineasDeTextoPdf,
  listarCategorias,
  listarCuentas,
  mensajeError,
  movimientosDelPeriodo,
  movimientosParaGuardar,
  paginaSinTexto,
  parseEstadoCuenta,
  saldosDelEstado,
  prepararFilasImportacion,
  resumenImportacion,
  textoResultadoImportacion,
  type Categoria,
  type Cuenta,
  type FilaImportacion,
  type FilasPreparadas,
} from "core";
import Tarjeta from "../components/Tarjeta";
import ResumenEstadoCuenta from "../components/ResumenEstadoCuenta";
import Boton from "../components/Boton";
import Campo from "../components/Campo";
import Casilla from "../components/Casilla";
import ErrorTexto from "../components/ErrorTexto";
import LectorPdf, { ErrorClavePdf, type LectorPdfRef } from "../components/LectorPdf";
import { avisarPresupuestos } from "../lib/notificaciones";
import { borrarCopiaTemporal, leerArchivoBase64, leerArchivoTexto, TAMANO_MAXIMO_ESTADO } from "../lib/archivosImportacion";
import { spacing, useTheme, font, radius, type Colors } from "../lib/theme";

type Fase = "elegir" | "leyendo" | "clave" | "revisar" | "guardando" | "listo";

const TIPOS_ARCHIVO = ["application/pdf", "text/csv", "text/comma-separated-values", "text/plain"];

/** "2026-10-02" → "02/10/2026" */
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Importar el estado de cuenta de una cuenta o tarjeta: se abre al crearla
 * («Agregar e importar») o desde su detalle. El archivo se lee en el teléfono
 * (o en el navegador, en la web) y no se sube a ningún servidor; nada se
 * guarda hasta que la persona revisa las filas y confirma.
 */
export default function ImportarEstadoScreen() {
  const { cuentaId } = useLocalSearchParams<{ cuentaId: string }>();
  const router = useRouter();
  const { color } = useTheme();
  const styles = crearEstilos(color);
  const lector = useRef<LectorPdfRef>(null);
  // El PDF con clave se guarda solo en memoria mientras se pide la clave.
  const pdfPendiente = useRef<string | null>(null);

  const [cuenta, setCuenta] = useState<Cuenta | null | undefined>(undefined);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fase, setFase] = useState<Fase>("elegir");
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [clave, setClave] = useState("");
  const [preparadas, setPreparadas] = useState<FilasPreparadas | null>(null);
  const [filas, setFilas] = useState<FilaImportacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  // Saldo final que declara el propio estado («SALDO ACTUAL»), para compararlo.
  const [saldoFinalEstado, setSaldoFinalEstado] = useState<number | undefined>(undefined);

  useEffect(() => {
    Promise.all([listarCuentas(), listarCategorias()])
      .then(([cuentas, cats]) => {
        setCuenta(cuentas.find((c) => c.id === cuentaId) ?? null);
        setCategorias(cats);
      })
      .catch((err) => {
        setError(mensajeError(err));
        setCuenta(null);
      });
  }, [cuentaId]);

  const resumen = useMemo(() => (cuenta ? resumenImportacion(filas, cuenta) : null), [filas, cuenta]);
  const elegidas = resumen ? resumen.gastos + resumen.ingresos : 0;
  // Una tarjeta puede pasarse del cupo (queda sobreendeudada): solo se avisa.
  const pasaElCupo = cuenta?.tipo === "credito" && !!resumen && resumen.disponibleDespues < 0;
  // Una cuenta de ahorro, de débito o el efectivo no puede quedar en negativo: la base lo rechazaría.
  const quedaEnNegativo = cuenta?.tipo !== "credito" && !!resumen && resumen.disponibleDespues < 0;

  function irALaCuenta() {
    if (!cuenta) return router.back();
    router.replace(cuenta.tipo === "credito" ? `/tarjeta/${cuenta.id}` : `/cuenta/${cuenta.id}`);
  }

  async function analizar(texto: string) {
    if (!cuenta) return;
    const transacciones = parseEstadoCuenta(texto);
    if (transacciones.length === 0) {
      throw new Error(
        "No encontré movimientos en el archivo. Revisa que muestre la fecha, el detalle y el monto de cada consumo."
      );
    }
    const preparado = prepararFilasImportacion(transacciones, cuenta.tipo, await movimientosDelPeriodo(transacciones));
    if (preparado.filas.length === 0) {
      throw new Error("El estado de cuenta solo trae pagos a la tarjeta: no hay consumos para importar.");
    }
    setSaldoFinalEstado(saldosDelEstado(texto).final);
    setPreparadas(preparado);
    setFilas(preparado.filas);
    setFase("revisar");
  }

  async function leerPdf(base64: string, claveEscrita?: string) {
    try {
      const paginas = await lector.current!.leer(base64, claveEscrita);
      const conTexto = paginas.filter((p) => !paginaSinTexto(p));
      if (conTexto.length === 0) {
        throw new Error(
          "Este PDF es una imagen escaneada y la app todavía no puede leerlo. Descarga el estado de cuenta desde la banca en línea (PDF original) o exporta los movimientos en CSV."
        );
      }
      pdfPendiente.current = null;
      setClave("");
      await analizar(conTexto.flatMap(lineasDeTextoPdf).join("\n"));
    } catch (err) {
      if (err instanceof ErrorClavePdf) {
        pdfPendiente.current = base64;
        setError(err.motivo === "incorrecta" ? err.message : null);
        setFase("clave");
        return;
      }
      pdfPendiente.current = null;
      throw err;
    }
  }

  async function elegirArchivo() {
    setError(null);
    setResultado(null);
    let r: DocumentPicker.DocumentPickerResult;
    try {
      r = await DocumentPicker.getDocumentAsync({ type: TIPOS_ARCHIVO, copyToCacheDirectory: true, multiple: false });
    } catch (err) {
      setError(mensajeError(err));
      return;
    }
    if (r.canceled || !r.assets?.[0]) return;
    const archivo = r.assets[0];
    setNombreArchivo(archivo.name);
    if (archivo.size && archivo.size > TAMANO_MAXIMO_ESTADO) {
      await borrarCopiaTemporal(archivo.uri);
      setError("El archivo pesa más de 10 MB: no parece un estado de cuenta.");
      return;
    }
    const esPdf = archivo.mimeType === "application/pdf" || /\.pdf$/i.test(archivo.name);
    setFase("leyendo");
    try {
      if (esPdf) {
        const base64 = await leerArchivoBase64(archivo.uri);
        await borrarCopiaTemporal(archivo.uri);
        await leerPdf(base64);
      } else {
        const texto = await leerArchivoTexto(archivo.uri);
        await borrarCopiaTemporal(archivo.uri);
        await analizar(texto);
      }
    } catch (err) {
      await borrarCopiaTemporal(archivo.uri);
      setError(mensajeError(err));
      setFase("elegir");
    }
  }

  async function abrirConClave() {
    if (!pdfPendiente.current || !clave) return;
    setError(null);
    setFase("leyendo");
    try {
      await leerPdf(pdfPendiente.current, clave);
    } catch (err) {
      setError(mensajeError(err));
      setFase("elegir");
    }
  }

  function cambiarFila(id: number, seleccionada: boolean) {
    setFilas((actuales) => actuales.map((f) => (f.id === id ? { ...f, seleccionada } : f)));
  }

  function marcarTodas(seleccionada: boolean) {
    setFilas((actuales) => actuales.map((f) => ({ ...f, seleccionada })));
  }

  async function importar() {
    if (!cuenta) return;
    setError(null);
    setFase("guardando");
    try {
      const r = await importarMovimientos(movimientosParaGuardar(filas, cuenta, categorias));
      setResultado(textoResultadoImportacion(r));
      // Si lo importado de este mes pasó un presupuesto, avisa ya (sin esperar).
      void avisarPresupuestos();
      setFase("listo");
    } catch (err) {
      // Los ingresos ya quedaron guardados: salen de la lista y solo se reintentan los gastos.
      if (err instanceof ErrorImportacionParcial) {
        setFilas((actuales) => actuales.filter((f) => !(f.tipo === "ingreso" && f.seleccionada)));
      }
      setError(mensajeError(err));
      setFase("revisar");
    }
  }

  if (cuenta === undefined) {
    return (
      <View style={[styles.contenedor, styles.centro]}>
        <ActivityIndicator color={color.primary} accessibilityLabel="Cargando" />
      </View>
    );
  }
  if (cuenta === null) {
    return (
      <View style={[styles.contenedor, styles.centro]}>
        <ErrorTexto>{error ?? "No encontré esa cuenta."}</ErrorTexto>
        <Boton titulo="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const esCredito = cuenta.tipo === "credito";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <LectorPdf ref={lector} />
      <ScrollView
        style={styles.contenedor}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing(5), paddingBottom: spacing(10), gap: spacing(4) }}
      >
        <View style={{ gap: spacing(2) }}>
          <Text accessibilityRole="header" style={styles.titulo}>
            Estado de cuenta
          </Text>
          <Text style={styles.intro}>
            {cuenta.nombre}: sube el estado de cuenta y la app arma los movimientos para que los revises.
          </Text>
        </View>

        {(fase === "elegir" || fase === "leyendo") && (
          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Ionicons name="document-text-outline" size={18} color={color.textMuted} />
              <Text style={styles.tituloCard}>Elige el archivo</Text>
            </View>
            <Text style={styles.textoMuted}>
              • PDF original de tu banca en línea (con texto, no una foto) o CSV con los movimientos.
            </Text>
            <Text style={styles.textoMuted}>
              • Se lee aquí mismo{Platform.OS === "web" ? ", en tu navegador" : ", en tu teléfono"}: el archivo no se
              sube a ningún servidor y no se guarda.
            </Text>
            <Text style={styles.textoMuted}>• Nada se registra hasta que revises y confirmes.</Text>
            {fase === "leyendo" ? (
              <View style={styles.filaTitulo} accessibilityLiveRegion="polite">
                <ActivityIndicator color={color.primary} />
                <Text style={styles.texto}>Leyendo {nombreArchivo ?? "el archivo"}…</Text>
              </View>
            ) : (
              <Boton titulo="Elegir PDF o CSV" variante="primario" onPress={elegirArchivo} />
            )}
            <Boton titulo="Ahora no" onPress={irALaCuenta} disabled={fase === "leyendo"} />
          </Tarjeta>
        )}

        {fase === "clave" && (
          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Ionicons name="lock-closed-outline" size={18} color={color.textMuted} />
              <Text style={styles.tituloCard}>El PDF tiene clave</Text>
            </View>
            <Text style={styles.textoMuted}>
              Muchos bancos protegen el estado de cuenta (suele ser tu número de cédula). La clave solo se usa para
              abrir el archivo aquí y no se guarda.
            </Text>
            <Campo
              etiqueta="Clave del PDF"
              value={clave}
              onChangeText={setClave}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={abrirConClave}
            />
            <Boton titulo="Abrir" variante="primario" onPress={abrirConClave} disabled={!clave} />
            <Boton
              titulo="Elegir otro archivo"
              onPress={() => {
                pdfPendiente.current = null;
                setClave("");
                setError(null);
                setFase("elegir");
              }}
            />
          </Tarjeta>
        )}

        {(fase === "revisar" || fase === "guardando") && preparadas && resumen && (
          <>
            <ResumenEstadoCuenta
              archivo={nombreArchivo}
              cuenta={cuenta}
              filas={filas}
              resumen={resumen}
              truncado={preparadas.truncado}
            />
            <Tarjeta>
              <Text style={styles.tituloCard}>Revisa tu selección</Text>
              <Text style={styles.textoMuted}>
                La categoría se sugiere sola; puedes cambiarla después en cada movimiento.
              </Text>
              {saldoFinalEstado !== undefined && !esCredito && (
                <Text style={styles.textoMuted}>
                  El estado termina con un saldo de {formatMonto(saldoFinalEstado)}
                  {Math.abs(saldoFinalEstado - resumen.disponibleDespues) < 0.005
                    ? ": coincide con la cuenta."
                    : `; la cuenta quedaría con ${formatMonto(resumen.disponibleDespues)}. Si no coinciden, revisa el saldo con el que creaste la cuenta o los movimientos que ya tenías.`}
                </Text>
              )}
              {pasaElCupo && (
                <Text style={styles.textoAviso}>
                  ⚠ Con lo marcado la tarjeta se pasa del cupo: quedará sobreendeudada (en rojo).
                </Text>
              )}
              {quedaEnNegativo && (
                <Text style={styles.textoAviso}>
                  Con lo marcado la cuenta quedaría en {formatMonto(resumen.disponibleDespues)}, y una cuenta no puede quedar en
                  negativo: desmarca algunos gastos o marca los ingresos que faltan.
                </Text>
              )}
              {preparadas.pagosOmitidos > 0 && (
                <Text style={styles.textoMuted}>
                  Se omitieron {preparadas.pagosOmitidos} pago(s) a la tarjeta: regístralos con «Pagar tarjeta» para que
                  también se descuenten de la cuenta desde la que pagaste.
                </Text>
              )}
              {filas.some((f) => f.tipo === "ingreso" && !f.seleccionada && !f.posibleDuplicado) && (
                <Text style={styles.textoMuted}>
                  Los abonos y depósitos que el estado no marca como crédito salen sin marcar: revisa que de verdad sean
                  ingresos antes de incluirlos.
                </Text>
              )}
              {filas.some((f) => f.posibleDuplicado) && (
                <Text style={styles.textoAviso}>
                  Los marcados como «posible duplicado» tienen la misma fecha y monto que algo que ya registraste: salen
                  sin marcar.
                </Text>
              )}
              {preparadas.truncado && (
                <Text style={styles.textoAviso}>El archivo tenía demasiadas filas: se muestran las primeras {filas.length}.</Text>
              )}
              <View style={styles.filaBotones}>
                <Boton titulo="Marcar todos" onPress={() => marcarTodas(true)} disabled={fase === "guardando"} style={{ flex: 1 }} />
                <Boton titulo="Ninguno" onPress={() => marcarTodas(false)} disabled={fase === "guardando"} style={{ flex: 1 }} />
              </View>
            </Tarjeta>

            <Tarjeta>
              <View style={{ gap: spacing(3) }}>
                {filas.map((f) => (
                  <Casilla
                    key={f.id}
                    marcada={f.seleccionada}
                    onChange={(v) => cambiarFila(f.id, v)}
                    disabled={fase === "guardando"}
                    etiqueta={`${f.tipo === "ingreso" ? "Ingreso" : "Gasto"} ${f.descripcion}, ${formatMonto(f.monto)}, ${fechaCorta(f.fecha)}`}
                  >
                    <Text style={styles.texto}>{f.descripcion}</Text>
                    {"\n"}
                    <Text style={styles.textoMuted}>
                      {fechaCorta(f.fecha)} · {f.tipo === "ingreso" ? "+" : "−"}
                      {formatMonto(f.monto)}
                      {f.tipo === "ingreso" ? " · ingreso" : ""}
                    </Text>
                    {f.posibleDuplicado && <Text style={styles.textoAviso}>{"\n"}Posible duplicado</Text>}
                  </Casilla>
                ))}
              </View>
            </Tarjeta>

            {error && <ErrorTexto>{error}</ErrorTexto>}
            <Boton
              titulo={
                fase === "guardando"
                  ? "Importando…"
                  : `Importar ${elegidas} movimiento${elegidas === 1 ? "" : "s"}`
              }
              variante="primario"
              onPress={importar}
              loading={fase === "guardando"}
              disabled={fase === "guardando" || elegidas === 0 || quedaEnNegativo}
            />
            <Boton
              titulo="Elegir otro archivo"
              onPress={() => {
                setPreparadas(null);
                setFilas([]);
                setError(null);
                setFase("elegir");
              }}
              disabled={fase === "guardando"}
            />
          </>
        )}

        {fase === "listo" && (
          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Ionicons name="checkmark-circle" size={20} color={color.success} />
              <Text style={styles.tituloCard}>Listo</Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.texto}>
              {resultado}
            </Text>
            <Boton titulo={esCredito ? "Ver la tarjeta" : "Ver la cuenta"} variante="primario" onPress={irALaCuenta} />
            <Boton
              titulo="Importar otro estado de cuenta"
              onPress={() => {
                setPreparadas(null);
                setFilas([]);
                setResultado(null);
                setFase("elegir");
                // El saldo cambió: se vuelve a leer para el próximo resumen.
                listarCuentas()
                  .then((cs) => setCuenta(cs.find((c) => c.id === cuentaId) ?? null))
                  .catch(() => {});
              }}
            />
          </Tarjeta>
        )}

        {error && fase !== "revisar" && fase !== "guardando" && <ErrorTexto>{error}</ErrorTexto>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const crearEstilos = (color: Colors) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: color.bg },
    centro: { alignItems: "center", justifyContent: "center", padding: spacing(6), gap: spacing(3) },
    titulo: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
    intro: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
    filaTitulo: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing(2) },
    filaBotones: { flexDirection: "row", gap: spacing(2) },
    tituloCard: { fontFamily: font.display, fontSize: 20, color: color.text },
    texto: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: color.text },
    textoMuted: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
    textoAviso: {
      fontFamily: font.body,
      fontSize: 13,
      lineHeight: 19,
      color: color.warning,
      borderRadius: radius.sm,
    },
  });
