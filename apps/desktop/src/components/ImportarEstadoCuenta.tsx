import { useRef, useState, type ChangeEvent } from "react";
import type { Categoria, Cuenta, Gasto } from "core";
import { leerEstadoCuenta, parseEstadoCuenta, type TransaccionExtraida } from "../lib/estadoCuenta";
import { mensajeError } from "core";

interface Fila extends TransaccionExtraida {
  id: number;
  seleccionado: boolean;
  categoriaId: string;
}

interface Props {
  categorias: Categoria[];
  cuentas: Cuenta[];
  onImportar: (gastos: Omit<Gasto, "id" | "createdAt">[]) => Promise<void>;
  onCerrar: () => void;
}

/**
 * Modal para subir un estado de cuenta (PDF o foto/captura) y convertir las
 * transacciones detectadas en gastos. Nada se guarda hasta que el usuario
 * revisa la tabla y confirma — el parseo es una heurística, no un OCR perfecto.
 */
export default function ImportarEstadoCuenta({ categorias, cuentas, onImportar, onCerrar }: Props) {
  const [fase, setFase] = useState<"elegir" | "leyendo" | "revisar" | "importando">("elegir");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          "No se reconocieron transacciones en el documento. Si es un PDF escaneado (sin texto seleccionable), prueba subiendo una foto o captura de pantalla en su lugar."
        );
        setFase("elegir");
        return;
      }

      const categoriaPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));
      setFilas(
        transacciones.map((t, i) => ({
          ...t,
          id: i,
          seleccionado: !t.posiblePago,
          categoriaId: (t.categoriaSugerida && categoriaPorNombre.get(t.categoriaSugerida)) || "",
        }))
      );
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
  const faltaCategoria = seleccionadas.some((f) => !f.categoriaId);

  async function confirmarImportacion() {
    setError(null);
    setFase("importando");
    try {
      await onImportar(
        seleccionadas.map((f) => ({
          monto: f.monto,
          descripcion: f.descripcion,
          categoriaId: f.categoriaId,
          cuentaId: cuentaId || undefined,
          fecha: f.fecha,
        }))
      );
      onCerrar();
    } catch (err) {
      setError(mensajeError(err));
      setFase("revisar");
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Importar estado de cuenta</h3>
          <button className="btn-icon" onClick={onCerrar} title="Cerrar" type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {fase === "elegir" && (
            <>
              <p className="subtitulo">
                Sube el PDF o una foto/captura de tu estado de cuenta y la app va a detectar los consumos
                automáticamente. Vas a poder revisar y corregir cada fila antes de guardar nada.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf,image/*"
                style={{ display: "none" }}
                onChange={elegirArchivo}
              />
              <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                Elegir archivo
              </button>
            </>
          )}

          {fase === "leyendo" && <p>Analizando el documento… esto puede tardar unos segundos.</p>}

          {(fase === "revisar" || fase === "importando") && (
            <>
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

              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Fecha</th>
                      <th>Descripción</th>
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
                        </td>
                        <td>
                          <select
                            className="input"
                            value={f.categoriaId}
                            onChange={(e) => actualizarFila(f.id, { categoriaId: e.target.value })}
                          >
                            <option value="" disabled>
                              Elegir…
                            </option>
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
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
              disabled={fase === "importando" || seleccionadas.length === 0 || faltaCategoria}
              type="button"
              title={faltaCategoria ? "Asigna una categoría a cada fila seleccionada" : undefined}
            >
              {fase === "importando"
                ? "Importando…"
                : `Importar ${seleccionadas.length} gasto${seleccionadas.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
