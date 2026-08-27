import { useRef, useState, type FormEvent } from "react";
import type { Categoria, Cuenta, Gasto } from "core";
import { leerImagen, parseRecibo } from "../lib/ocr";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  mes: string;
  gastos: Gasto[];
  categorias: Categoria[];
  cuentas: Cuenta[];
  onCrear: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}

export default function Gastos({ mes, gastos, categorias, cuentas, onCrear, onEliminar }: Props) {
  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));

  function categoriaDe(id: string) {
    return categorias.find((c) => c.id === id);
  }
  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }

  return (
    <>
      <NuevoGasto categorias={categorias} cuentas={cuentas} onCrear={onCrear} />

      <div className="card" style={{ padding: 0 }}>
        {gastosDelMes.length === 0 ? (
          <p className="vacio">No hay gastos registrados este mes.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastosDelMes.map((g) => {
                const cat = categoriaDe(g.categoriaId);
                const cuenta = cuentaDe(g.cuentaId);
                return (
                  <tr key={g.id}>
                    <td>{g.fecha}</td>
                    <td>{g.descripcion}</td>
                    <td>
                      <span className="categoria-tag">
                        <span className="categoria-punto" style={{ background: cat?.color ?? "#aaa" }} />
                        {cat?.nombre ?? "Sin categoría"}
                      </span>
                    </td>
                    <td>{cuenta?.nombre ?? "—"}</td>
                    <td>${g.monto.toFixed(2)}</td>
                    <td>
                      <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(g.id)}>
                        ✕
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

function NuevoGasto({
  categorias,
  cuentas,
  onCrear,
}: {
  categorias: Categoria[];
  cuentas: Cuenta[];
  onCrear: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [leyendoRecibo, setLeyendoRecibo] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        monto: Number(monto),
        descripcion,
        categoriaId,
        cuentaId: cuentaId || undefined,
        fecha,
      });
      setMonto("");
      setDescripcion("");
      setFecha(hoy());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  async function escanearRecibo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setError(null);
    setLeyendoRecibo(true);
    try {
      const texto = await leerImagen(archivo);
      const recibo = parseRecibo(texto);
      if (recibo.monto) setMonto(String(recibo.monto));
      if (recibo.fecha) setFecha(recibo.fecha);
      if (recibo.comercio) setDescripcion(recibo.comercio);
      if (recibo.categoriaSugerida) {
        const categoria = categorias.find((c) => c.nombre === recibo.categoriaSugerida);
        if (categoria) setCategoriaId(categoria.id);
      }
      if (!recibo.monto && !recibo.fecha && !recibo.comercio) {
        setError("No se pudo leer el recibo con claridad. Completa los datos a mano.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLeyendoRecibo(false);
    }
  }

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <div className="form-gasto-header">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Nuevo gasto</h3>
        <input
          ref={inputArchivoRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={escanearRecibo}
        />
        <button
          type="button"
          className="btn"
          onClick={() => inputArchivoRef.current?.click()}
          disabled={leyendoRecibo}
        >
          {leyendoRecibo ? "Leyendo recibo…" : "📷 Escanear recibo"}
        </button>
      </div>

      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="monto">Monto</label>
          <input
            id="monto"
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
          <label htmlFor="descripcion">Descripción</label>
          <input
            id="descripcion"
            className="input"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="categoria">Categoría</label>
          <select
            id="categoria"
            className="input"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            required
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
        </div>
        <div className="campo">
          <label htmlFor="cuenta">Cuenta / tarjeta</label>
          <select id="cuenta" className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Sin asignar</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="fecha">Fecha</label>
          <input
            id="fecha"
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
