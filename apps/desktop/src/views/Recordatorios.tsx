import { useState, type FormEvent } from "react";
import type { Deuda, Frecuencia, Recordatorio, TipoRecordatorio } from "core";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  recordatorios: Recordatorio[];
  deudas: Deuda[];
  onCrear: (input: Omit<Recordatorio, "id" | "createdAt" | "completado">) => Promise<void>;
  onToggle: (id: string, completado: boolean) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}

export default function Recordatorios({ recordatorios, deudas, onCrear, onToggle, onEliminar }: Props) {
  const ordenados = [...recordatorios].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const hoyStr = hoy();

  return (
    <>
      <NuevoRecordatorio deudas={deudas} onCrear={onCrear} />

      {ordenados.length === 0 ? (
        <p className="vacio">No tienes recordatorios.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="tabla">
            <thead>
              <tr>
                <th></th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((r) => {
                const vencido = !r.completado && r.fecha < hoyStr;
                return (
                  <tr key={r.id} style={{ opacity: r.completado ? 0.5 : 1 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.completado}
                        onChange={(e) => onToggle(r.id, e.target.checked)}
                      />
                    </td>
                    <td>{r.titulo}</td>
                    <td>{etiquetaTipo(r.tipo)}</td>
                    <td>{r.monto ? `$${r.monto.toFixed(2)}` : "—"}</td>
                    <td style={vencido ? { color: "var(--color-danger)", fontWeight: 600 } : undefined}>
                      {r.fecha} {vencido && "· vencido"}
                    </td>
                    <td>
                      <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(r.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function etiquetaTipo(tipo: TipoRecordatorio) {
  switch (tipo) {
    case "pago":
      return "Pago";
    case "prestamo":
      return "Préstamo";
    case "tarjeta":
      return "Tarjeta";
    default:
      return "Otro";
  }
}

function NuevoRecordatorio({
  deudas,
  onCrear,
}: {
  deudas: Deuda[];
  onCrear: (input: Omit<Recordatorio, "id" | "createdAt" | "completado">) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoRecordatorio>("pago");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [recurrente, setRecurrente] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("mensual");
  const [deudaId, setDeudaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        titulo,
        tipo,
        monto: monto ? Number(monto) : undefined,
        fecha,
        recurrente,
        frecuencia: recurrente ? frecuencia : undefined,
        deudaId: deudaId || undefined,
      });
      setTitulo("");
      setMonto("");
      setFecha(hoy());
      setDeudaId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Nuevo recordatorio</h3>
      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="titulo-recordatorio">Título</label>
          <input
            id="titulo-recordatorio"
            className="input"
            placeholder="Pago tarjeta Amex"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="tipo-recordatorio">Tipo</label>
          <select
            id="tipo-recordatorio"
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoRecordatorio)}
          >
            <option value="pago">Pago</option>
            <option value="prestamo">Préstamo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="monto-recordatorio">Monto (opcional)</label>
          <input
            id="monto-recordatorio"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="fecha-recordatorio">Fecha</label>
          <input
            id="fecha-recordatorio"
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        {deudas.length > 0 && (
          <div className="campo">
            <label htmlFor="deuda-recordatorio">Deuda relacionada</label>
            <select
              id="deuda-recordatorio"
              className="input"
              value={deudaId}
              onChange={(e) => setDeudaId(e.target.value)}
            >
              <option value="">Ninguna</option>
              {deudas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="campo">
          <label htmlFor="recurrente-recordatorio">Recurrente</label>
          <select
            id="recurrente-recordatorio"
            className="input"
            value={recurrente ? frecuencia : "no"}
            onChange={(e) => {
              if (e.target.value === "no") {
                setRecurrente(false);
              } else {
                setRecurrente(true);
                setFrecuencia(e.target.value as Frecuencia);
              }
            }}
          >
            <option value="no">No</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
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
