import { useState, type FormEvent } from "react";
import type { Categoria, TipoCategoria } from "core";
import { IconoCategorias, IconoPapelera } from "../components/iconos";
import EstadoVacio from "../components/EstadoVacio";

interface Props {
  categorias: Categoria[];
  onCrear: (input: { nombre: string; color: string; tipo: TipoCategoria }) => Promise<void>;
  onActualizar: (id: string, cambios: { nombre: string; color: string }) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}

export default function Categorias({ categorias, onCrear, onActualizar, onEliminar }: Props) {
  const deGasto = categorias.filter((c) => c.tipo === "gasto");
  const deIngreso = categorias.filter((c) => c.tipo === "ingreso");

  return (
    <>
      <NuevaCategoria onCrear={onCrear} />

      <div className="resumen" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <ListaCategorias
          titulo="Categorías de gasto"
          categorias={deGasto}
          onActualizar={onActualizar}
          onEliminar={onEliminar}
        />
        <ListaCategorias
          titulo="Categorías de ingreso"
          categorias={deIngreso}
          onActualizar={onActualizar}
          onEliminar={onEliminar}
        />
      </div>
    </>
  );
}

function ListaCategorias({
  titulo,
  categorias,
  onActualizar,
  onEliminar,
}: {
  titulo: string;
  categorias: Categoria[];
  onActualizar: (id: string, cambios: { nombre: string; color: string }) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <h3 style={{ margin: 0, padding: "16px 18px 0", fontSize: "0.95rem" }}>{titulo}</h3>
      {categorias.length === 0 ? (
        <EstadoVacio
          icono={<IconoCategorias />}
          titulo="Todavía no hay categorías acá"
          subtitulo="Creá una arriba para empezar a clasificar tus movimientos."
        />
      ) : (
        <ul className="actividad-lista" style={{ padding: "8px 18px 12px" }}>
          {categorias.map((c) => (
            <FilaCategoria key={c.id} categoria={c} onActualizar={onActualizar} onEliminar={onEliminar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaCategoria({
  categoria,
  onActualizar,
  onEliminar,
}: {
  categoria: Categoria;
  onActualizar: (id: string, cambios: { nombre: string; color: string }) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(categoria.nombre);
  const [color, setColor] = useState(categoria.color);
  const [guardando, setGuardando] = useState(false);
  const esPropia = categoria.usuarioId !== undefined;

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await onActualizar(categoria.id, { nombre, color });
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <li className="actividad-item">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 32, height: 32, padding: 0, border: "none", borderRadius: 8, flexShrink: 0 }}
        />
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "…" : "Guardar"}
        </button>
        <button className="btn" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      </li>
    );
  }

  return (
    <li className="actividad-item">
      <span className="categoria-punto" style={{ background: categoria.color, flexShrink: 0 }} />
      <div className="actividad-info">
        <span className="actividad-descripcion">{categoria.nombre}</span>
        {!esPropia && <span className="actividad-subtitulo">Categoría global</span>}
      </div>
      {esPropia && (
        <>
          <button className="btn" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button className="btn-icon" title="Eliminar" onClick={() => onEliminar(categoria.id)}>
            <IconoPapelera />
          </button>
        </>
      )}
    </li>
  );
}

function NuevaCategoria({
  onCrear,
}: {
  onCrear: (input: { nombre: string; color: string; tipo: TipoCategoria }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#3b6ff2");
  const [tipo, setTipo] = useState<TipoCategoria>("gasto");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await onCrear({ nombre, color, tipo });
      setNombre("");
      setColor("#3b6ff2");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={agregar} className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Nueva categoría</h3>
      <div className="form-gasto">
        <div className="campo">
          <label htmlFor="nombre-categoria">Nombre</label>
          <input
            id="nombre-categoria"
            className="input"
            placeholder="Mascotas"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="tipo-categoria">Tipo</label>
          <select
            id="tipo-categoria"
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCategoria)}
          >
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
        </div>
        <div className="campo" style={{ flex: "0 0 auto" }}>
          <label htmlFor="color-categoria">Color</label>
          <input
            id="color-categoria"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 44, height: 38, padding: 0, border: "1px solid var(--color-border)", borderRadius: 8 }}
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
