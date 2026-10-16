import type { Billetera, MetodoPago, OrigenTransaccion } from "../types/domain";

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

/** "Pagado con". Sin billetera = la tarjeta física (o se desconoce). */
export const ETIQUETA_BILLETERA: Record<Billetera, string> = {
  apple_pay: "Apple Pay",
  google_wallet: "Google Wallet",
  otra: "Otra billetera",
};

/** Opciones del selector "Pagado con"; solo se muestra con débito, crédito o diferido. */
export const OPCIONES_BILLETERA: Billetera[] = ["apple_pay", "google_wallet", "otra"];

export const ETIQUETA_ORIGEN_TRANSACCION: Record<OrigenTransaccion, string> = {
  correo: "Correo",
  apple_pay: "Apple Pay",
  google_wallet: "Google Wallet",
};

// 3, 6, 9 y después cada mes hasta 24 — a pedido.
export const OPCIONES_MESES_DIFERIDO = [3, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
