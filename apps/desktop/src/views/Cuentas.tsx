import { useEffect, useState, type FormEvent } from "react";
import type { Banco, Categoria, Cuenta, Gasto, Ingreso, TipoCuenta } from "core";
import TarjetaVisual from "../components/TarjetaVisual";
import ItemMovimiento from "../components/ItemMovimiento";
import { RegistrarGastoInline, RegistrarSueldoInline } from "../components/AccionesCuentaRapidas";
import { agruparPorFecha, movimientosDe, type MovimientoCuenta } from "core";
import { COLOR_CUENTA_BANCO, OPCIONES_BANCO } from "core";
import SwatchBanco from "../components/SwatchBanco";
import { IconoGastos, IconoMas, IconoWallet } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";
import { mensajeError } from "core";
import { formatMonto } from "core";

interface Props {
  cuentas: Cuenta[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCrearIngreso: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
}

export default function Cuentas({
  cuentas,
  gastos,
  ingresos,
  categorias,
  onCrear,
  onEliminar,
  onCrearGasto,
  onCrearIngreso,
}: Props) {
  const cuentasBancarias = cuentas.filter((c) => c.tipo !== "credito");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => {
    if (!cuentasBancarias.some((c) => c.id === seleccionadaId)) {
      setSeleccionadaId(cuentasBancarias[0]?.id ?? null);
    }
  }, [cuentasBancarias, seleccionadaId]);

  const cuentaSeleccionada = cuentasBancarias.find((c) => c.id === seleccionadaId);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">) {
    await onCrear(input);
    setMostrarForm(false);
  }

  return (
    <>
      {mostrarForm ? (
        <NuevaCuentaBancaria onCrear={crearYCerrar} onCancelar={() => setMostrarForm(false)} />
      ) : (
        <button className="btn btn-primary" style={{ marginBottom: 24 }} onClick={() => setMostrarForm(true)}>
          <IconoMas /> Agregar cuenta
        </button>
      )}

      {cuentasBancarias.length === 0 ? (
        <EstadoVacio
          icono={<IconoWallet />}
          titulo="Todavía no agregaste cuentas"
          subtitulo="Crea una arriba: ahorro, débito o efectivo, del banco que sea."
        />
      ) : (
        <>
          <div className="galeria-estilos" style={{ marginBottom: 24 }}>
            {cuentasBancarias.map((cuenta) => (
              <TarjetaVisual
                key={cuenta.id}
                cuenta={cuenta}
                compacta
                seleccionada={cuenta.id === cuentaSeleccionada?.id}
                onClick={() => setSeleccionadaId(cuenta.id)}
              />
            ))}
          </div>

          {cuentaSeleccionada && (
            <DetalleCuenta
              cuenta={cuentaSeleccionada}
              gastos={gastos}
              ingresos={ingresos}
              categorias={categorias}
              onEliminar={onEliminar}
              onCrearGasto={onCrearGasto}
              onCrearIngreso={onCrearIngreso}
            />
          )}
        </>
      )}
    </>
  );
}

