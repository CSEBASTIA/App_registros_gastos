import type { MovimientoCuenta } from "core";
import { IconoFlechaArriba, IconoGastos } from "./iconos";

export default function ItemMovimiento({ item }: { item: MovimientoCuenta }) {
  // `sentido` dice si suma o resta (un pago enviado o un abono resta aunque no sea "gasto").
  const esIngreso = item.sentido ? item.sentido === "entrada" : item.tipo !== "gasto";
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
