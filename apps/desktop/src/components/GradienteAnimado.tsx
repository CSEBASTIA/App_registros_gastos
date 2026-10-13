import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Desenfoque = "suave" | "medio" | "fuerte";

interface Props {
  /** Colores de los blobs. Uno por círculo; 3 o 4 alcanzan y sobran. */
  colores: string[];
  /** Duración de una vuelta completa, en segundos. Más alto = más calmado. */
  velocidad?: number;
  desenfoque?: Desenfoque;
  className?: string;
}

interface Blob {
  color: string;
  factorAncho: number;
  factorAlto: number;
  top: string;
  left: string;
  t: number[]; // tx1, ty1, tx2, ty2, tx3, ty3, tx4, ty4
}

/**
 * Puerto a React del bloque `animated-gradient-svg` de SV Animations
 * (https://sv-animations.vercel.app/f/animated-gradient-svg.json).
 *
 * El original es un componente Svelte 5 (runas `$props`/`$derived`) que se
 * instala con `shadcn-svelte` y depende de Tailwind y de un hook
 * `useDimensions`. Esta app es React + Vite + Tauri y no usa Tailwind, así
 * que instalarlo tal cual era imposible; lo que se conserva es el principio:
 * varios círculos SVG de colores, con tamaño y trayectoria pseudoaleatorias
 * pero deterministas, desplazándose bajo una capa de desenfoque para formar
 * un degradado que se mueve.
 *
 * Diferencias del puerto:
 * - `useDimensions` → un `ResizeObserver` local (mismo dato: ancho/alto del
 *   contenedor, que fija el diámetro de los círculos).
 * - clases `blur-2xl`/`blur-3xl` de Tailwind → la variable `--gradiente-blur`
 *   en index.css, para no meter Tailwind por un solo componente.
 * - la semilla se calcula igual (FNV-1a + mulberry32) para que el layout no
 *   salte entre renders ni entre recargas.
 *
 * Es decorativo: `aria-hidden` y `pointer-events: none`, y con
 * prefers-reduced-motion queda como un degradado quieto (ver index.css), no
 * desaparece, así que el contraste del texto encima no cambia.
 */
export default function GradienteAnimado({
  colores,
  velocidad = 12,
  desenfoque = "medio",
  className = "",
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState({ ancho: 0, alto: 0 });

  useEffect(() => {
    const nodo = contenedorRef.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      setMedidas({ ancho: width, alto: height });
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const blobs = useMemo<Blob[]>(
    () =>
      colores.map((color, i) => {
        const random = aleatorioConSemilla(hash(`${color}-${i}`));
        return {
          color,
          factorAncho: entre(random, 0.5, 1.5),
          factorAlto: entre(random, 0.5, 1.5),
          top: `${entre(random, 0, 50)}%`,
          left: `${entre(random, 0, 50)}%`,
          t: Array.from({ length: 8 }, () => entre(random, -0.5, 0.5)),
        };
      }),
    [colores]
  );

  // Diámetro base: el lado mayor del contenedor, para que un solo círculo
  // pueda cubrirlo entero y no se vean bordes duros al desplazarse.
  const diametro = Math.max(medidas.ancho, medidas.alto);

  return (
    <div ref={contenedorRef} className={`gradiente-animado ${className}`.trim()} aria-hidden="true">
      <div className={`gradiente-animado-capa gradiente-animado-${desenfoque}`}>
        {diametro > 0 &&
          blobs.map((blob, i) => (
            <svg
              key={i}
              viewBox="0 0 100 100"
              width={diametro * blob.factorAncho}
              height={diametro * blob.factorAlto}
              style={
                {
                  top: blob.top,
                  left: blob.left,
                  animationDuration: `${velocidad}s`,
                  "--tx-1": blob.t[0],
                  "--ty-1": blob.t[1],
                  "--tx-2": blob.t[2],
                  "--ty-2": blob.t[3],
                  "--tx-3": blob.t[4],
                  "--ty-3": blob.t[5],
                  "--tx-4": blob.t[6],
                  "--ty-4": blob.t[7],
                } as CSSProperties
              }
            >
              <circle cx="50" cy="50" r="50" fill={blob.color} />
            </svg>
          ))}
      </div>
    </div>
  );
}

/** FNV-1a: mismo hash que el componente original, para la misma semilla. */
function hash(valor: string) {
  let h = 2166136261;
  for (let i = 0; i < valor.length; i++) {
    h ^= valor.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: PRNG determinista a partir de la semilla. */
function aleatorioConSemilla(semilla: number) {
  return () => {
    semilla += 0x6d2b79f5;
    let t = semilla;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function entre(random: () => number, min: number, max: number) {
  return min + (max - min) * random();
}
