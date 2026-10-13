import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import AnimatedBackground from "./AnimatedBackground";
import ThemeToggler from "./ThemeToggler";
export interface DockItem { id: string; etiqueta: string; icono: ReactNode; badge?: number; }
export default function Dock({ items, value, onChange, moreItems = [] }: { items: DockItem[]; value: string; onChange: (id: string) => void; moreItems?: DockItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const moreActive = moreItems.some(item => item.id === value);
  useEffect(() => {
    if (!expanded) return;
    root.current?.querySelector<HTMLButtonElement>(".ui-dock-panel button")?.focus();
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setExpanded(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setExpanded(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [expanded]);
  return <div ref={root} className="ui-dock-island">
    {expanded && <div id={panelId} className="ui-dock-panel ui-blur-fade" aria-label="Opciones de navegación y apariencia">
      {moreItems.length > 0 && <nav className="ui-dock-more" aria-label="Más secciones">{moreItems.map(item => <button type="button" key={item.id} aria-current={value === item.id ? "page" : undefined} onClick={() => { onChange(item.id); setExpanded(false); }}>
        <span aria-hidden="true">{item.icono}</span>{item.etiqueta}
      </button>)}</nav>}
      <ThemeToggler />
    </div>}
    <button ref={trigger} type="button" className="ui-dock-handle" aria-label={expanded ? "Cerrar opciones de la isla" : "Abrir opciones y tema"} aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(open => !open)}><span aria-hidden="true" /></button>
    <nav aria-label="Navegación principal"><AnimatedBackground value={moreActive ? "__more" : value} className="ui-dock-items">
      {items.map(item => <button type="button" data-selection-id={item.id} key={item.id} aria-current={value === item.id ? "page" : undefined} className="ui-dock-item" onClick={() => { onChange(item.id); setExpanded(false); }}>
        <span className="ui-dock-icon" aria-hidden="true">{item.icono}</span><span>{item.etiqueta}</span>
        {!!item.badge && <span className="ui-dock-badge" aria-label={`${item.badge} pendientes`}>{item.badge}</span>}
      </button>)}
      {moreItems.length > 0 && <button type="button" data-selection-id="__more" className="ui-dock-item" aria-expanded={expanded} aria-controls={panelId} aria-current={moreActive ? "page" : undefined} onClick={() => setExpanded(open => !open)}><span className="ui-dock-icon" aria-hidden="true">•••</span><span>Más</span></button>}
    </AnimatedBackground></nav>
  </div>;
}
