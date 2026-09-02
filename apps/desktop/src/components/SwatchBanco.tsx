import type { Banco } from "core";
import { ETIQUETA_BANCO } from "core";
import { logoDeBanco } from "../lib/logosBanco";

/**
 * Botón selector de banco: logo real si existe, si no cae al color/degradado
 * de respaldo + nombre. `colorFondo` es ese respaldo — cada formulario pasa
 * el suyo (degradado de tarjeta vs. color sólido de cuenta).
 */
export default function SwatchBanco({
  banco,
  colorFondo,
  seleccionado,
  onClick,
}: {
  banco: Banco;
  colorFondo: string;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const logo = logoDeBanco(banco);

  return (
    <button
      type="button"
      className={`swatch-banco ${seleccionado ? "swatch-banco-activo" : ""} ${logo ? "swatch-banco-logo" : ""}`}
      style={logo ? undefined : { background: colorFondo }}
      onClick={onClick}
      title={ETIQUETA_BANCO[banco]}
    >
      {logo ? <img src={logo} alt={ETIQUETA_BANCO[banco]} /> : ETIQUETA_BANCO[banco]}
    </button>
  );
}
