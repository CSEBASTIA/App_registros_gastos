/** Mismos tokens de color que `apps/desktop/src/index.css` (`:root`), para que mobile se vea consistente con desktop. */
export const color = {
  bg: "#f3f4f8",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#1a1c23",
  textMuted: "#6b7280",
  primary: "#3b6ff2",
  primaryBg: "#eef2ff",
  danger: "#e0453f",
  dangerBg: "#fdecec",
  success: "#16a34a",
  successBg: "#eafbf1",
  warning: "#b8790a",
  warningBg: "#fdf4e6",
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const spacing = (n: number) => n * 4;
