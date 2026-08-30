import { useRef, useState, type FormEvent } from "react";
import type { CambiosGasto, Categoria, Cuenta, Gasto, MetodoPago } from "core";
import { leerImagen, parseRecibo } from "../lib/ocr";
import { subirFactura, urlFactura } from "../lib/storage";
import { semanasDelMes, enRangoSemana } from "../lib/semanas";
import GraficoBarras from "../components/GraficoBarras";
import { IconoCamara, IconoFactura, IconoGastos, IconoPapelera, IconoSubir } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";
import ImportarEstadoCuenta from "../components/ImportarEstadoCuenta";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferencia",
  otro: "Otro",
};

interface Props {
  mes: string;
  gastos: Gasto[];
  categorias: Categoria[];
  cuentas: Cuenta[];
  onCrear: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onActualizar: (id: string, cambios: CambiosGasto) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onImportarVarios: (gastos: Omit<Gasto, "id" | "createdAt">[]) => Promise<void>;
}

export default function Gastos({
  mes,
  gastos,
  categorias,
  cuentas,
  onCrear,
  onActualizar,
  onEliminar,
  onImportarVarios,
}: Props) {
  const gastosDelMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const categoriasGasto = categorias.filter((c) => c.tipo === "gasto");
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [semanaActiva, setSemanaActiva] = useState(1);
  const semanas = semanasDelMes(mes);
  const rango = semanas[semanaActiva - 1];
  const gastosSemana = gastosDelMes.filter((g) => enRangoSemana(g.fecha, rango));

  const totalMes = gastosDelMes.reduce((acc, g) => acc + g.monto, 0);
  const totalSemana = gastosSemana.reduce((acc, g) => acc + g.monto, 0);

  const desglose = categoriasGasto
    .map((c) => ({
      categoria: c,
      monto: gastosSemana.filter((g) => g.categoriaId === c.id).reduce((acc, g) => acc + g.monto, 0),
    }))
    .filter((d) => d.monto > 0)
    .sort((a, b) => b.monto - a.monto);

  const datosGrafico = desglose.map((d) => ({ etiqueta: d.categoria.nombre, valor: d.monto, color: d.categoria.color }));

  return (
    <>
      <NuevoGasto
        categorias={categoriasGasto}
        cuentas={cuentas}
        onCrear={onCrear}
        onAbrirImportar={() => setMostrarImportar(true)}
      />

      {mostrarImportar && (
        <ImportarEstadoCuenta
          categorias={categoriasGasto}
          cuentas={cuentas}
          onImportar={onImportarVarios}
          onCerrar={() => setMostrarImportar(false)}
        />
      )}

      <div className="semanas-tabs">
        {semanas.map((s) => (
          <button
            key={s.numero}
            className={`semanas-tab ${semanaActiva === s.numero ? "semanas-tab-activo" : ""}`}
            onClick={() => setSemanaActiva(s.numero)}
          >
            Semana {s.numero}
            <span style={{ opacity: 0.65, fontWeight: 400 }}>
              {" "}
              ({s.desde}–{s.hasta})
            </span>
          </button>
        ))}
      </div>

      <div className="semana-layout">
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>
            Gastos por categoría — Semana {semanaActiva}
          </h3>
          <GraficoBarras datos={datosGrafico} />
        </div>

        <div className="card">
          <div className="semana-resumen-total">
            <span className="etiqueta">Total Semana {semanaActiva}</span>
            <span className="valor">${totalSemana.toFixed(2)}</span>
          </div>

          {desglose.length === 0 ? (
            <p className="etiqueta">Sin gastos en esta semana.</p>
          ) : (
            <ul className="semana-desglose">
              {desglose.map((d) => (
                <li key={d.categoria.id} className="semana-desglose-fila">
                  <span className="categoria-tag">
                    <span className="categoria-punto" style={{ background: d.categoria.color }} />
                    <span>{d.categoria.nombre}</span>
                  </span>
                  <span className="semana-desglose-porcentaje">
                    {totalSemana > 0 ? ((d.monto / totalSemana) * 100).toFixed(0) : 0}%
                  </span>
                  <span className="semana-desglose-monto">${d.monto.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="semana-acumulado">
            <span className="etiqueta">Acumulado del mes</span>
            <span className="valor" style={{ fontSize: "1.1rem" }}>
              ${totalMes.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <TablaGastos
        gastos={gastosSemana}
        categorias={categorias}
        cuentas={cuentas}
        onActualizar={onActualizar}
        onEliminar={onEliminar}
      />
    </>
  );
}

function TablaGastos({
  gastos,
  categorias,
  cuentas,
  onActualizar,
  onEliminar,
}: {
  gastos: Gasto[];
  categorias: Categoria[];
  cuentas: Cuenta[];
  onActualizar: (id: string, cambios: CambiosGasto) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}) {
  function categoriaDe(id: string) {
    return categorias.find((c) => c.id === id);
  }
  function cuentaDe(id?: string) {
    return id ? cuentas.find((c) => c.id === id) : undefined;
  }

  async function abrirFactura(ruta: string) {
    const url = await urlFactura(ruta);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {gastos.length === 0 ? (
        <EstadoVacio
          icono={<IconoGastos />}
          titulo="Todavía no hay gastos en esta semana"
          subtitulo="Agrégalos arriba o cambia de semana."
        />
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <FilaGasto
                key={g.id}
                gasto={g}
                categorias={categorias}
                cuentas={cuentas}
                categoria={categoriaDe(g.categoriaId)}
                cuenta={cuentaDe(g.cuentaId)}
                onAbrirFactura={abrirFactura}
                onActualizar={onActualizar}
                onEliminar={onEliminar}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FilaGasto({
  gasto,
  categorias,
  cuentas,
  categoria,
  cuenta,
  onAbrirFactura,
  onActualizar,
  onEliminar,
}: {
  gasto: Gasto;
  categorias: Categoria[];
  cuentas: Cuenta[];
  categoria?: Categoria;
  cuenta?: Cuenta;
  onAbrirFactura: (ruta: string) => void;
  onActualizar: (id: string, cambios: CambiosGasto) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha] = useState(gasto.fecha);
  const [descripcion, setDescripcion] = useState(gasto.descripcion);
  const [categoriaId, setCategoriaId] = useState(gasto.categoriaId);
  const [cuentaId, setCuentaId] = useState(gasto.cuentaId ?? "");
  const [monto, setMonto] = useState(String(gasto.monto));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await onActualizar(gasto.id, {
        fecha,
        descripcion,
        categoriaId,
        cuentaId: cuentaId || undefined,
        monto: Number(monto),
      });
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <tr>
        <td>
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </td>
        <td>
          <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </td>
        <td>
          <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {categorias
              .filter((c) => c.tipo === "gasto")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </td>
        <td>
          <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Sin asignar</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </td>
        <td></td>
        <td>
          <div className="pago-tarjeta-inline">
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "…" : "Guardar"}
            </button>
            <button className="btn" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{gasto.fecha}</td>
      <td>{gasto.descripcion}</td>
      <td>
        <span className="categoria-tag">
          <span className="categoria-punto" style={{ background: categoria?.color ?? "#aaa" }} />
          {categoria?.nombre ?? "Sin categoría"}
          {categoria?.nombre === "Otros" && gasto.categoriaDetalle ? ` · ${gasto.categoriaDetalle}` : ""}
        </span>
      </td>
      <td>{cuenta?.nombre ?? "—"}</td>
      <td>${gasto.monto.toFixed(2)}</td>
      <td className="tabla-celda-factura">
        {gasto.facturaPath && (
          <button className="factura-link" title="Ver factura" onClick={() => onAbrirFactura(gasto.facturaPath!)}>
            <IconoFactura />
          </button>
        )}
      </td>
      <td>
        <div className="pago-tarjeta-inline">
          <button className="btn" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(gasto.id)}>
            <IconoPapelera />
          </button>
        </div>
      </td>
    </tr>
  );
}

function NuevoGasto({
  categorias,
  cuentas,
  onCrear,
  onAbrirImportar,
}: {
  categorias: Categoria[];
  cuentas: Cuenta[];
  onCrear: (input: Omit<Gasto, "id" | "createdAt">) => Promise<void>;
  onAbrirImportar: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaDetalle, setCategoriaDetalle] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | "">("");
  const [fecha, setFecha] = useState(hoy());
  const [factura, setFactura] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [leyendoRecibo, setLeyendoRecibo] = useState(false);
  const [subiendoFactura, setSubiendoFactura] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputFacturaRef = useRef<HTMLInputElement>(null);

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
  const esOtros = categoriaSeleccionada?.nombre === "Otros";

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      let facturaPath: string | undefined;
      if (factura) {
        setSubiendoFactura(true);
        facturaPath = await subirFactura(factura);
        setSubiendoFactura(false);
      }

      await onCrear({
        monto: Number(monto),
        descripcion,
        categoriaId,
        categoriaDetalle: esOtros ? categoriaDetalle : undefined,
        cuentaId: cuentaId || undefined,
        metodoPago: metodoPago || undefined,
        facturaPath,
        fecha,
      });
      setMonto("");
      setDescripcion("");
      setCategoriaDetalle("");
      setFactura(null);
      setFecha(hoy());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
      setSubiendoFactura(false);
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
        <div style={{ display: "flex", gap: 8 }}>
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
            <IconoCamara />
            {leyendoRecibo ? "Leyendo recibo…" : "Escanear recibo"}
          </button>
          <button type="button" className="btn" onClick={onAbrirImportar}>
            <IconoSubir />
            Importar estado de cuenta
          </button>
        </div>
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
        {esOtros && (
          <div className="campo">
            <label htmlFor="categoria-detalle">Detalle</label>
            <input
              id="categoria-detalle"
              className="input"
              placeholder="¿Qué fue?"
              value={categoriaDetalle}
              onChange={(e) => setCategoriaDetalle(e.target.value)}
              required
            />
          </div>
        )}
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
          <label htmlFor="metodo-pago">Método de pago</label>
          <select
            id="metodo-pago"
            className="input"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
          >
            <option value="">Sin especificar</option>
            {(Object.keys(ETIQUETA_METODO_PAGO) as MetodoPago[]).map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_METODO_PAGO[m]}
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
        <div className="campo">
          <label htmlFor="factura">Factura (PDF o imagen)</label>
          <input
            id="factura"
            ref={inputFacturaRef}
            className="input"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFactura(e.target.files?.[0] ?? null)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {subiendoFactura ? "Subiendo factura…" : guardando ? "Guardando…" : "Agregar"}
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
