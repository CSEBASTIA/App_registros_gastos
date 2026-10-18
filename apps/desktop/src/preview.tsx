// ARCHIVO TEMPORAL DE VERIFICACIÓN VISUAL — se borra al terminar.
import ReactDOM from "react-dom/client";
import type { Categoria, Gasto, Ingreso } from "core";
import Resumen from "./views/Resumen";
import TituloAnimado from "./components/TituloAnimado";
import Logo from "./components/Logo";
import GradienteAnimado from "./components/GradienteAnimado";
import PanelCargando from "./components/PanelCargando";
import { useInterfazMotion } from "./lib/interfazMotion";
import {
  IconoResumen,
  IconoGastos,
  IconoIngresos,
  IconoTarjetas,
  IconoWallet,
  IconoDeudas,
  IconoRecordatorios,
  IconoCategorias,
  IconoSalir,
} from "./components/iconos";
import "./index.css";

const categorias: Categoria[] = [
  { id: "c1", nombre: "Comida", color: "#c23b34", tipo: "gasto" },
  { id: "c2", nombre: "Transporte", color: "#a5690a", tipo: "gasto" },
  { id: "c3", nombre: "Servicios", color: "#3552d1", tipo: "gasto" },
  { id: "c4", nombre: "Sueldo", color: "#157a4b", tipo: "ingreso" },
];

const hoy = new Date();
const dia = (n: number) => {
  const f = new Date(hoy);
  f.setDate(hoy.getDate() - n);
  return f.toISOString().slice(0, 10);
};

const gastos: Gasto[] = [
  { id: "g1", monto: 1284.4, descripcion: "Supermaxi quincena", categoriaId: "c1", fecha: dia(0), createdAt: dia(0) },
  { id: "g2", monto: 42.9, descripcion: "Gasolina", categoriaId: "c2", fecha: dia(1), createdAt: dia(1) },
  { id: "g3", monto: 318.75, descripcion: "Luz y agua", categoriaId: "c3", fecha: dia(2), createdAt: dia(2) },
  { id: "g4", monto: 9.5, descripcion: "Café", categoriaId: "c1", fecha: dia(3), createdAt: dia(3) },
  { id: "g5", monto: 76.2, descripcion: "Taxi aeropuerto", categoriaId: "c2", fecha: dia(4), createdAt: dia(4) },
  { id: "g6", monto: 155.0, descripcion: "Internet", categoriaId: "c3", fecha: dia(6), createdAt: dia(6) },
];

const ingresos: Ingreso[] = [
  { id: "i1", monto: 2400.0, descripcion: "Sueldo septiembre", categoriaId: "c4", fecha: dia(5), createdAt: dia(5) },
];

const balance = {
  totalIngresos: 2400,
  totalGastos: 1886.75,
  balance: 513.25,
};

const endeudamiento = {
  totalPendiente: 4200,
  cuotasMensuales: 820,
  porcentaje: 34.2,
  nivel: "moderado" as const,
};

const recomendaciones = [
  { mensaje: "Comida se llevó el 68% de tus gastos esta semana.", severidad: "alerta" as const },
  { mensaje: "Llevas 3 meses seguidos con balance positivo.", severidad: "info" as const },
];

const TABS = [
  { id: "resumen", etiqueta: "Resumen", icono: IconoResumen },
  { id: "ingresos", etiqueta: "Ingresos", icono: IconoIngresos },
  { id: "gastos", etiqueta: "Gastos", icono: IconoGastos },
  { id: "tarjetas", etiqueta: "Tarjetas", icono: IconoTarjetas },
  { id: "cuentas", etiqueta: "Cuentas", icono: IconoWallet },
  { id: "deudas", etiqueta: "Deudas", icono: IconoDeudas },
  { id: "recordatorios", etiqueta: "Recordatorios", icono: IconoRecordatorios },
  { id: "categorias", etiqueta: "Categorías", icono: IconoCategorias },
];

function Vista() {
  useInterfazMotion();
  const vista = new URLSearchParams(location.search).get("v") ?? "dashboard";

  if (vista === "cargando") {
    return (
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <Logo size={28} />
            <span>fintrack</span>
          </div>
          <nav className="nav">
            {TABS.map((t) => {
              const Icono = t.icono;
              return (
                <button key={t.id} className={`nav-item ${t.id === "resumen" ? "nav-item-activo" : ""}`}>
                  <Icono />
                  {t.etiqueta}
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="main">
          <header className="topbar">
            <TituloAnimado texto="Resumen" />
          </header>
          <div className="contenedor">
            <PanelCargando />
          </div>
        </div>
      </div>
    );
  }

  if (vista === "login") {
    return (
      <main className="login-wrap">
        <section className="login-arte">
          <GradienteAnimado colores={["#3552d1", "#2941ac", "#5f7ae8"]} velocidad={26} desenfoque="fuerte" />
          <div className="login-arte-marca">
            <Logo size={30} />
            <span>fintrack</span>
          </div>
          <p className="login-arte-frase">Tus gastos, ingresos y tarjetas en un solo lugar</p>
        </section>
        <section className="login-formulario">
          <form className="card login-card">
            <h1>Ingresa a tu cuenta</h1>
            <div className="campo">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" defaultValue="sebas@ejemplo.com" />
            </div>
            <div className="campo">
              <label htmlFor="password">Contraseña</label>
              <input id="password" className="input" type="password" defaultValue="secreto123" />
            </div>
            <button type="button" className="btn btn-primary">
              Ingresar
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={28} />
          <span>fintrack</span>
        </div>
        <nav className="nav">
          {TABS.map((t) => {
            const Icono = t.icono;
            return (
              <button key={t.id} className={`nav-item ${t.id === "resumen" ? "nav-item-activo" : ""}`}>
                <Icono />
                {t.etiqueta}
              </button>
            );
          })}
        </nav>
        <button className="btn nav-salir">
          <IconoSalir />
          Salir
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <TituloAnimado texto="Resumen" />
          <div className="topbar-acciones">
            <input type="month" className="input" defaultValue="2026-09" />
          </div>
        </header>
        <div className="contenedor">
          <Resumen
            balance={balance}
            efectivo={{
              totalIngresos: balance.totalIngresos,
              gastadoConTuDinero: balance.totalGastos,
              conTarjeta: 0,
              pagosTarjeta: 0,
              efectivoNeto: balance.balance,
            }}
            endeudamiento={endeudamiento}
            recomendaciones={recomendaciones}
            gastos={gastos}
            ingresos={ingresos}
            categorias={categorias}
          />
          <div className="card" style={{ padding: 0, marginTop: 24 }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th className="tabla-monto">Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => {
                  const c = categorias.find((x) => x.id === g.categoriaId)!;
                  return (
                    <tr key={g.id}>
                      <td>{g.fecha}</td>
                      <td>{g.descripcion}</td>
                      <td>
                        <span className="categoria-tag">
                          <span className="categoria-punto" style={{ background: c.color }} />
                          {c.nombre}
                        </span>
                      </td>
                      <td className="tabla-monto">${g.monto.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Vista />);
