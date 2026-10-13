import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
type Entry<T> = { key: string; item: T; leaving: boolean };
/** Short notification lists only; no service or sample notices attached. */
export default function AnimatedList<T>({ items, getKey, renderItem, className = "" }: { items: T[]; getKey: (item: T) => string; renderItem: (item: T, index: number) => ReactNode; className?: string }) {
  const [entries, setEntries] = useState<Entry<T>[]>(() => items.map(item => ({ key: getKey(item), item, leaving: false })));
  useEffect(() => {
    const next = items.map(item => ({ key: getKey(item), item, leaving: false }));
    const keys = new Set(next.map(entry => entry.key));
    setEntries(previous => [...next, ...previous.filter(entry => !keys.has(entry.key)).map(entry => ({ ...entry, leaving: true }))]);
    const timer = window.setTimeout(() => setEntries(next), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [items, getKey]);
  return <ul className={`ui-animated-list ${className}`}>{entries.map((entry, index) => <li key={entry.key} aria-hidden={entry.leaving || undefined} className={entry.leaving ? "ui-list-leaving" : "ui-blur-fade"} style={{ "--ui-delay": `${Math.min(index * 35, 210)}ms` } as CSSProperties}>{renderItem(entry.item, index)}</li>)}</ul>;
}
