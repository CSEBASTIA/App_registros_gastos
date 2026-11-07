import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  ETIQUETA_BANCO,
  crearCuenta,
  cuentaDelEstado,
  parsearMonto,
  propuestaCuentaDelEstado,
  type PropuestaCuentaNueva,
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
import SelectorChips from "../components/SelectorChips";
import { leerPdfEntrante, tomarPdfEntrante } from "../lib/pdfEntrante";
import { borrarCopiaTemporal, leerArchivoBase64, leerArchivoTexto, TAMANO_MAXIMO_ESTADO } from "../lib/archivosImportacion";
import { spacing, useTheme, font, radius, type Colors } from "../lib/theme";

type Fase = "elegir" | "leyendo" | "clave" | "cuenta" | "revisar" | "guardando" | "listo";

const TIPOS_ARCHIVO = ["application/pdf", "text/csv", "text/comma-separated-values", "text/plain"];

/** "2026-10-02" → "02/10/2026" */
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Importar el estado de cuenta de una cuenta o tarjeta: se abre al crearla
 * («Agregar e importar»), desde su detalle, o sin cuenta («Subir PDF» o un PDF
 * abierto con la app desde otra): entonces la app reconoce por el banco y los
 * últimos dígitos de qué cuenta es y, si aún no existe (al empezar a usar la
 * app), la propone con los datos del propio estado de cuenta. El archivo se lee en el teléfono
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

  // undefined: cargando. null: sin cuenta (con `cuentaId`, no existe; sin él, aún no se sabe de cuál es).
  const [cuenta, setCuenta] = useState<Cuenta | null | undefined>(undefined);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  // El texto leído mientras se elige o se crea la cuenta (solo en memoria).
  const textoPendiente = useRef<string | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaCuentaNueva | null>(null);
  const [cuentaElegida, setCuentaElegida] = useState("");
  const [nombreNueva, setNombreNueva] = useState("");
  const [digitosNueva, setDigitosNueva] = useState("");
  const [saldoNueva, setSaldoNueva] = useState("");
  const [cupoNueva, setCupoNueva] = useState("");
  const [creando, setCreando] = useState(false);
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
      .then(([cs, cats]) => {
        setCuentas(cs);
        setCuenta(cuentaId ? (cs.find((c) => c.id === cuentaId) ?? null) : null);
        setCategorias(cats);
      })
      .catch((err) => {
        setError(mensajeError(err));
        setCuenta(null);
      });
  }, [cuentaId]);

  // Un PDF abierto con «Abrir con FinTrack» desde otra app: se lee apenas cargan las cuentas.
  const pdfEntranteLeido = useRef(false);
  useEffect(() => {
    if (cuentaId || cuenta !== null || pdfEntranteLeido.current) return;
    pdfEntranteLeido.current = true;
    const uri = tomarPdfEntrante();
    if (!uri) return;
    setNombreArchivo("el PDF compartido");
    setFase("leyendo");
    leerPdfEntrante(uri)
      .then((base64) => leerPdf(base64))
      .catch((err) => {
        setError(mensajeError(err));
        setFase("elegir");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta, cuentaId]);

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

  async function analizar(texto: string, laCuenta: Cuenta | null = cuenta ?? null) {
    const transacciones = parseEstadoCuenta(texto);
    if (transacciones.length === 0) {
      throw new Error(
        "No encontré movimientos en el archivo. Revisa que muestre la fecha, el detalle y el monto de cada consumo."
      );
    }
    if (!laCuenta) {
      // ¿De qué cuenta es? Por el banco y los últimos dígitos de la cabecera.
      const detectada = cuentaDelEstado(texto, cuentas);
      const reconocida = detectada.cuentaId ? cuentas.find((c) => c.id === detectada.cuentaId) : undefined;
      if (!reconocida) {
        const p = propuestaCuentaDelEstado(texto, detectada, saldosDelEstado(texto).anterior);
        textoPendiente.current = texto;
        setPropuesta(p);
        setNombreNueva(p.nombre);
        setDigitosNueva(p.identificador ?? "");
        setSaldoNueva(p.disponible !== undefined ? p.disponible.toFixed(2) : "");
        setCupoNueva(p.cupoTotal !== undefined ? p.cupoTotal.toFixed(2) : "");
        setCuentaElegida("");
        setFase("cuenta");
        return;
      }
      laCuenta = reconocida;
      setCuenta(reconocida);
    }
    const preparado = prepararFilasImportacion(transacciones, laCuenta.tipo, await movimientosDelPeriodo(transacciones));
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

  /** Sigue con una cuenta que ya existe, elegida por la persona. */
  async function usarCuentaElegida() {
    const elegida = cuentas.find((c) => c.id === cuentaElegida);
    if (!elegida || !textoPendiente.current) return;
    setError(null);
    setCuenta(elegida);
    try {
      await analizar(textoPendiente.current, elegida);
      textoPendiente.current = null;
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  /** Crea la cuenta o tarjeta con los datos del estado de cuenta (revisados) y sigue con sus movimientos. */
  async function crearCuentaDelEstado() {
    if (!propuesta || !textoPendiente.current || creando) return;
    setError(null);
    const esTarjeta = propuesta.tipo === "credito";
    const saldo = saldoNueva.trim() ? parsearMonto(saldoNueva) : 0;
    const cupo = parsearMonto(cupoNueva);
    if (!Number.isFinite(saldo)) return setError(esTarjeta ? "Escribe el cupo disponible." : "Escribe el saldo con números.");
    if (esTarjeta && !(cupo > 0)) return setError("Escribe el cupo total de la tarjeta (sale en el estado de cuenta).");
    setCreando(true);
    try {
      const nueva = await crearCuenta({
        nombre: nombreNueva.trim(),
        tipo: propuesta.tipo,
        banco: propuesta.banco,
        disponible: saldo,
        ...(digitosNueva.trim() ? { identificador: digitosNueva.trim() } : {}),
        ...(esTarjeta ? { cupoTotal: cupo } : {}),
      });
      setCuentas((cs) => [...cs, nueva]);
      setCuenta(nueva);
      await analizar(textoPendiente.current, nueva);
      textoPendiente.current = null;
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCreando(false);
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
  if (cuenta === null && cuentaId) {
    return (
      <View style={[styles.contenedor, styles.centro]}>
        <ErrorTexto>{error ?? "No encontré esa cuenta."}</ErrorTexto>
        <Boton titulo="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const esCredito = cuenta?.tipo === "credito";
  // Para elegir una cuenta existente: las del tipo del estado (tarjeta o cuenta), sin el efectivo.
  const compatibles = cuentas.filter((c) =>
    c.tipo !== "efectivo" && (propuesta?.tipo === "credito" ? c.tipo === "credito" : c.tipo !== "credito"),
  );

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
            {cuenta
              ? `${cuenta.nombre}: sube el estado de cuenta y la app arma los movimientos para que los revises.`
              : "Sube el estado de cuenta en PDF que te manda el banco: la app reconoce de qué cuenta o tarjeta es (o la crea con sus datos) y arma los movimientos para que los revises."}
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

        {fase === "cuenta" && propuesta && (
          <Tarjeta>
            <View style={styles.filaTitulo}>
              <Ionicons name={propuesta.tipo === "credito" ? "card-outline" : "wallet-outline"} size={18} color={color.textMuted} />
              <Text style={styles.tituloCard}>¿De qué {propuesta.tipo === "credito" ? "tarjeta" : "cuenta"} es?</Text>
            </View>
            <Text style={styles.texto}>
              {`Es un estado de ${propuesta.tipo === "credito" ? "tarjeta de crédito" : "cuenta"}${
                propuesta.banco !== "otro" ? ` de ${ETIQUETA_BANCO[propuesta.banco]}` : ""
              }${propuesta.identificador ? ` terminada en ${propuesta.identificador}` : ""}, y no la encontré entre las tuyas.`}
            </Text>

            {compatibles.length > 0 && (
              <>
                <SelectorChips
                  titulo="¿Es una que ya tienes?"
                  opciones={compatibles.map((c) => ({
                    valor: c.id,
                    etiqueta: c.identificador ? `${c.nombre} ••${c.identificador}` : c.nombre,
                  }))}
                  valor={cuentaElegida}
                  onCambiar={setCuentaElegida}
                />
                <Boton titulo="Usar esta" onPress={usarCuentaElegida} disabled={!cuentaElegida || creando} />
              </>
            )}

            <Text style={styles.textoMuted}>
              {compatibles.length > 0 ? "Si no, créala con los datos del estado de cuenta" : "Créala con los datos del estado de cuenta"}{" "}
              (revísalos; los cambias cuando quieras):
            </Text>
            <Campo etiqueta="Nombre" value={nombreNueva} onChangeText={setNombreNueva} maxLength={60} />
            <Campo
              etiqueta="Últimos 4 dígitos"
              value={digitosNueva}
              onChangeText={(v) => setDigitosNueva(v.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
            />
            {propuesta.tipo === "credito" && (
              <Campo etiqueta="Cupo total" value={cupoNueva} onChangeText={setCupoNueva} keyboardType="decimal-pad" placeholder="Ej. 2500.00" />
            )}
            <Campo
              etiqueta={propuesta.tipo === "credito" ? "Cupo disponible al inicio del estado" : "Saldo al inicio del estado"}
              value={saldoNueva}
              onChangeText={setSaldoNueva}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Text style={styles.textoMuted}>
              {propuesta.tipo === "credito"
                ? "Es el cupo menos lo que debías al empezar el periodo: al importar los consumos, queda el cupo disponible de hoy."
                : "Es el «saldo anterior» del estado: al importar los movimientos, la cuenta queda con el saldo de hoy."}
            </Text>
            <Boton
              titulo={`Crear ${propuesta.tipo === "credito" ? "tarjeta" : "cuenta"} y ver movimientos`}
              variante="primario"
              onPress={crearCuentaDelEstado}
              loading={creando}
              disabled={!nombreNueva.trim()}
            />
            <Boton
              titulo="Elegir otro archivo"
              onPress={() => {
                textoPendiente.current = null;
                setPropuesta(null);
                setFase("elegir");
              }}
              disabled={creando}
            />
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

        {(fase === "revisar" || fase === "guardando") && preparadas && resumen && cuenta && (
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
                // Sin cuenta fija, el próximo estado puede ser de otra cuenta.
                listarCuentas()
                  .then((cs) => {
                    setCuentas(cs);
                    setCuenta(cuentaId ? (cs.find((c) => c.id === cuentaId) ?? null) : null);
                  })
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
