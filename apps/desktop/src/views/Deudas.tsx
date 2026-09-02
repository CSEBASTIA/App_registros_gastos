import { useState, type FormEvent } from "react";
import type { Cuenta, Deuda, Endeudamiento, TipoDeuda } from "core";
import BarraProgreso from "../components/BarraProgreso";
import { IconoDeudas, IconoPapelera } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";
import { mensajeError } from "core";

interface Props {
  deudas: Deuda[];
  cuentas: Cuenta[];
  endeudamiento: Endeudamiento;
  onCrear: (input: Omit<Deuda, "id" | "createdAt">) => Promise<void>;
  onAbonar: (id: string, monto: number) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Deudas({ deudas, cuentas, endeudamiento, onCrear, onAbonar, onEliminar }: Props) {
  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }
  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="resumen">
          <div>
            <span className="etiqueta">Saldo pendiente total</span>
            <div className="valor">${endeudamiento.totalPendiente.toFixed(2)}</div>
          </div>
          <div>
            <span className="etiqueta">Cuotas mensuales</span>
            <div className="valor">${endeudamiento.cuotasMensuales.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="tarjeta-visual-cupo-linea">
            <span>Nivel de endeudamiento</span>
            <span className={`nivel-${endeudamiento.nivel}`}>
              {endeudamiento.porcentaje.toFixed(0)}% · {etiquetaNivel(endeudamiento.nivel)}
            </span>
          </div>
          <BarraProgreso porcentaje={endeudamiento.porcentaje} />
        </div>
      </div>

      <NuevaDeuda cuentas={cuentas} onCrear={onCrear} />

      {deudas.length === 0 ? (
        <EstadoVacio
          icono={<IconoDeudas />}
          titulo="No tienes deudas ni préstamos registrados"
          subtitulo="Cuando agregues una, vas a ver acá tu nivel de endeudamiento."
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Cuenta</th>
                <th>Saldo pendiente</th>
                <th>Cuota mensual</th>
                <th>Próximo pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deudas.map((d) => (
                <FilaDeuda
                  key={d.id}
                  deuda={d}
                  nombreCuenta={cuentaDe(d.cuentaId)?.nombre}
                  onAbonar={onAbonar}
                  onEliminar={onEliminar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function etiquetaNivel(nivel: Endeudamiento["nivel"]) {
  return nivel === "alto" ? "Alto" : nivel === "moderado" ? "Moderado" : "Bajo";
}

function FilaDeuda({
  deuda,
  nombreCuenta,
  onAbonar,
  onEliminar,
}: {
  deuda: Deuda;
  nombreCuenta?: string;
  onAbonar: (id: string, monto: number) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}) {
  const [abonando, setAbonando] = useState(false);
  const [monto, setMonto] = useState("");

  async function confirmar() {
    if (!monto) return;
    await onAbonar(deuda.id, Number(monto));
    setMonto("");
    setAbonando(false);
  }

  return (
    <tr>
      <td>
        {deuda.nombre}
        {deuda.gastoId && <span className="etiqueta-diferido">Generada automáticamente</span>}
      </td>
      <td>{etiquetaTipo(deuda.tipo)}</td>
      <td>{nombreCuenta ?? "—"}</td>
      <td>${deuda.saldoPendiente.toFixed(2)}</td>
      <td>${deuda.cuotaMensual.toFixed(2)}</td>
      <td>{deuda.proximoPago ?? "—"}</td>
      <td>
        <div className="pago-tarjeta-inline">
          {abonando ? (
            <>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Monto"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <button className="btn btn-primary" onClick={confirmar}>
                Abonar
              </button>
              <button className="btn" onClick={() => setAbonando(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setAbonando(true)} disabled={deuda.saldoPendiente <= 0}>
              Registrar abono
            </button>
          )}
          <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(deuda.id)}>
            <IconoPapelera />
          </button>
        </div>
      </td>
    </tr>
  );
}

function etiquetaTipo(tipo: TipoDeuda) {
  switch (tipo) {
    case "prestamo":
      return "Préstamo";
    case "tarjeta":
      return "Tarjeta";
    case "diferido":
      return "Diferido";
    default:
      return "Otro";
  }
}

function NuevaDeuda({
  cuentas,
  onCrear,
}: {
  cuentas: Cuenta[];
  onCrear: (input: Omit<Deuda, "id" | "createdAt">) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoDeuda>("prestamo");
  const [montoTotal, setMontoTotal] = useState("");
  const [cuotaMensual, setCuotaMensual] = useState("");
  const [proximoPago, setProximoPago] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await onCrear({
        nombre,
        tipo,
        montoTotal: Number(montoTotal),
        saldoPendiente: Number(montoTotal),
        cuotaMensual: Number(cuotaMensual),
        fechaInicio: hoy(),
        proximoPago: proximoPago || undefined,
        cuentaId: cuentaId || undefined,
      });
      setNombre("");
      setMontoTotal("");
      setCuotaMensual("");
      setProximoPago("");
      setCuentaId("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Nueva deuda / préstamo</h3>
      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="nombre-deuda">Nombre</label>
          <input
            id="nombre-deuda"
            className="input"
            placeholder="Préstamo carro"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="tipo-deuda">Tipo</label>
          <select id="tipo-deuda" className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeuda)}>
            <option value="prestamo">Préstamo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="monto-total-deuda">Monto total</label>
          <input
            id="monto-total-deuda"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={montoTotal}
            onChange={(e) => setMontoTotal(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="cuota-deuda">Cuota mensual</label>
          <input
            id="cuota-deuda"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={cuotaMensual}
            onChange={(e) => setCuotaMensual(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="proximo-pago-deuda">Próximo pago</label>
          <input
            id="proximo-pago-deuda"
            className="input"
            type="date"
            value={proximoPago}
            onChange={(e) => setProximoPago(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="cuenta-deuda">Cuenta asociada</label>
          <select
            id="cuenta-deuda"
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
