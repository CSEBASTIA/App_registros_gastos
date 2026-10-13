interface Props {
  porcentaje: number; // 0-100
  color?: string;
}

export default function BarraProgreso({ porcentaje, color }: Props) {
  const valor = Math.min(100, Math.max(0, porcentaje));
  const colorFinal =
    color ??
    (valor >= 80
      ? "var(--color-danger)"
      : valor >= 50
        ? "var(--color-warning)"
        : "var(--color-success)");

  return (
    <div className="barra-progreso">
      <div className="barra-progreso-relleno" style={{ width: `${valor}%`, background: colorFinal }} />
    </div>
  );
}
