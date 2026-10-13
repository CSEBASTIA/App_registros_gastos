import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { mensajeError } from "core";
import {
  listarGastos,
  listarCategorias,
  listarCuentas,
  listarIngresos,
  listarDeudas,
  listarRecordatorios,
  listarPagosTarjeta,
  crearGasto,
  actualizarGasto,
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
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  balanceGeneral,
  calcularEndeudamiento,
  generarRecomendaciones,
  eliminarTodosLosDatos,
  type Gasto,
  type CambiosGasto,
  type Categoria,
  type TipoCategoria,
  type Cuenta,
  type Ingreso,
  type Deuda,
  type Recordatorio,
  type PagoTarjeta,
} from "core";
import { supabase } from "./lib/supabase";
import { useInterfazMotion } from "./lib/interfazMotion";
import TituloAnimado from "./components/TituloAnimado";
import PanelCargando from "./components/PanelCargando";
import Dock from "./components/Dock";
import AnimatedBackground from "./components/AnimatedBackground";
import BlurFade from "./components/BlurFade";
import RippleButton from "./components/RippleButton";
import Resumen from "./views/Resumen";
import Gastos from "./views/Gastos";
import Ingresos from "./views/Ingresos";
import Tarjetas from "./views/Tarjetas";
import Cuentas from "./views/Cuentas";
import Deudas from "./views/Deudas";
import Recordatorios from "./views/Recordatorios";
import Categorias from "./views/Categorias";
import Logo from "./components/Logo";
import {
  IconoResumen,
  IconoGastos,
  IconoIngresos,
  IconoTarjetas,
  IconoWallet,
  IconoDeudas,
  IconoRecordatorios,
  IconoCategorias,
} from "./components/iconos";

// LOGIN DESACTIVADO DE MOMENTO: no hay pantalla de login, la app entra
// directo al dashboard. Las tablas exigen un usuario autenticado (RLS +
// usuario_id = auth.uid()), así que para ver/guardar datos hace falta una
// sesión real: si no hay una guardada, se inicia sola con VITE_DEV_EMAIL y
// VITE_DEV_PASSWORD del .env. Sin sesión el dashboard se ve, pero vacío.
//
// Solo en `vite dev`: toda variable VITE_* se incrusta como texto en el
// JavaScript que se publica. Con el guard de DEV, en `vite build` la
// condición es `false` y el minificador elimina las credenciales del bundle.
const DEV_EMAIL = import.meta.env.DEV ? import.meta.env.VITE_DEV_EMAIL : undefined;
const DEV_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD : undefined;

export default function App() {
  // magic card (spotlight de puntero) + ripple en botones primarios: un solo
  // listener a nivel de documento para toda la app (ver src/lib/interfazMotion.ts).
  useInterfazMotion();

  // undefined = todavía no sabemos si hay sesión; null = no hay sesión.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [avisoSesion, setAvisoSesion] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (activo) setSession(data.session);
        return;
      }
      if (!DEV_EMAIL || !DEV_PASSWORD) {
        if (!activo) return;
        setAvisoSesion(
          "Sin sesión: pon VITE_DEV_EMAIL y VITE_DEV_PASSWORD en apps/desktop/.env para ver y guardar tus datos.",
        );
        setSession(null);
        return;
      }
      const { data: login, error } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });
      if (!activo) return;
      if (error)
        setAvisoSesion(
          `Sin sesión: el login automático falló (${error.message}).`,
        );
      setSession(login.session);
    }
    iniciar();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (evento, nuevaSesion) => {
        // la sesión inicial la resuelve iniciar()
        if (evento === "INITIAL_SESSION") return;
        setSession(nuevaSesion);
        if (nuevaSesion) setAvisoSesion(null);
      },
    );
    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined)
    return (
      <div className="contenedor">
        <PanelCargando />
      </div>
    );
  // si la sesión cambia de usuario, se remonta el dashboard para recargar datos
  return (
    <Dashboard
      key={session?.user.id ?? "sin-sesion"}
      session={session}
      avisoSesion={avisoSesion}
    />
  );
}

function mesActual() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

type Tab =
  | "resumen"
  | "gastos"
  | "ingresos"
  | "tarjetas"
  | "cuentas"
  | "deudas"
  | "recordatorios"
  | "categorias";

