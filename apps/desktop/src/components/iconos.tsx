import type { SVGProps } from "react";

/**
 * Set de íconos propio (SVG en línea, trazo simple) — nada de imágenes
 * externas ni marcas registradas, solo formas genéricas consistentes con
 * el resto de la interfaz.
 */
type Props = SVGProps<SVGSVGElement>;

function base(props: Props) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconoResumen(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M3 13.5 12 4l9 9.5" />
      <path d="M5.5 11.5V20a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21h3.5a1 1 0 0 0 1-1v-8.5" />
    </svg>
  );
}

export function IconoGastos(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M8.5 13h7M8.5 16.5h5" />
    </svg>
  );
}

export function IconoIngresos(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 16.5 10 10l4 4 6.5-7.5" />
      <path d="M15 6h5.5v5.5" />
    </svg>
  );
}

export function IconoTarjetas(props: Props) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
      <path d="M2.5 9.5h19" />
      <path d="M6 15h4" />
    </svg>
  );
}

export function IconoDeudas(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoRecordatorios(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M6 8.5a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 12.5 6 8.5Z" />
      <path d="M10 19a2.1 2.1 0 0 0 4 0" />
    </svg>
  );
}

export function IconoCategorias(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M11.5 3.5h-5A1.5 1.5 0 0 0 5 5v5c0 .4.16.78.44 1.06l8 8a1.5 1.5 0 0 0 2.12 0l5-5a1.5 1.5 0 0 0 0-2.12l-8-8a1.5 1.5 0 0 0-1.06-.44Z" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoSalir(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" />
      <path d="M14 16.5 19 12l-5-4.5" />
      <path d="M19 12H9" />
    </svg>
  );
}

export function IconoPapelera(props: Props) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconoCamara(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}

export function IconoMas(props: Props) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconoSubir(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

export function IconoCampana(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M6 8.5a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 12.5 6 8.5Z" />
      <path d="M10 19a2.1 2.1 0 0 0 4 0" />
    </svg>
  );
}

export function IconoFlechaArriba(props: Props) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

export function IconoFlechaAbajo(props: Props) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </svg>
  );
}

export function IconoChip(props: Props) {
  return (
    <svg {...base({ width: 26, height: 20, strokeWidth: 1.4, ...props })} viewBox="0 0 26 20">
      <rect x="1" y="1" width="24" height="18" rx="3.5" />
      <path d="M9 1v18M17 1v18M1 7h5M20 7h5M1 13h5M20 13h5" />
    </svg>
  );
}

export function IconoContactless(props: Props) {
  return (
    <svg {...base({ width: 18, height: 18, strokeWidth: 1.6, ...props })} viewBox="0 0 24 24">
      <path d="M8.5 8.8a5 5 0 0 1 0 6.4" />
      <path d="M12 5.8a9 9 0 0 1 0 12.4" />
      <path d="M15.5 2.8a13 13 0 0 1 0 18.4" />
    </svg>
  );
}

export function IconoAlcancia(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 13a6 6 0 0 1 6-6h2.5a5 5 0 0 1 4.9 4h1.1a1 1 0 0 1 1 1.2l-.4 1.6a1 1 0 0 1-1 .8H18v1.5a1.5 1.5 0 0 1-1.5 1.5H15v1.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V18H9v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1.6A5 5 0 0 1 4 13Z" />
      <path d="M8 7V5.3" />
      <circle cx="9.2" cy="10.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoFactura(props: Props) {
  return (
    <svg {...base({ width: 17, height: 17, ...props })}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M8.5 12.5h7M8.5 16h4.5" />
    </svg>
  );
}

export function IconoWallet(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H18a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 18 19H5.5A1.5 1.5 0 0 1 4 17.5Z" />
      <path d="M4 10h14.5a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 1-1.5 1.5H16a1.8 1.8 0 0 1 0-3.6h3" />
    </svg>
  );
}
