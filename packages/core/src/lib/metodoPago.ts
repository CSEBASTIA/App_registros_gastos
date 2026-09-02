import type { MetodoPago } from "../types/domain";

export const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferencia",
  diferido: "Diferido",
  otro: "Otro",
};

// El selector de método de pago no ofrece "Otro" (a pedido): son formas de pago concretas.
export const OPCIONES_METODO_PAGO: MetodoPago[] = ["efectivo", "debito", "credito", "transferencia", "diferido"];

// 3, 6, 9 y después cada mes hasta 24 — a pedido.
export const OPCIONES_MESES_DIFERIDO = [3, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
