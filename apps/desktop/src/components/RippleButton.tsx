import type { ButtonHTMLAttributes } from "react";
export default function RippleButton({ className = "btn-primary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={`btn ui-ripple-button ${className}`} />;
}
