export type TipoCategoria = "gasto" | "ingreso";

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  tipo: TipoCategoria;
  /** undefined = categoría global/compartida; si tiene valor, es una categoría propia del usuario. */
  usuarioId?: string;
}

export type MetodoPago = "efectivo" | "debito" | "credito" | "transferencia" | "diferido" | "otro";

export interface Gasto {
  id: string;
  monto: number;
  descripcion: string;
  categoriaId: string;
  /** Texto libre cuando la categoría elegida es "Otros". */
  categoriaDetalle?: string;
  cuentaId?: string;
  metodoPago?: MetodoPago;
  /** Solo cuando metodoPago === "diferido": a cuántos meses (3-24). Genera una deuda automáticamente. */
  mesesDiferido?: number;
  /** Ruta del archivo (PDF o imagen) dentro del bucket privado "facturas", ej. "<usuario_id>/<archivo>". */
  facturaPath?: string;
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
export type Banco = "banco_guayaquil" | "pichincha" | "produbanco" | "diners_club" | "otro";
export type Marca = "amex" | "visa" | "mastercard" | "diners" | "otro";

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  banco: Banco;
  marca?: Marca;
  /** Id del producto en el catálogo de diseños (ver `catalogoTarjetas` en desktop), ej. "visa-oro-lifemiles". */
  estilo?: string;
  /** Solo aplica a cuentas de tipo "credito". */
  cupoTotal?: number;
  /** Últimos 3-4 dígitos de la cuenta/tarjeta — para distinguir cuál cuenta es cuando hay más de una del mismo banco al leer un correo bancario. */
  identificador?: string;
  /** Saldo usable: para crédito es el cupo disponible, para el resto es el saldo. */
  disponible: number;
  createdAt: string;
}

export type TipoTransaccionDetectada = "gasto" | "ingreso";
export type EstadoTransaccionDetectada = "pendiente" | "confirmado" | "descartado";

/** Un gasto/ingreso que la app detectó sola leyendo un correo bancario, pendiente de revisión antes de guardarse. */
export interface TransaccionDetectada {
  id: string;
  /** Id del mensaje en el proveedor de correo — evita procesar el mismo aviso dos veces. */
  mensajeId: string;
  tipo: TipoTransaccionDetectada;
  monto: number;
  descripcion: string;
  /** undefined = no se pudo identificar el banco del remitente. */
  banco?: Banco;
  /** undefined = no se pudo desambiguar la cuenta (ej. dos cuentas del mismo banco); el usuario la elige al revisar. */
  cuentaId?: string;
  categoriaId?: string;
  fecha: string;
  correoAsunto?: string;
  estado: EstadoTransaccionDetectada;
  createdAt: string;
}

export interface Ingreso {
  id: string;
  monto: number;
  descripcion: string;
  categoriaId?: string;
  /** Texto libre cuando la categoría elegida es "Otros". */
  categoriaDetalle?: string;
  cuentaId?: string;
  fecha: string;
  createdAt: string;
}

export interface PagoTarjeta {
  id: string;
  cuentaId: string;
  /** Cuenta de ahorro/débito desde la que se paga (opcional: pagos viejos no la tenían). */
  cuentaOrigenId?: string;
  monto: number;
  fecha: string;
  createdAt: string;
}

export type TipoDeuda = "prestamo" | "tarjeta" | "otro" | "diferido";

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
  /** Si esta deuda se creó sola a partir de un gasto diferido, el id de ese gasto. */
  gastoId?: string;
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

/** Un abono ya registrado a una deuda (historial; solo se crea vía registrarAbonoDeuda). */
export interface AbonoDeuda {
  id: string;
  deudaId: string;
  cuentaId?: string;
  monto: number;
  fecha: string;
  createdAt: string;
}
