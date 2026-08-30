export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradiente" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b6ff2" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logo-gradiente)" />
      <path
        d="M10 15.5A2.5 2.5 0 0 1 12.5 13H27a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 27 29H12.5A2.5 2.5 0 0 1 10 26.5Z"
        stroke="#fff"
        strokeWidth="1.8"
      />
      <path
        d="M10 18.5h17.5a2.5 2.5 0 0 1 2.5 2.5v2.2a2.5 2.5 0 0 1-2.5 2.5h-4a3 3 0 0 1 0-6h4.5"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
