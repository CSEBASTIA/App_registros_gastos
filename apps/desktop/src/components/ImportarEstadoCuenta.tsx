import { useRef, useState, type ChangeEvent } from "react";
import type { Categoria, Cuenta, Gasto } from "core";
import { leerEstadoCuenta, parseEstadoCuenta } from "../lib/estadoCuenta";
import {
  ErrorImportacionParcial,
  formatMonto,
  saldosDelEstado,
  importarMovimientos,
  mensajeError,
  movimientosDelPeriodo,
  prepararFilasImportacion,
  resumenImportacion,
} from "core";

interface Fila {
  id: number;
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso";
  seleccionado: boolean;
  categoriaId: string;
  posibleDuplicado: boolean;
}

interface Props {
  categorias: Categoria[];
  cuentas: Cuenta[];
  /** Importar directo a esta cuenta (al crearla): marca duplicados, propone ingresos y muestra el saldo final. */
  cuentaFija?: Cuenta;
  /** Sin `cuentaFija`: guarda los gastos elegidos (vista Gastos). */
  onImportar?: (gastos: Omit<Gasto, "id" | "createdAt">[]) => Promise<void>;
  /** Con `cuentaFija`: se llama después de guardar, para recargar los datos. */
  onImportado?: () => Promise<void>;
  onCerrar: () => void;
}

/**
 * Modal para subir un estado de cuenta (PDF o foto/captura) y convertir las
 * transacciones detectadas en gastos. Nada se guarda hasta que el usuario
 * revisa la tabla y confirma — el parseo es una heurística, no un OCR perfecto.
 * Con `cuentaFija` usa la misma lógica que el teléfono (core: filas,
 * duplicados, saldo y guardado en una sola escritura).
 */
