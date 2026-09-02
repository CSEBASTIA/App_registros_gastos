import { useState } from "react";
import type { Categoria, Cuenta, Gasto, Ingreso } from "core";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export function PagarTarjeta({
  cuenta,
  cuentasOrigen,
  onRegistrarPago,
}: {
  cuenta: Cuenta;
  cuentasOrigen: Cuenta[];
  onRegistrarPago: (cuentaId: string, monto: number, cuentaOrigenId?: string) => Promise<void>;
}) {
  const [monto, setMonto] = useState("");
  const [cuentaOrigenId, setCuentaOrigenId] = useState("");
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
      await onRegistrarPago(cuenta.id, Number(monto), cuentaOrigenId || undefined);
      setMonto("");
      setCuentaOrigenId("");
      setAbriendo(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pago-tarjeta-inline">
      <select
        className="input"
        value={cuentaOrigenId}
        onChange={(e) => setCuentaOrigenId(e.target.value)}
        title="Cuenta desde la que pagás"
      >
        <option value="">Pagar desde…</option>
        {cuentasOrigen.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
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

export function RegistrarSueldoInline({
  cuenta,
  onCrear,
}: {
  cuenta: Cuenta;
  onCrear: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
}) {
  const [monto, setMonto] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (!abriendo) {
    return (
      <button className="btn" onClick={() => setAbriendo(true)}>
        Registrar sueldo
      </button>
    );
  }

  async function confirmar() {
    if (!monto) return;
    setGuardando(true);
    try {
      await onCrear({ monto: Number(monto), descripcion: "Sueldo", cuentaId: cuenta.id, fecha: hoy() });
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
        {guardando ? "…" : "Guardar"}
      </button>
      <button className="btn" onClick={() => setAbriendo(false)}>
        Cancelar
      </button>
    </div>
  );
}

export function RegistrarGastoInline({
  cuenta,
  categorias,
  onCrear,
}: {
  cuenta: Cuenta;
  categorias: Categoria[];
  onCrear: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [abriendo, setAbriendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (!abriendo) {
    return (
      <button className="btn" onClick={() => setAbriendo(true)}>
        Registrar gasto
      </button>
    );
  }

  async function confirmar() {
    if (!monto || !categoriaId) return;
    setGuardando(true);
    try {
      await onCrear({
        monto: Number(monto),
        descripcion: descripcion || "Gasto",
        categoriaId,
        cuentaId: cuenta.id,
        fecha: hoy(),
      });
      setMonto("");
      setDescripcion("");
      setAbriendo(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pago-tarjeta-inline">
      <input
        className="input"
        placeholder="Descripción"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        style={{ flex: "1 1 120px" }}
      />
      <select
        className="input"
        value={categoriaId}
        onChange={(e) => setCategoriaId(e.target.value)}
        style={{ flex: "1 1 120px" }}
      >
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <input
        className="input"
        type="number"
        step="0.01"
        min="0"
        placeholder="Monto"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />
      <button className="btn btn-primary" onClick={confirmar} disabled={guardando || !categoriaId}>
        {guardando ? "…" : "Guardar"}
      </button>
      <button className="btn" onClick={() => setAbriendo(false)}>
        Cancelar
      </button>
    </div>
  );
}
