import { useState, type FormEvent } from "react";
import type { Categoria, Cuenta, Ingreso } from "core";
import { IconoIngresos, IconoMas, IconoPapelera } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";
import GraficoBarras from "../components/GraficoBarras";
import { semanasDelMes, enRangoSemana, ultimosMeses, etiquetaMes } from "core";
import { mensajeError } from "core";

const COLOR_INGRESOS = "#16a34a";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  mes: string;
  ingresos: Ingreso[];
  cuentas: Cuenta[];
  categorias: Categoria[];
  onCrear: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}

export default function Ingresos({ mes, ingresos, cuentas, categorias, onCrear, onEliminar }: Props) {
  const ingresosDelMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const categoriasIngreso = categorias.filter((c) => c.tipo === "ingreso");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");

  const datosSemana = semanasDelMes(mes).map((s) => ({
    etiqueta: `Semana ${s.numero}`,
    valor: ingresosDelMes.filter((i) => enRangoSemana(i.fecha, s)).reduce((acc, i) => acc + i.monto, 0),
    color: COLOR_INGRESOS,
  }));

  const datosMes = ultimosMeses(mes, 6).map((m) => ({
    etiqueta: etiquetaMes(m),
    valor: ingresos.filter((i) => i.fecha.startsWith(m)).reduce((acc, i) => acc + i.monto, 0),
    color: COLOR_INGRESOS,
  }));

  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }
  function categoriaDe(id?: string) {
    return id ? categorias.find((c) => c.id === id) : undefined;
  }

  async function crearYCerrar(input: Omit<Ingreso, "id" | "createdAt">) {
    await onCrear(input);
    setMostrarForm(false);
  }

  return (
    <>
      {mostrarForm ? (
        <NuevoIngreso cuentas={cuentas} categorias={categoriasIngreso} onCrear={crearYCerrar} onCancelar={() => setMostrarForm(false)} />
      ) : (
        <button className="btn btn-primary" style={{ marginBottom: 24 }} onClick={() => setMostrarForm(true)}>
          <IconoMas /> Nuevo ingreso
        </button>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-gasto-header">
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Ingresos</h3>
          <div className="periodo-toggle">
            <button
              type="button"
              className={periodo === "semana" ? "periodo-toggle-activo" : ""}
              onClick={() => setPeriodo("semana")}
            >
              Por semana
            </button>
            <button
              type="button"
              className={periodo === "mes" ? "periodo-toggle-activo" : ""}
              onClick={() => setPeriodo("mes")}
            >
              Por mes
            </button>
          </div>
        </div>
        <GraficoBarras
          datos={periodo === "semana" ? datosSemana : datosMes}
          leyenda={{ etiqueta: "Ingresos", color: COLOR_INGRESOS }}
          mensajeVacio="Sin ingresos en este período."
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {ingresosDelMes.length === 0 ? (
          <EstadoVacio
            icono={<IconoIngresos />}
            titulo="Todavía no hay ingresos este mes"
            subtitulo="Registra tu sueldo, freelance u otra entrada de dinero."
          />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Fuente</th>
                <th>Cuenta</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ingresosDelMes.map((i) => {
                const cat = categoriaDe(i.categoriaId);
                return (
                  <tr key={i.id}>
                    <td>{i.fecha}</td>
                    <td>{i.descripcion}</td>
                    <td>
                      {cat ? (
                        <span className="categoria-tag">
                          <span className="categoria-punto" style={{ background: cat.color }} />
                          {cat.nombre}
                          {cat.nombre === "Otros" && i.categoriaDetalle ? ` · ${i.categoriaDetalle}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{cuentaDe(i.cuentaId)?.nombre ?? "—"}</td>
                    <td>${i.monto.toFixed(2)}</td>
                    <td>
                      <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(i.id)}>
                        <IconoPapelera />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function NuevoIngreso({
  cuentas,
  categorias,
  onCrear,
  onCancelar,
}: {
  cuentas: Cuenta[];
  categorias: Categoria[];
  onCrear: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!monto || Number(monto) <= 0) {
      setError("El monto no puede ser un valor negativo.");
      return;
    }

    setGuardando(true);
    try {
      await onCrear({
        monto: Number(monto),
        descripcion,
        categoriaId: categoriaId || undefined,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        fecha,
      });
      setMonto("");
      setDescripcion("");
      setCategoriaDetalle("");
      setFecha(hoy());
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <div className="form-gasto-header">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Nuevo ingreso</h3>
        <button type="button" className="btn" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="monto-ingreso">Monto</label>
          <input
            id="monto-ingreso"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="descripcion-ingreso">Descripción</label>
          <input
            id="descripcion-ingreso"
            className="input"
            placeholder="Sueldo, freelance…"
            maxLength={40}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="categoria-ingreso">Fuente</label>
          <select
            id="categoria-ingreso"
            className="input"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            <option value="">Sin especificar</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {esOtros && (
          <div className="campo">
            <label htmlFor="categoria-detalle-ingreso">Detalle</label>
            <input
              id="categoria-detalle-ingreso"
              className="input"
              placeholder="¿De dónde viene?"
              value={categoriaDetalle}
              onChange={(e) => setCategoriaDetalle(e.target.value)}
              required
            />
          </div>
        )}
        <div className="campo">
          <label htmlFor="cuenta-ingreso">Cuenta destino</label>
          <select
            id="cuenta-ingreso"
            className="input"
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {cuentas
              .filter((c) => c.tipo !== "credito")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="fecha-ingreso">Fecha</label>
          <input
            id="fecha-ingreso"
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando…" : "Agregar"}
        </button>
      </div>
      {error && (
        <p className="error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </form>
  );
}
