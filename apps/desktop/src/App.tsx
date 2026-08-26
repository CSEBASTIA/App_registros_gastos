import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { listarGastos, listarCategorias, type Gasto, type Categoria } from "core";
import { supabase } from "./lib/supabase";

export default function App() {
  // undefined = todavía no sabemos si hay sesión; null = no hay sesión.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p style={estilos.pagina}>Cargando…</p>;
  if (!session) return <Login />;
  return <Dashboard onSalir={() => supabase.auth.signOut()} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function iniciarSesion(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  return (
    <main style={estilos.pagina}>
      <form onSubmit={iniciarSesion} style={estilos.form}>
        <h1>Gastos App — Escritorio</h1>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Ingresar</button>
      </form>
    </main>
  );
}

function Dashboard({ onSalir }: { onSalir: () => void }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarGastos(), listarCategorias()])
      .then(([g, c]) => {
        setGastos(g);
        setCategorias(c);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCargando(false));
  }, []);

  function nombreCategoria(id: string) {
    return categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";
  }

  return (
    <main style={estilos.pagina}>
      <div style={estilos.header}>
        <h1>Gastos App — Escritorio</h1>
        <button onClick={onSalir}>Salir</button>
      </div>
      {cargando && <p>Cargando…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!cargando && !error && (
        <table style={estilos.tabla}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{g.fecha}</td>
                <td>{g.descripcion}</td>
                <td>{nombreCategoria(g.categoriaId)}</td>
                <td>${g.monto.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const estilos: Record<string, CSSProperties> = {
  pagina: { fontFamily: "sans-serif", padding: "2rem", maxWidth: 720, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  form: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "4rem auto" },
  tabla: { width: "100%", borderCollapse: "collapse", marginTop: 16 },
};
