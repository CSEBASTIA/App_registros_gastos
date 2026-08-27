import type { Cuenta } from "core";
import { ETIQUETA_BANCO, ETIQUETA_MARCA, GRADIENTE_BANCO } from "../lib/marcas";
import BarraProgreso from "./BarraProgreso";

export default function TarjetaVisual({ cuenta }: { cuenta: Cuenta }) {
  const esCredito = cuenta.tipo === "credito";
  const usoPorcentaje =
    esCredito && cuenta.cupoTotal
      ? ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100
      : undefined;

  return (
    <div className="tarjeta-visual" style={{ background: GRADIENTE_BANCO[cuenta.banco] }}>
      <div className="tarjeta-visual-header">
        <span className="tarjeta-visual-banco">{ETIQUETA_BANCO[cuenta.banco]}</span>
        {cuenta.marca && (
          <span className="tarjeta-visual-marca">{ETIQUETA_MARCA[cuenta.marca] || "Otra"}</span>
        )}
      </div>
      <div className="tarjeta-visual-nombre">{cuenta.nombre}</div>
      <div className="tarjeta-visual-tipo">{etiquetaTipo(cuenta.tipo)}</div>

      {esCredito && cuenta.cupoTotal ? (
        <div className="tarjeta-visual-cupo">
          <div className="tarjeta-visual-cupo-linea">
            <span>Disponible</span>
            <span>${cuenta.disponible.toFixed(2)} / ${cuenta.cupoTotal.toFixed(2)}</span>
          </div>
          <BarraProgreso porcentaje={usoPorcentaje ?? 0} />
        </div>
      ) : (
        <div className="tarjeta-visual-saldo">${cuenta.disponible.toFixed(2)}</div>
      )}
    </div>
  );
}

function etiquetaTipo(tipo: Cuenta["tipo"]) {
  switch (tipo) {
    case "credito":
      return "Tarjeta de crédito";
    case "debito":
      return "Tarjeta de débito";
    case "ahorro":
      return "Cuenta de ahorros";
    case "efectivo":
      return "Efectivo";
  }
}
