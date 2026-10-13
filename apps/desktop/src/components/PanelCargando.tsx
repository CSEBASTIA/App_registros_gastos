/**
 * Esqueleto de carga con la forma real del Resumen (hero + columna principal
 * + columna lateral). Reemplaza el "Cargando…" suelto que había antes: al
 * llegar los datos el contenido cae en el mismo sitio donde estaba el
 * esqueleto, sin el salto de layout de pasar de una línea de texto a la
 * pantalla completa.
 */
export default function PanelCargando() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="vacio-lector">Cargando tus datos…</span>
      <div className="esqueleto esqueleto-hero" />
      <div className="resumen-grid">
        <div className="resumen-grid-principal">
          <div className="esqueleto esqueleto-panel" />
          <div className="esqueleto esqueleto-panel" style={{ height: 140 }} />
        </div>
        <div className="card">
          <div className="esqueleto esqueleto-linea" style={{ width: "45%", marginBottom: 20 }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="esqueleto esqueleto-linea" style={{ width: `${90 - i * 12}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