function DetalleCuenta({
  cuenta,
  gastos,
  ingresos,
  categorias,
  onEliminar,
  onCrearGasto,
  onCrearIngreso,
}: {
  cuenta: Cuenta;
  gastos: Gasto[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  onEliminar: (id: string) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCrearIngreso: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
}) {
  const [verEstadoCuenta, setVerEstadoCuenta] = useState(false);
  const movimientos = movimientosDe(cuenta.id, gastos, [], ingresos, categorias);
  const recientes = movimientos.slice(0, 5);
  const categoriasGasto = categorias.filter((c) => c.tipo === "gasto");

  return (
    <>
      <div className="card tarjeta-detalle">
        <div>
          <TarjetaVisual cuenta={cuenta} onClick={() => setVerEstadoCuenta(true)} />

          <div className="tarjeta-visual-acciones" style={{ marginTop: 14 }}>
            <div className="tarjeta-detalle-acciones-rapidas">
              <RegistrarSueldoInline cuenta={cuenta} onCrear={onCrearIngreso} />
              <RegistrarGastoInline cuenta={cuenta} categorias={categoriasGasto} onCrear={onCrearGasto} />
            </div>
            <button className="btn" onClick={() => onEliminar(cuenta.id)}>
              Eliminar cuenta
            </button>
          </div>
        </div>

        <div>
          <div className="form-gasto-header">
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Movimientos de la cuenta</h3>
            {movimientos.length > 0 && (
              <button type="button" className="btn" onClick={() => setVerEstadoCuenta(true)}>
                Ver todo
              </button>
            )}
          </div>
          {recientes.length === 0 ? (
            <EstadoVacio
              icono={<IconoGastos />}
              titulo="Todavía no hay movimientos"
              subtitulo="Usa los botones de arriba para registrar un gasto o un sueldo en esta cuenta: el saldo se ajusta solo."
            />
          ) : (
            <ul className="actividad-lista">
              {recientes.map((item) => (
                <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {verEstadoCuenta && (
        <EstadoCuentaModal
          cuenta={cuenta}
          movimientos={movimientos}
          categoriasGasto={categoriasGasto}
          onEliminar={onEliminar}
          onCrearGasto={onCrearGasto}
          onCrearIngreso={onCrearIngreso}
          onCerrar={() => setVerEstadoCuenta(false)}
        />
      )}
    </>
  );
}

function EstadoCuentaModal({
  cuenta,
  movimientos,
  categoriasGasto,
  onEliminar,
  onCrearGasto,
  onCrearIngreso,
  onCerrar,
}: {
  cuenta: Cuenta;
  movimientos: MovimientoCuenta[];
  categoriasGasto: Categoria[];
  onEliminar: (id: string) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCrearIngreso: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
  onCerrar: () => void;
}) {
  const grupos = agruparPorFecha(movimientos);

  async function eliminarYCerrar() {
    await onEliminar(cuenta.id);
    onCerrar();
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cuenta.nombre}</h3>
          <button className="btn-icon" onClick={onCerrar} title="Cerrar" type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="estado-cuenta-encabezado">
            <TarjetaVisual cuenta={cuenta} />

            <div className="estado-cuenta-resumen">
              <span className="estado-cuenta-badge">
                {formatMonto(cuenta.disponible)}
                <small>Saldo disponible</small>
              </span>

              <div className="tarjeta-visual-acciones" style={{ marginTop: 16 }}>
                <div className="tarjeta-detalle-acciones-rapidas">
                  <RegistrarSueldoInline cuenta={cuenta} onCrear={onCrearIngreso} />
                  <RegistrarGastoInline cuenta={cuenta} categorias={categoriasGasto} onCrear={onCrearGasto} />
                </div>
                <button className="btn" onClick={eliminarYCerrar}>
                  Eliminar cuenta
                </button>
              </div>
            </div>
          </div>

          <h4 style={{ margin: "24px 0 8px" }}>Movimientos</h4>
          {grupos.length === 0 ? (
            <EstadoVacio
              icono={<IconoGastos />}
              titulo="Todavía no hay movimientos"
              subtitulo="Usa los botones de arriba para registrar un gasto o un sueldo en esta cuenta: el saldo se ajusta solo."
            />
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.fecha} className="estado-cuenta-grupo">
                <span className="estado-cuenta-grupo-fecha">{grupo.etiqueta}</span>
                <ul className="actividad-lista">
                  {grupo.items.map((item) => (
                    <ItemMovimiento key={`${item.tipo}-${item.id}`} item={item} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NuevaCuentaBancaria({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("ahorro");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await onCrear({ nombre, tipo, banco, disponible: Number(saldoInicial || 0) });
      setNombre("");
      setSaldoInicial("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const vistaPrevia: Cuenta = {
    id: "vista-previa",
    nombre: nombre || "Mi cuenta",
    tipo,
    banco,
    disponible: Number(saldoInicial || 0),
    createdAt: "",
  };

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <div className="form-gasto-header">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Nueva cuenta</h3>
        <button type="button" className="btn" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="nombre-cuenta-bancaria">Nombre</label>
          <input
            id="nombre-cuenta-bancaria"
            className="input"
            placeholder="Ahorros Pichincha"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="tipo-cuenta-bancaria">Tipo</label>
          <select
            id="tipo-cuenta-bancaria"
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuenta)}
          >
            <option value="ahorro">Cuenta de ahorros</option>
            <option value="debito">Tarjeta de débito</option>
            <option value="efectivo">Efectivo</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="saldo-cuenta-bancaria">Saldo inicial</label>
          <input
            id="saldo-cuenta-bancaria"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={saldoInicial}
            onChange={(e) => setSaldoInicial(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando…" : "Agregar"}
        </button>
      </div>

      <div className="campo" style={{ marginTop: 16 }}>
        <label>Banco</label>
        <div className="galeria-estilos">
          {OPCIONES_BANCO.map((b) => (
            <SwatchBanco
              key={b}
              banco={b}
              colorFondo={COLOR_CUENTA_BANCO[b]}
              seleccionado={banco === b}
              onClick={() => setBanco(b)}
            />
          ))}
        </div>
      </div>

      <div className="campo" style={{ marginTop: 8 }}>
        <label>Vista previa</label>
        <div className="tarjeta-vista-previa">
          <TarjetaVisual cuenta={vistaPrevia} />
        </div>
      </div>

      {error && (
        <p className="error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </form>
  );
}
