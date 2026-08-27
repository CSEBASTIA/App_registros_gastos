import type { BalanceGeneral, Endeudamiento, Recomendacion } from "core";
import BarraProgreso from "../components/BarraProgreso";

interface Props {
  balance: BalanceGeneral;
  endeudamiento: Endeudamiento;
  recomendaciones: Recomendacion[];
}

export default function Resumen({ balance, endeudamiento, recomendaciones }: Props) {
  const esPositivo = balance.balance >= 0;

  return (
    <>
      <section className="resumen resumen-4">
        <div className="card">
          <span className="etiqueta">Ingresos del mes</span>
          <span className="valor">${balance.totalIngresos.toFixed(2)}</span>
        </div>
        <div className="card">
          <span className="etiqueta">Gastos del mes</span>
          <span className="valor">${balance.totalGastos.toFixed(2)}</span>
        </div>
        <div className={`card ${esPositivo ? "valor-positivo" : "valor-negativo"}`}>
          <span className="etiqueta">Balance</span>
          <span className="valor">{esPositivo ? "+" : ""}${balance.balance.toFixed(2)}</span>
        </div>
        <div className="card">
          <span className="etiqueta">Endeudamiento</span>
          <span className={`valor nivel-${endeudamiento.nivel}`}>{endeudamiento.porcentaje.toFixed(0)}%</span>
        </div>
      </section>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="tarjeta-visual-cupo-linea">
          <span>Nivel de endeudamiento</span>
          <span className={`nivel-${endeudamiento.nivel}`}>{etiquetaNivel(endeudamiento.nivel)}</span>
        </div>
        <BarraProgreso porcentaje={endeudamiento.porcentaje} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Recomendaciones</h3>
        {recomendaciones.length === 0 ? (
          <p className="vacio" style={{ padding: "16px 0" }}>
            Todavía no hay suficientes datos para darte recomendaciones.
          </p>
        ) : (
          <ul className="lista-recomendaciones">
            {recomendaciones.map((r, i) => (
              <li key={i} className={`recomendacion recomendacion-${r.severidad}`}>
                {r.mensaje}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function etiquetaNivel(nivel: Endeudamiento["nivel"]) {
  return nivel === "alto" ? "Alto" : nivel === "moderado" ? "Moderado" : "Bajo";
}
