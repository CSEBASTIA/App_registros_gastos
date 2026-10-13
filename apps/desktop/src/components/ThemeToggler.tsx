import { useEffect, useState, type MouseEvent } from "react";

type Mode = "light" | "dark";
const KEY = "gastos-app:visual-theme";
export function initializeTheme(): Mode {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* Visual preferences work without storage. */ }
  const mode = saved === "light" || saved === "dark" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = mode;
  return mode;
}

export default function ThemeToggler() {
  const [mode, setMode] = useState<Mode>(() => initializeTheme());
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => initializeTheme();
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => { observer.disconnect(); media.removeEventListener("change", sync); window.removeEventListener("storage", sync); };
  }, []);
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = mode === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      setMode(next);
      try { localStorage.setItem(KEY, next); } catch { /* In-memory fallback. */ }
    };
    const doc = document as Document & { startViewTransition?: (callback: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
    const { clientX: x, clientY: y } = event;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = doc.startViewTransition(apply);
    transition.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 300, easing: "ease-out", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
  }
  return <button type="button" className="ui-theme-toggle" onClick={toggle} aria-label={`Activar tema ${mode === "dark" ? "claro" : "oscuro"}`} aria-pressed={mode === "dark"}>
    <span aria-hidden="true">{mode === "dark" ? "☾" : "☀"}</span><span>Tema {mode === "dark" ? "oscuro" : "claro"}</span>
  </button>;
}
