import type { ReactNode, CSSProperties } from "react";
export default function BlurFade({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={`ui-blur-fade ${className}`} style={{ "--ui-delay": `${Math.min(Math.max(delay, 0), 300)}ms` } as CSSProperties}>{children}</div>;
}
