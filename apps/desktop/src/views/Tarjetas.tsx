import { useState, type FormEvent } from "react";
import type { Banco, Cuenta, Marca, TipoCuenta } from "core";
import TarjetaVisual from "../components/TarjetaVisual";
import { ETIQUETA_BANCO, ETIQUETA_MARCA, OPCIONES_BANCO, OPCIONES_MARCA } from "../lib/marcas";

interface Props {
  cuentas: Cuenta[];
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number) => Promise<void>;
}

export default function Tarjetas({ cuentas, onCrear, onEliminar, onRegistrarPago }: Props) {
  return (
    <>
      <NuevaCuenta onCrear={onCrear} />

      {cuentas.length === 0 ? (
        <p className="vacio">Todavía no agregaste ninguna cuenta o tarjeta.</p>
      ) : (
        <div className="grid-tarjetas">
          {cuentas.map((cuenta) => (
            <div key={cuenta.id} className="tarjeta-visual-wrap">
              <TarjetaVisual cuenta={cuenta} />
              <div className="tarjeta-visual-acciones">
                {cuenta.tipo === "credito" && (
                  <PagarTarjeta cuenta={cuenta} onRegistrarPago={onRegistrarPago} />
                )}
                <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(cuenta.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function PagarTarjeta({
  cuenta,
  onRegistrarPago,
}: {
  cuenta: Cuenta;
  onRegistrarPago: (cuentaId: string, monto: number) => Promise<void>;
}) {
  const [monto, setMonto] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (!abriendo) {
    return (
      <button className="btn" onClick={() => setAbriendo(true)}>
        Registrar pago
      </button>
    );
  }

  async function confirmar() {
    if (!monto) return;
    setGuardando(true);
    try {
      await onRegistrarPago(cuenta.id, Number(monto));
      setMonto("");
      setAbriendo(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pago-tarjeta-inline">
      <input
        className="input"
        type="number"
        step="0.01"
        min="0"
        placeholder="Monto"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />
      <button className="btn btn-primary" onClick={confirmar} disabled={guardando}>
        {guardando ? "…" : "Pagar"}
      </button>
      <button className="btn" onClick={() => setAbriendo(false)}>
        Cancelar
      </button>
    </div>
  );
}

function NuevaCuenta({ onCrear }: { onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void> }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("credito");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [marca, setMarca] = useState<Marca>("amex");
  const [cupoTotal, setCupoTotal] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esCredito = tipo === "credito";

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const cupo = esCredito ? Number(cupoTotal) : undefined;
      await onCrear({
        nombre,
        tipo,
        banco,
        marca: esCredito ? marca : undefined,
        cupoTotal: cupo,
        disponible: esCredito ? cupo ?? 0 : Number(saldoInicial || 0),
      });
      setNombre("");
      setCupoTotal("");
      setSaldoInicial("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Nueva cuenta / tarjeta</h3>
      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="nombre-cuenta">Nombre</label>
          <input
            id="nombre-cuenta"
            className="input"
            placeholder="Amex Banco Guayaquil"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="tipo-cuenta">Tipo</label>
          <select
            id="tipo-cuenta"
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuenta)}
          >
            <option value="credito">Tarjeta de crédito</option>
            <option value="debito">Tarjeta de débito</option>
            <option value="ahorro">Cuenta de ahorros</option>
            <option value="efectivo">Efectivo</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="banco-cuenta">Banco</label>
          <select
            id="banco-cuenta"
            className="input"
            value={banco}
            onChange={(e) => setBanco(e.target.value as Banco)}
          >
            {OPCIONES_BANCO.map((b) => (
              <option key={b} value={b}>
                {ETIQUETA_BANCO[b]}
              </option>
            ))}
          </select>
        </div>
        {esCredito && (
          <>
            <div className="campo">
              <label htmlFor="marca-cuenta">Marca</label>
              <select
                id="marca-cuenta"
                className="input"
                value={marca}
                onChange={(e) => setMarca(e.target.value as Marca)}
              >
                {OPCIONES_MARCA.map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_MARCA[m] || "Otra"}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cupo-cuenta">Cupo total</label>
              <input
                id="cupo-cuenta"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={cupoTotal}
                onChange={(e) => setCupoTotal(e.target.value)}
                required
              />
            </div>
          </>
        )}
        {!esCredito && (
          <div className="campo">
            <label htmlFor="saldo-cuenta">Saldo inicial</label>
            <input
              id="saldo-cuenta"
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
            />
          </div>
        )}
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
