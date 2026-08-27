import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  listarGastos,
  listarCategorias,
  listarCuentas,
  listarIngresos,
  listarDeudas,
  listarRecordatorios,
  crearGasto,
  eliminarGasto,
  crearIngreso,
  eliminarIngreso,
  crearCuenta,
  eliminarCuenta,
  registrarPagoTarjeta,
  crearDeuda,
  registrarAbonoDeuda,
  eliminarDeuda,
  crearRecordatorio,
  marcarCompletado,
  eliminarRecordatorio,
  balanceGeneral,
  calcularEndeudamiento,
  generarRecomendaciones,
  type Gasto,
  type Categoria,
  type Cuenta,
  type Ingreso,
  type Deuda,
  type Recordatorio,
} from "core";
import { supabase } from "./lib/supabase";
import Resumen from "./views/Resumen";
import Gastos from "./views/Gastos";
import Ingresos from "./views/Ingresos";
import Tarjetas from "./views/Tarjetas";
import Deudas from "./views/Deudas";
import Recordatorios from "./views/Recordatorios";

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

  if (session === undefined) return <p className="contenedor">Cargando…</p>;
  if (!session) return <Login />;
  return <Dashboard onSalir={() => supabase.auth.signOut()} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setCargando(false);
  }

  return (
    <main className="login-wrap">
      <form onSubmit={iniciarSesion} className="card login-card">
        <h1>Gastos App</h1>
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={cargando}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

function mesActual() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

type Tab = "resumen" | "gastos" | "ingresos" | "tarjetas" | "deudas" | "recordatorios";

const TABS: { id: Tab; etiqueta: string }[] = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "gastos", etiqueta: "Gastos" },
  { id: "ingresos", etiqueta: "Ingresos" },
  { id: "tarjetas", etiqueta: "Tarjetas" },
  { id: "deudas", etiqueta: "Deudas" },
  { id: "recordatorios", etiqueta: "Recordatorios" },
];

function Dashboard({ onSalir }: { onSalir: () => void }) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [mes, setMes] = useState(mesActual());

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    setError(null);
    try {
      const [g, c, cu, i, d, r] = await Promise.all([
        listarGastos(),
        listarCategorias(),
        listarCuentas(),
        listarIngresos(),
        listarDeudas(),
        listarRecordatorios(),
      ]);
      setGastos(g);
      setCategorias(c);
      setCuentas(cu);
      setIngresos(i);
      setDeudas(d);
      setRecordatorios(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  const gastosDelMes = useMemo(() => gastos.filter((g) => g.fecha.startsWith(mes)), [gastos, mes]);
  const ingresosDelMes = useMemo(() => ingresos.filter((i) => i.fecha.startsWith(mes)), [ingresos, mes]);
  const balance = useMemo(() => balanceGeneral(gastosDelMes, ingresosDelMes), [gastosDelMes, ingresosDelMes]);
  const endeudamiento = useMemo(
    () => calcularEndeudamiento(deudas, balance.totalIngresos),
    [deudas, balance.totalIngresos]
  );
  const recomendaciones = useMemo(
    () =>
      generarRecomendaciones({ mes, gastos, ingresos, categorias, cuentas, endeudamiento }),
    [mes, gastos, ingresos, categorias, cuentas, endeudamiento]
  );

  // --- handlers: todos recargan al final porque triggers en la base de
  // datos ajustan `cuentas.disponible` server-side (ver migración de
  // finanzas completas), así que el estado local no puede calcularlo solo.
  async function handleCrearGasto(input: Omit<Gasto, "id" | "createdAt">) {
    await crearGasto(input);
    await recargar();
  }
  async function handleEliminarGasto(id: string) {
    await eliminarGasto(id);
    await recargar();
  }
  async function handleCrearIngreso(input: Omit<Ingreso, "id" | "createdAt">) {
    await crearIngreso(input);
    await recargar();
  }
  async function handleEliminarIngreso(id: string) {
    await eliminarIngreso(id);
    await recargar();
  }
  async function handleCrearCuenta(input: Omit<Cuenta, "id" | "createdAt">) {
    await crearCuenta(input);
    await recargar();
  }
  async function handleEliminarCuenta(id: string) {
    await eliminarCuenta(id);
    await recargar();
  }
  async function handleRegistrarPago(cuentaId: string, monto: number) {
    await registrarPagoTarjeta({ cuentaId, monto, fecha: new Date().toISOString().slice(0, 10) });
    await recargar();
  }
  async function handleCrearDeuda(input: Omit<Deuda, "id" | "createdAt">) {
    await crearDeuda(input);
    await recargar();
  }
  async function handleAbonarDeuda(id: string, monto: number) {
    await registrarAbonoDeuda(id, monto);
    await recargar();
  }
  async function handleEliminarDeuda(id: string) {
    await eliminarDeuda(id);
    await recargar();
  }
  async function handleCrearRecordatorio(
    input: Omit<Recordatorio, "id" | "createdAt" | "completado">
  ) {
    await crearRecordatorio(input);
    await recargar();
  }
  async function handleToggleRecordatorio(id: string, completado: boolean) {
    await marcarCompletado(id, completado);
    await recargar();
  }
  async function handleEliminarRecordatorio(id: string) {
    await eliminarRecordatorio(id);
    await recargar();
  }

  return (
    <div className="pagina">
      <header className="header">
        <h1>Gastos App — Escritorio</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(tab === "resumen" || tab === "gastos" || tab === "ingresos") && (
            <input type="month" className="input" value={mes} onChange={(e) => setMes(e.target.value)} />
          )}
          <button className="btn" onClick={onSalir}>
            Salir
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "tab-activo" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.etiqueta}
          </button>
        ))}
      </nav>

      <div className="contenedor">
        {error && (
          <p className="error" style={{ marginBottom: 16 }}>
            Error: {error}
          </p>
        )}

        {cargando ? (
          <p>Cargando…</p>
        ) : (
          <>
            {tab === "resumen" && (
              <Resumen balance={balance} endeudamiento={endeudamiento} recomendaciones={recomendaciones} />
            )}
            {tab === "gastos" && (
              <Gastos
                mes={mes}
                gastos={gastos}
                categorias={categorias}
                cuentas={cuentas}
                onCrear={handleCrearGasto}
                onEliminar={handleEliminarGasto}
              />
            )}
            {tab === "ingresos" && (
              <Ingresos
                mes={mes}
                ingresos={ingresos}
                cuentas={cuentas}
                onCrear={handleCrearIngreso}
                onEliminar={handleEliminarIngreso}
              />
            )}
            {tab === "tarjetas" && (
              <Tarjetas
                cuentas={cuentas}
                onCrear={handleCrearCuenta}
                onEliminar={handleEliminarCuenta}
                onRegistrarPago={handleRegistrarPago}
              />
            )}
            {tab === "deudas" && (
              <Deudas
                deudas={deudas}
                endeudamiento={endeudamiento}
                onCrear={handleCrearDeuda}
                onAbonar={handleAbonarDeuda}
                onEliminar={handleEliminarDeuda}
              />
            )}
            {tab === "recordatorios" && (
              <Recordatorios
                recordatorios={recordatorios}
                deudas={deudas}
                onCrear={handleCrearRecordatorio}
                onToggle={handleToggleRecordatorio}
                onEliminar={handleEliminarRecordatorio}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
