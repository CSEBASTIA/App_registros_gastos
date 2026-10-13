import { useMemo } from "react";

/**
 * Patrón "Text Animate" del skill distinctive-web-motion: revela el título
 * de la barra superior palabra por palabra al cambiar de pestaña.
 *
 * - `key={texto}` fuerza a React a desmontar/montar el <h1> cuando cambia
 *   el texto (cambiar solo el contenido de los spans no reiniciaría la
 *   animación CSS), así se repite en cada cambio de pestaña.
 * - El <h1> lleva el texto completo como aria-label; los spans visuales
 *   están aria-hidden, así un lector de pantalla escucha la frase una sola
 *   vez y no palabra por palabra.
 */
export default function TituloAnimado({ texto }: { texto: string }) {
  const palabras = useMemo(() => texto.split(" "), [texto]);

  return (
    <h1 className="titulo-animado" aria-label={texto} key={texto}>
      {palabras.map((palabra, i) => (
        <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 55}ms` }}>
          {palabra}
        </span>
      ))}
    </h1>
  );
}
