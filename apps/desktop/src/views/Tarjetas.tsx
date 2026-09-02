import { useEffect, useState, type FormEvent } from "react";
import type { Banco, Categoria, Cuenta, Gasto, Ingreso, Marca, PagoTarjeta } from "core";
import TarjetaVisual from "../components/TarjetaVisual";
import BarraProgreso from "../components/BarraProgreso";
import ItemMovimiento from "../components/ItemMovimiento";
import { PagarTarjeta, RegistrarGastoInline } from "../components/AccionesCuentaRapidas";
import { agruparPorFecha, movimientosDe, type MovimientoCuenta } from "core";
import { cssGradiente, ETIQUETA_BANCO, GRADIENTE_BANCO, OPCIONES_BANCO, OPCIONES_MARCA } from "core";
import SwatchBanco from "../components/SwatchBanco";
import { bancoTieneCatalogo, gruposDelCatalogo, productoDe } from "../lib/catalogoTarjetas";
import { IconoGastos, IconoMas, IconoPapelera, IconoTarjetas } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";
import { mensajeError } from "core";
import { formatMonto } from "core";

interface Props {
  cuentas: Cuenta[];
  gastos: Gasto[];
  pagosTarjeta: PagoTarjeta[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number, cuentaOrigenId?: string) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
}

export default function Tarjetas({
  cuentas,
  gastos,
  pagosTarjeta,
  ingresos,
  categorias,
  onCrear,
  onEliminar,
  onRegistrarPago,
  onCrearGasto,
}: Props) {
  const tarjetas = cuentas.filter((c) => c.tipo === "credito");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => {
    if (!tarjetas.some((c) => c.id === seleccionadaId)) {
      setSeleccionadaId(tarjetas[0]?.id ?? null);
    }
  }, [tarjetas, seleccionadaId]);

  const tarjetaSeleccionada = tarjetas.find((c) => c.id === seleccionadaId);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">) {
    await onCrear(input);
    setMostrarForm(false);
  }

  return (
    <>
      {mostrarForm ? (
        <NuevaTarjeta onCrear={crearYCerrar} onCancelar={() => setMostrarForm(false)} />
      ) : (
        <button className="btn btn-primary" style={{ marginBottom: 24 }} onClick={() => setMostrarForm(true)}>
          <IconoMas /> Agregar tarjeta
        </button>
      )}

      {tarjetas.length === 0 ? (
        <EstadoVacio
          icono={<IconoTarjetas />}
          titulo="Todavía no agregaste tarjetas de crédito"
          subtitulo="Crea una arriba para empezar a controlar su cupo."
        />
      ) : (
        <>
          <div className="galeria-estilos" style={{ marginBottom: 24 }}>
            {tarjetas.map((cuenta) => (
              <TarjetaVisual
                key={cuenta.id}
                cuenta={cuenta}
                compacta
                seleccionada={cuenta.id === tarjetaSeleccionada?.id}
                onClick={() => setSeleccionadaId(cuenta.id)}
              />
            ))}
          </div>

          {tarjetaSeleccionada && (
            <DetalleTarjeta
              cuenta={tarjetaSeleccionada}
              cuentas={cuentas}
              gastos={gastos}
              pagosTarjeta={pagosTarjeta}
              ingresos={ingresos}
              categorias={categorias}
              onEliminar={onEliminar}
              onRegistrarPago={onRegistrarPago}
              onCrearGasto={onCrearGasto}
            />
          )}
        </>
      )}
    </>
  );
}

function DetalleTarjeta({
  cuenta,
  cuentas,
  gastos,
  pagosTarjeta,
  ingresos,
  categorias,
  onEliminar,
  onRegistrarPago,
  onCrearGasto,
}: {
  cuenta: Cuenta;
  cuentas: Cuenta[];
  gastos: Gasto[];
  pagosTarjeta: PagoTarjeta[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number, cuentaOrigenId?: string) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
}) {
  const [verEstadoCuenta, setVerEstadoCuenta] = useState(false);
  const movimientos = movimientosDe(cuenta.id, gastos, pagosTarjeta, ingresos, categorias);
  const recientes = movimientos.slice(0, 5);
  const categoriasGasto = categorias.filter((c) => c.tipo === "gasto");
  const cuentasOrigen = cuentas.filter((c) => c.tipo === "ahorro" || c.tipo === "debito");

  return (
    <>
      <div className="card tarjeta-detalle">
        <div>
          <TarjetaVisual cuenta={cuenta} onClick={() => setVerEstadoCuenta(true)} />

          <div className="tarjeta-visual-acciones" style={{ marginTop: 14 }}>
            <div className="tarjeta-detalle-acciones-rapidas">
              <PagarTarjeta cuenta={cuenta} cuentasOrigen={cuentasOrigen} onRegistrarPago={onRegistrarPago} />
              <RegistrarGastoInline cuenta={cuenta} categorias={categoriasGasto} onCrear={onCrearGasto} />
            </div>
            <button className="btn-icon" title="Eliminar tarjeta" onClick={() => onEliminar(cuenta.id)}>
              <IconoPapelera />
            </button>
          </div>
        </div>

        <div>
          <div className="form-gasto-header">
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Movimientos de la tarjeta</h3>
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
              subtitulo="Usa los botones de arriba para registrar un gasto o un pago en esta tarjeta: el cupo se ajusta solo."
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
          cuentasOrigen={cuentasOrigen}
          movimientos={movimientos}
          categoriasGasto={categoriasGasto}
          onEliminar={onEliminar}
          onRegistrarPago={onRegistrarPago}
          onCrearGasto={onCrearGasto}
          onCerrar={() => setVerEstadoCuenta(false)}
        />
      )}
    </>
  );
}