export default function ImportarEstadoCuenta({ categorias, cuentas, cuentaFija, onImportar, onImportado, onCerrar }: Props) {
  const [fase, setFase] = useState<"elegir" | "leyendo" | "revisar" | "importando">("elegir");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cuentaId, setCuentaId] = useState(cuentaFija?.id ?? "");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoriasGasto = categorias.filter((c) => c.tipo !== "ingreso");

  async function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setError(null);
    setFase("leyendo");
    try {
      const texto = await leerEstadoCuenta(archivo);
      const transacciones = parseEstadoCuenta(texto);
      if (transacciones.length === 0) {
        setError(
          "No se reconocieron transacciones en el documento. Revisa que se vean la fecha de consumo, el comercio y el monto; también puedes probar con una foto más nítida."
        );
        setFase("elegir");
        return;
      }

      const categoriaPorNombre = new Map(categoriasGasto.map((c) => [c.nombre, c.id]));
      const otrosId = categoriaPorNombre.get("Otros") ?? "";
      if (cuentaFija) {
        const preparado = prepararFilasImportacion(transacciones, cuentaFija.tipo, await movimientosDelPeriodo(transacciones));
        const notas: string[] = [];
        if (preparado.pagosOmitidos > 0) {
          notas.push(
            `Se omitieron ${preparado.pagosOmitidos} pago(s) a la tarjeta: regístralos con «Registrar pago» para que también se descuenten de la cuenta de origen.`
          );
        }
        if (preparado.filas.some((f) => f.tipo === "ingreso" && !f.seleccionada && !f.posibleDuplicado)) {
          notas.push(
            "Los abonos y depósitos que el estado no marca como crédito salen sin marcar: revisa que de verdad sean ingresos antes de incluirlos."
          );
        }
        const { final } = saldosDelEstado(texto);
        if (final !== undefined && cuentaFija.tipo !== "credito") {
          notas.push(`El estado termina con un saldo de ${formatMonto(final)}: compáralo con el saldo de la cuenta después de importar.`);
        }
        if (preparado.filas.some((f) => f.posibleDuplicado)) {
          notas.push("Las filas «posible duplicado» tienen la misma fecha y monto que algo ya registrado: salen sin marcar.");
        }
        if (preparado.truncado) notas.push(`El archivo tenía demasiadas filas: se muestran las primeras ${preparado.filas.length}.`);
        if (preparado.filas.length === 0) {
          setError("El estado de cuenta solo trae pagos a la tarjeta: no hay consumos para importar.");
          setFase("elegir");
          return;
        }
        setAvisos(notas);
        setFilas(
          preparado.filas.map((f) => ({
            ...f,
            seleccionado: f.seleccionada,
            categoriaId: f.tipo === "gasto" ? categoriaPorNombre.get(f.categoriaSugerida) ?? otrosId : "",
          }))
        );
      } else {
        setAvisos([]);
        setFilas(
          transacciones.map((t, i) => ({
            ...t,
            id: i,
            tipo: "gasto",
            posibleDuplicado: false,
            seleccionado: !t.posiblePago,
            categoriaId: categoriaPorNombre.get(t.categoriaSugerida) ?? otrosId,
          }))
        );
      }
      setFase("revisar");
    } catch (err) {
      setError(mensajeError(err));
      setFase("elegir");
    }
  }

  function actualizarFila(id: number, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  const seleccionadas = filas.filter((f) => f.seleccionado);
  const faltaCategoria = seleccionadas.some((f) => f.tipo === "gasto" && !f.categoriaId);
  const resumen = cuentaFija
    ? resumenImportacion(
        filas.map((f) => ({ ...f, seleccionada: f.seleccionado, categoriaSugerida: "Otros" as const })),
        cuentaFija
      )
    : null;
  // Una tarjeta puede pasarse del cupo (queda sobreendeudada): solo se avisa.
  const pasaElCupo = cuentaFija?.tipo === "credito" && !!resumen && resumen.disponibleDespues < 0;
  // Una cuenta de ahorro, de débito o el efectivo no puede quedar en negativo: la base lo rechazaría.
  const quedaEnNegativo = !!cuentaFija && cuentaFija.tipo !== "credito" && !!resumen && resumen.disponibleDespues < 0;

  async function confirmarImportacion() {
    setError(null);
    setFase("importando");
    try {
      if (cuentaFija) {
        const metodoPago: Gasto["metodoPago"] =
          cuentaFija.tipo === "credito" ? "credito" : cuentaFija.tipo === "debito" ? "debito" : undefined;
        await importarMovimientos({
          gastos: seleccionadas
            .filter((f) => f.tipo === "gasto")
            .map((f) => ({ monto: f.monto, descripcion: f.descripcion, categoriaId: f.categoriaId, cuentaId: cuentaFija.id, metodoPago, fecha: f.fecha })),
          ingresos:
            cuentaFija.tipo === "credito"
              ? []
              : seleccionadas
                  .filter((f) => f.tipo === "ingreso")
                  .map((f) => ({ monto: f.monto, descripcion: f.descripcion, cuentaId: cuentaFija.id, fecha: f.fecha })),
        });
        await onImportado?.();
      } else {
        await onImportar?.(
          seleccionadas.map((f) => ({
            monto: f.monto,
            descripcion: f.descripcion,
            categoriaId: f.categoriaId,
            cuentaId: cuentaId || undefined,
            fecha: f.fecha,
          }))
        );
      }
      onCerrar();
    } catch (err) {
      // Los ingresos ya se guardaron: salen de la tabla y solo se reintentan los gastos.
      if (err instanceof ErrorImportacionParcial) {
        setFilas((prev) => prev.filter((f) => !(f.tipo === "ingreso" && f.seleccionado)));
        await onImportado?.();
      }
      setError(mensajeError(err));
      setFase("revisar");
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cuentaFija ? `Importar estado de cuenta · ${cuentaFija.nombre}` : "Importar estado de cuenta"}</h3>
          <button className="btn-icon" onClick={onCerrar} title="Cerrar" type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {fase === "elegir" && (
            <>
              <p className="subtitulo">
                Sube el PDF, CSV o una foto/captura de tu estado de cuenta y la app va a detectar los consumos
                automáticamente. El archivo se lee en tu computadora y no se sube a ningún servidor. Vas a poder
                revisar y corregir cada fila antes de guardar nada.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf,.csv,text/csv,.txt,text/plain,image/*"
                style={{ display: "none" }}
                onChange={elegirArchivo}
              />
              <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                Elegir archivo
              </button>
              {cuentaFija && (
                <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={onCerrar}>
                  Ahora no
                </button>
              )}
            </>
          )}

          {fase === "leyendo" && <p>Analizando el documento… esto puede tardar unos segundos.</p>}

          {(fase === "revisar" || fase === "importando") && (
            <>
              {cuentaFija && resumen ? (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 6px" }}>
                    {cuentaFija.tipo === "credito" ? "Cupo disponible" : "Saldo"}: {formatMonto(cuentaFija.disponible)} →{" "}
                    <strong>{formatMonto(resumen.disponibleDespues)}</strong>
                  </p>
                  {pasaElCupo && (
                    <p className="error" style={{ margin: "0 0 6px" }}>
                      ⚠ Con lo marcado la tarjeta se pasa del cupo: quedará sobreendeudada (en rojo).
                    </p>
                  )}
                  {quedaEnNegativo && (
                    <p className="error" style={{ margin: "0 0 6px" }}>
                      Con lo marcado la cuenta quedaría en {formatMonto(resumen.disponibleDespues)}, y una cuenta no puede quedar en
                      negativo: desmarca algunos gastos o marca los ingresos que faltan.
                    </p>
                  )}
                  {avisos.map((a) => (
                    <p key={a} className="etiqueta" style={{ margin: "0 0 4px" }}>
                      {a}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="campo" style={{ maxWidth: 260, marginBottom: 14 }}>
                  <label htmlFor="cuenta-import">Cuenta / tarjeta (opcional, aplica a todo)</label>
                  <select
                    id="cuenta-import"
                    className="input"
                    value={cuentaId}
                    onChange={(e) => setCuentaId(e.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      {cuentaFija && <th>Tipo</th>}
                      <th>Categoría</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.id} style={{ opacity: f.seleccionado ? 1 : 0.5 }}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Importar ${f.descripcion}`}
                            checked={f.seleccionado}
                            onChange={(e) => actualizarFila(f.id, { seleccionado: e.target.checked })}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="input"
                            value={f.fecha}
                            onChange={(e) => actualizarFila(f.id, { fecha: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={f.descripcion}
                            onChange={(e) => actualizarFila(f.id, { descripcion: e.target.value })}
                          />
                          {f.posibleDuplicado && (
                            <span className="etiqueta" title="Ya registraste un movimiento con esta fecha y este monto">
                              Posible duplicado
                            </span>
                          )}
                        </td>
                        {cuentaFija && <td>{f.tipo === "ingreso" ? "Ingreso" : "Gasto"}</td>}
                        <td>
                          {f.tipo === "gasto" ? (
                            <select
                              className="input"
                              value={f.categoriaId}
                              onChange={(e) => actualizarFila(f.id, { categoriaId: e.target.value })}
                            >
                              <option value="" disabled>
                                Elegir…
                              </option>
                              {categoriasGasto.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nombre}
                                </option>
                              ))}
                            </select>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            value={f.monto}
                            onChange={(e) => actualizarFila(f.id, { monto: Number(e.target.value) })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && (
            <p className="error" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
        </div>

        {(fase === "revisar" || fase === "importando") && (
          <div className="modal-footer">
            <span className="etiqueta">
              {seleccionadas.length} de {filas.length} seleccionadas
            </span>
            <button className="btn" onClick={onCerrar} disabled={fase === "importando"} type="button">
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmarImportacion}
              disabled={fase === "importando" || seleccionadas.length === 0 || faltaCategoria || quedaEnNegativo}
              type="button"
              title={faltaCategoria ? "Asigna una categoría a cada fila seleccionada" : undefined}
            >
              {fase === "importando"
                ? "Importando…"
                : `Importar ${seleccionadas.length} movimiento${seleccionadas.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
