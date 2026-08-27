export interface Categoria {
  id: string;
  nombre: string;
  color: string;
}

export interface Gasto {
  id: string;
  monto: number;
  descripcion: string;
  categoriaId: string;
  cuentaId?: string;
  fecha: string;
  createdAt: string;
}

export interface Presupuesto {
  id: string;
  categoriaId: string;
  montoLimite: number;
  mes: string;
}

export type TipoCuenta = "debito" | "credito" | "efectivo" | "ahorro";
export type Banco = "banco_guayaquil" | "pichincha" | "produbanco" | "otro";
export type Marca = "amex" | "visa" | "mastercard" | "diners" | "otro";

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  banco: Banco;
  marca?: Marca;
  /** Solo aplica a cuentas de tipo "credito". */
  cupoTotal?: number;
  /** Saldo usable: para crédito es el cupo disponible, para el resto es el saldo. */
  disponible: number;
  createdAt: string;
}

export interface Ingreso {
  id: string;
  monto: number;
  descripcion: string;
  cuentaId?: string;
  fecha: string;
  createdAt: string;
}

export interface PagoTarjeta {
  id: string;
  cuentaId: string;
  monto: number;
  fecha: string;
  createdAt: string;
}

export type TipoDeuda = "prestamo" | "tarjeta" | "otro";

export interface Deuda {
  id: string;
  nombre: string;
  tipo: TipoDeuda;
  montoTotal: number;
  saldoPendiente: number;
  cuotaMensual: number;
  tasaInteres?: number;
  fechaInicio: string;
  proximoPago?: string;
  cuentaId?: string;
  createdAt: string;
}

export type TipoRecordatorio = "pago" | "prestamo" | "tarjeta" | "otro";
export type Frecuencia = "semanal" | "mensual" | "anual";

export interface Recordatorio {
  id: string;
  titulo: string;
  tipo: TipoRecordatorio;
  monto?: number;
  fecha: string;
  recurrente: boolean;
  frecuencia?: Frecuencia;
  completado: boolean;
  deudaId?: string;
  createdAt: string;
}