function EstadoCuentaModal({
  cuenta,
  cuentasOrigen,
  movimientos,
  categoriasGasto,
  onEliminar,
  onRegistrarPago,
  onCrearGasto,
  onCerrar,
}: {
  cuenta: Cuenta;
  cuentasOrigen: Cuenta[];
  movimientos: MovimientoCuenta[];
  categoriasGasto: Categoria[];
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number, cuentaOrigenId?: string) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCerrar: () => void;
}) {
  const usado = cuenta.cupoTotal !== undefined ? cuenta.cupoTotal - cuenta.disponible : undefined;
  const usoPorcentaje = cuenta.cupoTotal ? ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100 : undefined;
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
              {cuenta.cupoTotal !== undefined ? (
                <>
                  <span className="estado-cuenta-badge">
                    {formatMonto(cuenta.disponible)}
                    <small>Cupo disponible</small>
                  </span>
                  <BarraProgreso porcentaje={usoPorcentaje ?? 0} />
                  <div className="estado-cuenta-cupo-linea">
                    <div>
                      <span className="valor">{formatMonto(usado ?? 0)}</span>
                      <span className="etiqueta">Cupo utilizado</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="valor">{formatMonto(cuenta.cupoTotal)}</span>
                      <span className="etiqueta">Cupo aprobado</span>
                    </div>
                  </div>
                </>
              ) : (
                <span className="estado-cuenta-badge">
                  {formatMonto(cuenta.disponible)}
                  <small>Saldo</small>
                </span>
              )}

              <div className="tarjeta-visual-acciones" style={{ marginTop: 16 }}>
                <div className="tarjeta-detalle-acciones-rapidas">
                  <PagarTarjeta cuenta={cuenta} cuentasOrigen={cuentasOrigen} onRegistrarPago={onRegistrarPago} />
                  <RegistrarGastoInline cuenta={cuenta} categorias={categoriasGasto} onCrear={onCrearGasto} />
                </div>
                <button className="btn-icon" title="Eliminar tarjeta" onClick={eliminarYCerrar}>
                  <IconoPapelera />
                </button>
              </div>
            </div>
          </div>

          <h4 style={{ margin: "24px 0 8px" }}>Últimos consumos</h4>
          {grupos.length === 0 ? (
            <EstadoVacio
              icono={<IconoGastos />}
              titulo="Todavía no hay movimientos"
              subtitulo="Usa los botones de arriba para registrar un gasto o un pago en esta tarjeta: el cupo se ajusta solo."
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

function NuevaTarjeta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [marca, setMarca] = useState<Marca>("amex");
  const [estilo, setEstilo] = useState<string>("");
  const [cupoTotal, setCupoTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const hayCatalogo = bancoTieneCatalogo(banco);

  function elegirBanco(b: Banco) {
    setBanco(b);
    if (!bancoTieneCatalogo(b)) setEstilo("");
  }

  function elegirDelCatalogo(id: string, nombreProducto: string, marcaProducto: Marca) {
    setMarca(marcaProducto);
    setEstilo(id);
    if (!nombre.trim()) setNombre(nombreProducto);
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const cupo = Number(cupoTotal);
      await onCrear({
        nombre,
        tipo: "credito",
        banco,
        marca,
        estilo: hayCatalogo && estilo ? estilo : undefined,
        cupoTotal: cupo,
        disponible: cupo,
      });
      setNombre("");
      setCupoTotal("");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const vistaPrevia: Cuenta = {
    id: "vista-previa",
    nombre: nombre || (hayCatalogo && estilo ? productoDe(estilo)?.nombre : undefined) || "Mi tarjeta",
    tipo: "credito",
    banco,
    marca,
    estilo: hayCatalogo && estilo ? estilo : undefined,
    cupoTotal: cupoTotal ? Number(cupoTotal) : 0,
    disponible: Number(cupoTotal || 0),
    createdAt: "",
  };

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <div className="form-gasto-header">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Nueva tarjeta de crédito</h3>
        <button type="button" className="btn" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
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
          <label htmlFor="cupo-cuenta">Cupo asignado</label>
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
              colorFondo={cssGradiente(GRADIENTE_BANCO[b])}
              seleccionado={banco === b}
              onClick={() => elegirBanco(b)}
            />
          ))}
        </div>
      </div>

      {hayCatalogo ? (
        <div className="campo">
          <label>Diseño de la tarjeta (catálogo {ETIQUETA_BANCO[banco]})</label>
          {gruposDelCatalogo(banco).map((grupo) => (
            <div key={grupo.familia} className="galeria-estilos-grupo">
              <span className="galeria-estilos-titulo">{grupo.familia}</span>
              <div className="galeria-estilos">
                {grupo.items.map((producto) => (
                  <TarjetaVisual
                    key={producto.id}
                    compacta
                    seleccionada={estilo === producto.id}
                    onClick={() => elegirDelCatalogo(producto.id, producto.nombre, producto.marca)}
                    cuenta={{
                      id: producto.id,
                      nombre: producto.nombre,
                      tipo: "credito",
                      banco: producto.banco,
                      marca: producto.marca,
                      estilo: producto.id,
                      disponible: 0,
                      createdAt: "",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="campo">
          <label>Marca</label>
          <div className="galeria-estilos">
            {OPCIONES_MARCA.map((m) => (
              <TarjetaVisual
                key={m}
                compacta
                seleccionada={marca === m}
                onClick={() => setMarca(m)}
                cuenta={{
                  id: m,
                  nombre: nombre || "Mi tarjeta",
                  tipo: "credito",
                  banco,
                  marca: m,
                  disponible: 0,
                  createdAt: "",
                }}
              />
            ))}
          </div>
        </div>
      )}

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
