import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export default function AnimatedBackground({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number }>();
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const selected = Array.from(root.querySelectorAll<HTMLElement>("[data-selection-id]")).find(node => node.dataset.selectionId === value);
      if (!selected) { setBox(undefined); return; }
      const parent = root.getBoundingClientRect();
      const rect = selected.getBoundingClientRect();
      setBox({ x: rect.left - parent.left + root.scrollLeft, y: rect.top - parent.top + root.scrollTop, width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-selection-id]").forEach(node => observer.observe(node));
    document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [value, children]);
  return <div ref={ref} className={`ui-selection ${className}`}>
    {box && <span aria-hidden="true" className="ui-selection-background" style={{ width: box.width, height: box.height, transform: `translate(${box.x}px, ${box.y}px)` }} />}
    {children}
  </div>;
}