const TABS: { id: Tab; etiqueta: string; icono: typeof IconoResumen }[] = [
  { id: "resumen", etiqueta: "Resumen", icono: IconoResumen },
  { id: "ingresos", etiqueta: "Ingresos", icono: IconoIngresos },
  { id: "gastos", etiqueta: "Gastos", icono: IconoGastos },
  { id: "tarjetas", etiqueta: "Tarjetas", icono: IconoTarjetas },
  { id: "cuentas", etiqueta: "Cuentas", icono: IconoWallet },
  { id: "deudas", etiqueta: "Deudas", icono: IconoDeudas },
  { id: "recordatorios", etiqueta: "Recordatorios", icono: IconoRecordatorios },
  { id: "categorias", etiqueta: "Categorías", icono: IconoCategorias },
];

function Dashboard({
  session,
  avisoSesion,
}: {
  session: Session | null;
  avisoSesion: string | null;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [mes, setMes] = useState(mesActual());

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [pagosTarjeta, setPagosTarjeta] = useState<PagoTarjeta[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    setError(null);
    try {
      const [g, c, cu, i, d, r, p] = await Promise.all([
        listarGastos(),
        listarCategorias(),
        listarCuentas(),
        listarIngresos(),
        listarDeudas(),
        listarRecordatorios(),
        listarPagosTarjeta(),
      ]);
      setGastos(g);
      setCategorias(c);
      setCuentas(cu);
      setIngresos(i);
      setDeudas(d);
      setRecordatorios(r);
      setPagosTarjeta(p);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  const gastosDelMes = useMemo(
    () => gastos.filter((g) => g.fecha.startsWith(mes)),
    [gastos, mes],
  );
  const ingresosDelMes = useMemo(
    () => ingresos.filter((i) => i.fecha.startsWith(mes)),
    [ingresos, mes],
  );
  const balance = useMemo(
    () => balanceGeneral(gastosDelMes, ingresosDelMes),
    [gastosDelMes, ingresosDelMes],
  );
  const endeudamiento = useMemo(
    () => calcularEndeudamiento(deudas, balance.totalIngresos),
    [deudas, balance.totalIngresos],
  );
  const recomendaciones = useMemo(
    () =>
      generarRecomendaciones({
        mes,
        gastos,
        ingresos,
        categorias,
        cuentas,
        endeudamiento,
      }),
    [mes, gastos, ingresos, categorias, cuentas, endeudamiento],
  );

  // --- handlers: todos recargan al final porque triggers en la base de
  // datos ajustan `cuentas.disponible` server-side (ver migración de
  // finanzas completas), así que el estado local no puede calcularlo solo.
  async function handleCrearGasto(input: Omit<Gasto, "id" | "createdAt">) {
    await crearGasto(input);
    await recargar();
  }
  async function handleActualizarGasto(id: string, cambios: CambiosGasto) {
    await actualizarGasto(id, cambios);
    await recargar();
  }
  async function handleEliminarGasto(id: string) {
    await eliminarGasto(id);
    await recargar();
  }
  async function handleImportarGastos(
    inputs: Omit<Gasto, "id" | "createdAt">[],
  ) {
    // Secuencial (no Promise.all): varias filas pueden compartir la misma
    // cuenta, y los triggers que ajustan `cuentas.disponible` no son seguros
    // ante inserts concurrentes sobre la misma fila.
    for (const input of inputs) {
      await crearGasto(input);
    }
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
    try {
      await eliminarCuenta(id);
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }
  async function handleRegistrarPago(
    cuentaId: string,
    monto: number,
    cuentaOrigenId?: string,
  ) {
    await registrarPagoTarjeta({
      cuentaId,
      cuentaOrigenId,
      monto,
      fecha: new Date().toISOString().slice(0, 10),
    });
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
    input: Omit<Recordatorio, "id" | "createdAt" | "completado">,
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
  async function handleCrearCategoria(input: {
    nombre: string;
    color: string;
    tipo: TipoCategoria;
  }) {
    await crearCategoria(input);
    await recargar();
  }
  async function handleActualizarCategoria(
    id: string,
    cambios: { nombre: string; color: string },
  ) {
    await actualizarCategoria(id, cambios);
    await recargar();
  }
  async function handleEliminarCategoria(id: string) {
    await eliminarCategoria(id);
    await recargar();
  }

  // BOTÓN TEMPORAL DE DESARROLLO — ver usecases/eliminarTodosLosDatos.ts.
  // Quitar este handler y el botón que lo llama antes de un lanzamiento real.
  const [borrandoTodo, setBorrandoTodo] = useState(false);
  async function handleBorrarTodo() {
    const confirmado = window.confirm(
      "¿Borrar TODOS tus datos (gastos, ingresos, cuentas, deudas, recordatorios, pagos y categorías propias)? Esto no se puede deshacer.",
    );
    if (!confirmado) return;
    setBorrandoTodo(true);
    try {
      await eliminarTodosLosDatos();
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBorrandoTodo(false);
    }
  }

  return (
    <div className="shell ui-with-dock">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={28} />
          <span>Gastos App</span>
        </div>
        <nav aria-label="Navegación principal">
          <AnimatedBackground value={tab} className="nav">
            {TABS.map((t) => {
              const Icono = t.icono;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-selection-id={t.id}
                  style={{ background: "transparent" }}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`nav-item ${tab === t.id ? "nav-item-activo" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icono />
                  {t.etiqueta}
                </button>
              );
            })}
          </AnimatedBackground>
        </nav>
        <RippleButton
          className="btn nav-salir"
          style={{
            marginBottom: 8,
            color: "var(--color-danger)",
            borderColor: "var(--color-danger-bg)",
          }}
          onClick={handleBorrarTodo}
          disabled={borrandoTodo}
          title="Botón temporal de desarrollo: borra todos tus datos"
        >
          🗑️ {borrandoTodo ? "Borrando…" : "Borrar todo (temporal)"}
        </RippleButton>
      </aside>

      <main className="main">
        <header className="topbar">
          <TituloAnimado
            texto={TABS.find((t) => t.id === tab)?.etiqueta ?? ""}
          />
          {(tab === "resumen" || tab === "gastos" || tab === "ingresos") && (
            <div className="topbar-acciones">
              <input
                aria-label="Mes de los movimientos"
                type="month"
                className="input"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
            </div>
          )}
        </header>

        <div className="contenedor" id="contenido-principal">
          {avisoSesion && (
            <p role="alert" className="error" style={{ marginBottom: 16 }}>
              {avisoSesion}
            </p>
          )}
          {error && (
            <p className="error" style={{ marginBottom: 16 }}>
              Error: {error}
            </p>
          )}

          {cargando ? (
            <PanelCargando />
          ) : (
            <BlurFade key={tab}>
              {tab === "resumen" && (
                <Resumen
                  balance={balance}
                  endeudamiento={endeudamiento}
                  recomendaciones={recomendaciones}
                  gastos={gastos}
                  ingresos={ingresos}
                  categorias={categorias}
                  correoUsuario={session?.user.email ?? ""}
                />
              )}
              {tab === "ingresos" && (
                <Ingresos
                  mes={mes}
                  ingresos={ingresos}
                  cuentas={cuentas}
                  categorias={categorias}
                  onCrear={handleCrearIngreso}
                  onEliminar={handleEliminarIngreso}
                />
              )}
              {tab === "gastos" && (
                <Gastos
                  mes={mes}
                  gastos={gastos}
                  categorias={categorias}
                  cuentas={cuentas}
                  onCrear={handleCrearGasto}
                  onActualizar={handleActualizarGasto}
                  onEliminar={handleEliminarGasto}
                  onImportarVarios={handleImportarGastos}
                />
              )}
              {tab === "tarjetas" && (
                <Tarjetas
                  cuentas={cuentas}
                  gastos={gastos}
                  pagosTarjeta={pagosTarjeta}
                  ingresos={ingresos}
                  categorias={categorias}
                  onCrear={handleCrearCuenta}
                  onEliminar={handleEliminarCuenta}
                  onRegistrarPago={handleRegistrarPago}
                  onCrearGasto={handleCrearGasto}
                />
              )}
              {tab === "cuentas" && (
                <Cuentas
                  cuentas={cuentas}
                  gastos={gastos}
                  ingresos={ingresos}
                  categorias={categorias}
                  onCrear={handleCrearCuenta}
                  onEliminar={handleEliminarCuenta}
                  onCrearGasto={handleCrearGasto}
                  onCrearIngreso={handleCrearIngreso}
                />
              )}
              {tab === "deudas" && (
                <Deudas
                  deudas={deudas}
                  cuentas={cuentas}
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
              {tab === "categorias" && (
                <Categorias
                  categorias={categorias}
                  onCrear={handleCrearCategoria}
                  onActualizar={handleActualizarCategoria}
                  onEliminar={handleEliminarCategoria}
                />
              )}
            </BlurFade>
          )}
        </div>
      </main>
      <Dock
        items={TABS.slice(0, 4).map((item) => ({
          id: item.id,
          etiqueta: item.etiqueta,
          icono: <item.icono />,
        }))}
        moreItems={TABS.slice(4).map((item) => ({
          id: item.id,
          etiqueta: item.etiqueta,
          icono: <item.icono />,
        }))}
        value={tab}
        onChange={(id) => {
          if (TABS.some((item) => item.id === id)) setTab(id as Tab);
        }}
      />
    </div>
  );
}
