import { useState } from "react";

export interface BarraDato {
  etiqueta: string;
  valor: number;
  color: string;
}

interface Leyenda {
  etiqueta: string;
  color: string;
}

/**
 * Gráfico de barras "estilo hoja de cálculo": ejes visibles (líneas de
 * referencia horizontales con su valor, etiquetas de categoría abajo),
 * valor sobre cada barra, tooltip al pasar el mouse, sin degradados ni
 * efectos 3D. `titulo`/`leyenda` son opcionales (para el caso de una sola
 * serie, tipo "Ingresos por mes" con un cuadro de leyenda al lado).
 */
export default function GraficoBarras({
  datos,
  alto = 240,
  titulo,
  leyenda,
  mensajeVacio = "Sin datos en este período.",
}: {
  datos: BarraDato[];
  alto?: number;
  titulo?: string;
  leyenda?: Leyenda;
  mensajeVacio?: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);

  const cuerpo =
    datos.length === 0 ? (
      <div className="grafico-barras-vacio" style={{ height: alto }}>
        {mensajeVacio}
      </div>
    ) : (
      (() => {
        const maximo = Math.max(...datos.map((d) => d.valor), 1);
        const lineas = [0, 0.25, 0.5, 0.75, 1];
        return (
          <div className="grafico-barras">
            <div className="grafico-barras-lienzo" style={{ height: alto }}>
              {lineas.map((f) => (
                <div key={f} className="grafico-barras-linea" style={{ bottom: `${f * 100}%` }}>
                  <span>${(maximo * f).toFixed(0)}</span>
                </div>
              ))}
              <div className="grafico-barras-barras">
                {datos.map((d, i) => (
                  <div
                    key={d.etiqueta}
                    className="grafico-barras-columna"
                    onMouseEnter={() => setActivo(i)}
                    onMouseLeave={() => setActivo(null)}
                  >
                    {activo === i && (
                      <div className="grafico-barras-tooltip">
                        {d.etiqueta}: ${d.valor.toFixed(2)}
                      </div>
                    )}
                    <span className="grafico-barras-valor">${d.valor.toFixed(0)}</span>
                    <div
                      className="grafico-barras-barra"
                      style={{ height: `${(d.valor / maximo) * 100}%`, background: d.color }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="grafico-barras-etiquetas">
              {datos.map((d) => (
                <span key={d.etiqueta} title={d.etiqueta}>
                  {d.etiqueta}
                </span>
              ))}
            </div>
          </div>
        );
      })()
    );

  if (!titulo && !leyenda) return cuerpo;

  return (
    <div className="grafico-barras-contenedor">
      {titulo && <h4 className="grafico-barras-titulo">{titulo}</h4>}
      <div className="grafico-barras-cuerpo">
        <div style={{ flex: 1, minWidth: 0 }}>{cuerpo}</div>
        {leyenda && (
          <div className="grafico-barras-leyenda">
            <span className="grafico-barras-leyenda-punto" style={{ background: leyenda.color }} />
            {leyenda.etiqueta}
          </div>
        )}
      </div>
    </div>
  );
}
