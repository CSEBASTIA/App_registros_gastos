import { useEffect, useState, type FormEvent } from "react";
import type { Banco, Categoria, Cuenta, Gasto, Ingreso, Marca, PagoTarjeta, TipoCuenta } from "core";
import TarjetaVisual from "../components/TarjetaVisual";
import BarraProgreso from "../components/BarraProgreso";
import { ETIQUETA_BANCO, GRADIENTE_BANCO, OPCIONES_BANCO, OPCIONES_MARCA } from "../lib/marcas";
import { CATALOGO_TARJETAS } from "../lib/catalogoTarjetas";
import { IconoFlechaArriba, IconoGastos, IconoMas, IconoPapelera, IconoTarjetas } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

interface MovimientoTarjeta {
  id: string;
  tipo: "gasto" | "pago" | "ingreso";
  descripcion: string;
  subtitulo: string;
  monto: number;
  fecha: string;
  createdAt: string;
  color: string;
}

function movimientosDe(
  cuentaId: string,
  gastos: Gasto[],
  pagos: PagoTarjeta[],
  ingresos: Ingreso[],
  categorias: Categoria[]
): MovimientoTarjeta[] {
  const items: MovimientoTarjeta[] = [
    ...gastos
      .filter((g) => g.cuentaId === cuentaId)
      .map((g) => {
        const categoria = categorias.find((c) => c.id === g.categoriaId);
        return {
          id: g.id,
          tipo: "gasto" as const,
          descripcion: g.descripcion || categoria?.nombre || "Gasto",
          subtitulo: categoria?.nombre ?? "Sin categoría",
          monto: g.monto,
          fecha: g.fecha,
          createdAt: g.createdAt,
          color: categoria?.color ?? "#6b7280",
        };
      }),
    ...pagos
      .filter((p) => p.cuentaId === cuentaId)
      .map((p) => ({
        id: p.id,
        tipo: "pago" as const,
        descripcion: "Pago",
        subtitulo: "Pago a la tarjeta",
        monto: p.monto,
        fecha: p.fecha,
        createdAt: p.createdAt,
        color: "#16a34a",
      })),
    ...ingresos
      .filter((i) => i.cuentaId === cuentaId)
      .map((i) => ({
        id: i.id,
        tipo: "ingreso" as const,
        descripcion: i.descripcion || "Ingreso",
        subtitulo: "Ingreso",
        monto: i.monto,
        fecha: i.fecha,
        createdAt: i.createdAt,
        color: "#16a34a",
      })),
  ];

  return items.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function etiquetaFecha(fecha: string): string {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (fecha === hoy.toISOString().slice(0, 10)) return "Hoy";
  if (fecha === ayer.toISOString().slice(0, 10)) return "Ayer";
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function agruparPorFecha(items: MovimientoTarjeta[]): { fecha: string; etiqueta: string; items: MovimientoTarjeta[] }[] {
  const grupos: { fecha: string; etiqueta: string; items: MovimientoTarjeta[] }[] = [];
  for (const item of items) {
    let grupo = grupos.find((g) => g.fecha === item.fecha);
    if (!grupo) {
      grupo = { fecha: item.fecha, etiqueta: etiquetaFecha(item.fecha), items: [] };
      grupos.push(grupo);
    }
    grupo.items.push(item);
  }
  return grupos;
}

function ItemMovimiento({ item }: { item: MovimientoTarjeta }) {
  const esIngreso = item.tipo !== "gasto";
  return (
    <li className="actividad-item">
      <span className="actividad-icono" style={{ background: `${item.color}1f`, color: item.color }}>
        {esIngreso ? <IconoFlechaArriba /> : <IconoGastos />}
      </span>
      <div className="actividad-info">
        <span className="actividad-descripcion">{item.descripcion}</span>
        <span className="actividad-subtitulo">{item.subtitulo}</span>
      </div>
      <span className={`actividad-monto ${esIngreso ? "valor-positivo" : "valor-negativo"}`}>
        {esIngreso ? "+" : "-"}${item.monto.toFixed(2)}
      </span>
    </li>
  );
}

const GRUPOS_CATALOGO: { titulo: string; marca: Marca }[] = [
  { titulo: "American Express", marca: "amex" },
  { titulo: "Visa", marca: "visa" },
  { titulo: "LATAM Pass / Mastercard", marca: "mastercard" },
];

interface Props {
  cuentas: Cuenta[];
  gastos: Gasto[];
  pagosTarjeta: PagoTarjeta[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCrearIngreso: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
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
  onCrearIngreso,
}: Props) {
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => {
    if (!cuentas.some((c) => c.id === seleccionadaId)) {
      setSeleccionadaId(cuentas[0]?.id ?? null);
    }
  }, [cuentas, seleccionadaId]);

  const cuentaSeleccionada = cuentas.find((c) => c.id === seleccionadaId);

  async function crearYCerrar(input: Omit<Cuenta, "id" | "createdAt">) {
    await onCrear(input);
    setMostrarForm(false);
  }

  return (
    <>
      {mostrarForm ? (
        <NuevaCuenta onCrear={crearYCerrar} onCancelar={() => setMostrarForm(false)} />
      ) : (
        <button className="btn btn-primary" style={{ marginBottom: 24 }} onClick={() => setMostrarForm(true)}>
          <IconoMas /> Agregar tarjeta
        </button>
      )}

      {cuentas.length === 0 ? (
        <EstadoVacio
          icono={<IconoTarjetas />}
          titulo="Todavía no agregaste cuentas ni tarjetas"
          subtitulo="Crea una arriba para empezar a controlar su cupo o saldo."
        />
      ) : (
        <>
          <div className="galeria-estilos" style={{ marginBottom: 24 }}>
            {cuentas.map((cuenta) => (
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
            <DetalleTarjeta
              cuenta={cuentaSeleccionada}
              gastos={gastos}
              pagosTarjeta={pagosTarjeta}
              ingresos={ingresos}
              categorias={categorias}
              onEliminar={onEliminar}
              onRegistrarPago={onRegistrarPago}
              onCrearGasto={onCrearGasto}
              onCrearIngreso={onCrearIngreso}
            />
          )}
        </>
      )}
    </>
  );
}

function DetalleTarjeta({
  cuenta,
  gastos,
  pagosTarjeta,
  ingresos,
  categorias,
  onEliminar,
  onRegistrarPago,
  onCrearGasto,
  onCrearIngreso,
}: {
  cuenta: Cuenta;
  gastos: Gasto[];
  pagosTarjeta: PagoTarjeta[];
  ingresos: Ingreso[];
  categorias: Categoria[];
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCrearIngreso: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
}) {
  const [verEstadoCuenta, setVerEstadoCuenta] = useState(false);
  const esCredito = cuenta.tipo === "credito";

  const movimientos = movimientosDe(cuenta.id, gastos, pagosTarjeta, ingresos, categorias);
  const recientes = movimientos.slice(0, 5);

  return (
    <>
      <div className="card tarjeta-detalle">
        <div>
          <TarjetaVisual cuenta={cuenta} onClick={() => setVerEstadoCuenta(true)} />

          <div className="tarjeta-visual-acciones" style={{ marginTop: 14 }}>
            <div className="tarjeta-detalle-acciones-rapidas">
              {esCredito && <PagarTarjeta cuenta={cuenta} onRegistrarPago={onRegistrarPago} />}
              {!esCredito && <RegistrarSueldoInline cuenta={cuenta} onCrear={onCrearIngreso} />}
              <RegistrarGastoInline cuenta={cuenta} categorias={categorias.filter((c) => c.tipo === "gasto")} onCrear={onCrearGasto} />
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
              subtitulo="Usa los botones de arriba para registrar un gasto o un ingreso en esta cuenta: el saldo se ajusta solo."
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
          categorias={categorias}
          onEliminar={onEliminar}
          onRegistrarPago={onRegistrarPago}
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
  categorias,
  onEliminar,
  onRegistrarPago,
  onCrearGasto,
  onCrearIngreso,
  onCerrar,
}: {
  cuenta: Cuenta;
  movimientos: MovimientoTarjeta[];
  categorias: Categoria[];
  onEliminar: (id: string) => Promise<void>;
  onRegistrarPago: (cuentaId: string, monto: number) => Promise<void>;
  onCrearGasto: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onCrearIngreso: (input: Omit<Ingreso, "id" | "createdAt">) => Promise<void>;
  onCerrar: () => void;
}) {
  const esCredito = cuenta.tipo === "credito";
  const usado = esCredito && cuenta.cupoTotal !== undefined ? cuenta.cupoTotal - cuenta.disponible : undefined;
  const usoPorcentaje =
    esCredito && cuenta.cupoTotal ? ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100 : undefined;
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
              {esCredito && cuenta.cupoTotal !== undefined ? (
                <>
                  <span className="estado-cuenta-badge">
                    ${cuenta.disponible.toFixed(2)}
                    <small>Cupo disponible</small>
                  </span>
                  <BarraProgreso porcentaje={usoPorcentaje ?? 0} />
                  <div className="estado-cuenta-cupo-linea">
                    <div>
                      <span className="valor">${(usado ?? 0).toFixed(2)}</span>
                      <span className="etiqueta">Cupo utilizado</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="valor">${cuenta.cupoTotal.toFixed(2)}</span>
                      <span className="etiqueta">Cupo aprobado</span>
                    </div>
                  </div>
                </>
              ) : (
                <span className="estado-cuenta-badge">
                  ${cuenta.disponible.toFixed(2)}
                  <small>Saldo</small>
                </span>
              )}

              <div className="tarjeta-visual-acciones" style={{ marginTop: 16 }}>
                <div className="tarjeta-detalle-acciones-rapidas">
                  {esCredito && <PagarTarjeta cuenta={cuenta} onRegistrarPago={onRegistrarPago} />}
                  {!esCredito && <RegistrarSueldoInline cuenta={cuenta} onCrear={onCrearIngreso} />}
                  <RegistrarGastoInline cuenta={cuenta} categorias={categorias.filter((c) => c.tipo === "gasto")} onCrear={onCrearGasto} />
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
              subtitulo="Usa los botones de arriba para registrar un gasto o un ingreso en esta cuenta: el saldo se ajusta solo."
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

function RegistrarSueldoInline({
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

function RegistrarGastoInline({
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

function NuevaCuenta({
  onCrear,
  onCancelar,
}: {
  onCrear: (input: Omit<Cuenta, "id" | "createdAt">) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("credito");
  const [banco, setBanco] = useState<Banco>("banco_guayaquil");
  const [marca, setMarca] = useState<Marca>("amex");
  const [estilo, setEstilo] = useState<string>("");
  const [cupoTotal, setCupoTotal] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esCredito = tipo === "credito";
  const hayCatalogo = esCredito && banco === "banco_guayaquil";

  function elegirBanco(b: Banco) {
    setBanco(b);
    if (b !== "banco_guayaquil") setEstilo("");
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
      const cupo = esCredito ? Number(cupoTotal) : undefined;
      await onCrear({
        nombre,
        tipo,
        banco,
        marca: esCredito ? marca : undefined,
        estilo: hayCatalogo && estilo ? estilo : undefined,
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

  const vistaPrevia: Cuenta = {
    id: "vista-previa",
    nombre: nombre || (hayCatalogo && estilo ? CATALOGO_TARJETAS.find((p) => p.id === estilo)?.nombre : undefined) || "Mi tarjeta",
    tipo,
    banco,
    marca: esCredito ? marca : undefined,
    estilo: hayCatalogo && estilo ? estilo : undefined,
    cupoTotal: esCredito && cupoTotal ? Number(cupoTotal) : esCredito ? 0 : undefined,
    disponible: esCredito ? Number(cupoTotal || 0) : Number(saldoInicial || 0),
    createdAt: "",
  };

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <div className="form-gasto-header">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Nueva cuenta / tarjeta</h3>
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
        {esCredito ? (
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
        ) : (
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

      <div className="campo" style={{ marginTop: 16 }}>
        <label>Banco</label>
        <div className="galeria-estilos">
          {OPCIONES_BANCO.map((b) => (
            <button
              key={b}
              type="button"
              className={`swatch-banco ${banco === b ? "swatch-banco-activo" : ""}`}
              style={{ background: GRADIENTE_BANCO[b] }}
              onClick={() => elegirBanco(b)}
            >
              {ETIQUETA_BANCO[b]}
            </button>
          ))}
        </div>
      </div>

      {hayCatalogo ? (
        <div className="campo">
          <label>Diseño de la tarjeta (catálogo Banco Guayaquil)</label>
          {GRUPOS_CATALOGO.map((grupo) => (
            <div key={grupo.titulo} className="galeria-estilos-grupo">
              <span className="galeria-estilos-titulo">{grupo.titulo}</span>
              <div className="galeria-estilos">
                {CATALOGO_TARJETAS.filter((p) => p.marca === grupo.marca).map((producto) => (
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
        esCredito && (
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
        )
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
