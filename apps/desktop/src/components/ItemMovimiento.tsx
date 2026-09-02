import type { MovimientoCuenta } from "core";
import { IconoFlechaArriba, IconoGastos } from "./iconos";

export default function ItemMovimiento({ item }: { item: MovimientoCuenta }) {
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
