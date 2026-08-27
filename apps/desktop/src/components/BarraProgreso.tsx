interface Props {
  porcentaje: number; // 0-100
  color?: string;
}

export default function BarraProgreso({ porcentaje, color }: Props) {
  const valor = Math.min(100, Math.max(0, porcentaje));
  const colorFinal = color ?? (valor >= 80 ? "#e0453f" : valor >= 50 ? "#e0a53f" : "#22c55e");

  return (
    <div className="barra-progreso">
      <div className="barra-progreso-relleno" style={{ width: `${valor}%`, background: colorFinal }} />
    </div>
  );
}
