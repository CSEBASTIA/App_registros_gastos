import { useEffect } from "react";
import { initializeTheme } from "../components/ThemeToggler";

const SELECTOR_SPOTLIGHT = ".card, .tarjeta-visual, .cuenta-visual, .tarjeta-visual-imagen-cont";
const SELECTOR_RIPPLE = ".btn-primary, .ui-ripple-button";

/**
 * Motion delegado a nivel de documento para dos patrones del skill
 * distinctive-web-motion: "magic card" (spotlight que sigue al puntero) y
 * "ripple button" (feedback de clic en botones primarios).
 *
 * Se implementa con un solo listener en vez de tocar cada vista porque:
 * - escribe variables CSS directamente en el elemento (sin re-render de
 *   React en cada movimiento del mouse, como pide el checklist del skill);
 * - las clases (.card, .tarjeta-visual, .cuenta-visual, .btn-primary) ya
 *   existen en todas las vistas, así que no hace falta editarlas.
 *
 * Se respeta prefers-reduced-motion y se limita a punteros finos (mouse),
 * nunca a touch.
 */
export function useInterfazMotion() {
  useEffect(() => {
    initializeTheme();
    const mqlReducida = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqlPunteroFino = window.matchMedia("(hover: hover) and (pointer: fine)");

    function onPointerMove(e: PointerEvent) {
      if (mqlReducida.matches || !mqlPunteroFino.matches) return;
      const objetivo = (e.target as HTMLElement | null)?.closest<HTMLElement>(SELECTOR_SPOTLIGHT);
      if (!objetivo) return;
      const rect = objetivo.getBoundingClientRect();
      objetivo.style.setProperty("--magic-x", `${e.clientX - rect.left}px`);
      objetivo.style.setProperty("--magic-y", `${e.clientY - rect.top}px`);
    }

    function onPointerDown(e: PointerEvent) {
      if (mqlReducida.matches) return;
      const boton = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(SELECTOR_RIPPLE);
      if (!boton || boton.disabled) return;
      boton.querySelectorAll(".ripple").forEach(node => node.remove());
      const rect = boton.getBoundingClientRect();
      const lado = Math.max(rect.width, rect.height) * 1.6;
      const circulo = document.createElement("span");
      circulo.className = "ripple";
      circulo.style.width = `${lado}px`;
      circulo.style.height = `${lado}px`;
      circulo.style.left = `${e.clientX - rect.left - lado / 2}px`;
      circulo.style.top = `${e.clientY - rect.top - lado / 2}px`;
      boton.appendChild(circulo);
      circulo.addEventListener("animationend", () => circulo.remove(), { once: true });
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);
}
