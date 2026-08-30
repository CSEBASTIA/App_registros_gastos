import type { ReactNode } from "react";

export default function EstadoVacio({
  icono,
  titulo,
  subtitulo,
}: {
  icono: ReactNode;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio-icono">{icono}</div>
      <p className="estado-vacio-titulo">{titulo}</p>
      {subtitulo && <p className="estado-vacio-subtitulo">{subtitulo}</p>}
    </div>
  );
}
