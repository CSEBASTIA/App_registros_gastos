import { useState } from "react";
import type { Cuenta } from "core";
import { COLOR_CUENTA_BANCO, cssGradiente, ETIQUETA_BANCO, ETIQUETA_MARCA, GRADIENTE_BANCO, TEXTO_CUENTA_BANCO } from "core";
import { imagenDe, productoDe } from "../lib/catalogoTarjetas";
import { IconoAlcancia, IconoChip, IconoContactless, IconoOjo, IconoOjoCerrado, IconoTarjetas, IconoWallet } from "./iconos";
import BarraProgreso from "./BarraProgreso";
import { formatMonto } from "core";

const ICONO_TIPO_CUENTA: Record<Cuenta["tipo"], (props: { className?: string }) => JSX.Element> = {
  credito: IconoTarjetas,
  debito: IconoTarjetas,
  ahorro: IconoAlcancia,
  efectivo: IconoWallet,
};

export default function TarjetaVisual({
  cuenta,
  seleccionada,
  compacta,
  onClick,
}: {
  cuenta: Cuenta;
  seleccionada?: boolean;
  compacta?: boolean;
  onClick?: () => void;
}) {
  if (cuenta.tipo !== "credito") {
    return <CuentaVisual cuenta={cuenta} seleccionada={seleccionada} compacta={compacta} onClick={onClick} />;
  }

  const usoPorcentaje = cuenta.cupoTotal
    ? ((cuenta.cupoTotal - cuenta.disponible) / cuenta.cupoTotal) * 100
    : undefined;

  const imagen = imagenDe(cuenta.estilo);
  const producto = productoDe(cuenta.estilo);

  if (imagen) {
    const clasesImagen = [
      "tarjeta-visual-imagen-cont",
      compacta ? "tarjeta-visual-compacta-imagen" : "",
      seleccionada ? "tarjeta-visual-seleccionada" : "",
      onClick ? "tarjeta-visual-clicable" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className={clasesImagen}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        title={producto?.nombre}
      >
        <img className="tarjeta-visual-imagen-foto" src={imagen} alt={producto?.nombre ?? cuenta.nombre} />
        <div className="tarjeta-visual-imagen-info">
          <span className="tarjeta-visual-imagen-nombre">{cuenta.nombre}</span>
          {!compacta && (
            <>
              <span className="tarjeta-visual-imagen-tipo">{producto?.nombre ?? "Tarjeta de crédito"}</span>
              {cuenta.cupoTotal ? (
                <div className="tarjeta-visual-imagen-cupo">
                  <div className="tarjeta-visual-cupo-linea">
                    <span>Disponible</span>
                    <span>
                      {formatMonto(cuenta.disponible)} / {formatMonto(cuenta.cupoTotal)}
                    </span>
                  </div>
                  <BarraProgreso porcentaje={usoPorcentaje ?? 0} />
                </div>
              ) : (
                <span className="tarjeta-visual-imagen-tipo">{formatMonto(cuenta.disponible)}</span>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const clases = [
    "tarjeta-visual",
    compacta ? "tarjeta-visual-compacta" : "",
    seleccionada ? "tarjeta-visual-seleccionada" : "",
    onClick ? "tarjeta-visual-clicable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={clases}
      style={{ background: cssGradiente(GRADIENTE_BANCO[cuenta.banco]) }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="tarjeta-visual-header">
        <span className="tarjeta-visual-banco">{ETIQUETA_BANCO[cuenta.banco]}</span>
        <IconoContactless />
      </div>

      <IconoChip className="tarjeta-visual-chip" />

      <div className="tarjeta-visual-nombre">{cuenta.nombre}</div>
      <div className="tarjeta-visual-tipo">Tarjeta de crédito</div>

      {cuenta.cupoTotal ? (
        !compacta && (
          <div className="tarjeta-visual-cupo">
            <div className="tarjeta-visual-cupo-linea">
              <span>Disponible</span>
              <span>
                {formatMonto(cuenta.disponible)} / {formatMonto(cuenta.cupoTotal)}
              </span>
            </div>
            <BarraProgreso porcentaje={usoPorcentaje ?? 0} />
          </div>
        )
      ) : (
        <div className="tarjeta-visual-saldo">{formatMonto(cuenta.disponible)}</div>
      )}

      <div className="tarjeta-visual-footer">
        {cuenta.marca && <span className="tarjeta-visual-marca">{ETIQUETA_MARCA[cuenta.marca] || "Otra"}</span>}
      </div>
    </div>
  );
}

/** Cuentas de ahorro/débito/efectivo: banner horizontal en el color del banco (no son tarjeta de crédito, no tienen cupo). */
function CuentaVisual({
  cuenta,
  seleccionada,
  compacta,
  onClick,
}: {
  cuenta: Cuenta;
  seleccionada?: boolean;
  compacta?: boolean;
  onClick?: () => void;
}) {
  const Icono = ICONO_TIPO_CUENTA[cuenta.tipo];
  const [visible, setVisible] = useState(true);
  const clases = [
    "cuenta-visual",
    compacta ? "cuenta-visual-compacta" : "",
    seleccionada ? "tarjeta-visual-seleccionada" : "",
    onClick ? "tarjeta-visual-clicable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={clases}
      style={{ background: COLOR_CUENTA_BANCO[cuenta.banco], color: TEXTO_CUENTA_BANCO[cuenta.banco] }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="cuenta-visual-banco">{ETIQUETA_BANCO[cuenta.banco]}</span>

      <div className="cuenta-visual-cuerpo">
        <span className="cuenta-visual-icono">
          <Icono />
        </span>
        <div className="cuenta-visual-textos">
          <span className="cuenta-visual-nombre">{cuenta.nombre}</span>
          {!compacta && <span className="cuenta-visual-tipo">{etiquetaTipo(cuenta.tipo)}</span>}
        </div>
        {!compacta && (
          <div className="cuenta-visual-saldo">
            <span className="cuenta-visual-saldo-etiqueta">Saldo disponible</span>
            <div className="cuenta-visual-saldo-linea">
              <span className="cuenta-visual-saldo-monto">
                {visible ? formatMonto(cuenta.disponible) : "••••••"}
              </span>
              <button
                type="button"
                className="cuenta-visual-ojo"
                title={visible ? "Ocultar saldo" : "Mostrar saldo"}
                onClick={(e) => {
                  e.stopPropagation();
                  setVisible((v) => !v);
                }}
              >
                {visible ? <IconoOjo /> : <IconoOjoCerrado />}
              </button>
            </div>
          </div>
        )}
      </div>
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
