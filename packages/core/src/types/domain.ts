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

/**
 * "Pagado con": la billetera digital que hizo el pago. No es un método de
 * pago: Apple Pay y Google Wallet pagan con una tarjeta de débito o crédito,
 * que sigue en `metodoPago`.
 */
export type Billetera = "apple_pay" | "google_wallet" | "otra";

/** Dónde se hizo un pago. La base la guarda redondeada a 4 decimales (~11 m). */
export interface Ubicacion {
  latitud: number;
  longitud: number;
  /** Precisión que reportó el GPS, en metros. Con más de 200 m no se asigna lugar. */
  precisionM?: number;
}

/** Un sitio donde el usuario paga: la base asigna a cada gasto con ubicación el lugar propio más cercano. */
export interface Lugar {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  /** Un gasto a menos de esta distancia (20-500 m) pertenece a este lugar. */
  radioM: number;
  /** Dirección del sitio (la de OpenStreetMap, si la app pudo ubicar el comercio por su nombre). */
  direccion?: string;
  createdAt: string;
}

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
  /** Tasa nominal anual acordada para el diferido; 0 significa sin interés. */
  tasaInteres?: number;
  /** Ruta del archivo (PDF o imagen) dentro del bucket privado "facturas", ej. "<usuario_id>/<archivo>". */
  facturaPath?: string;
  /** Solo con método débito, crédito o diferido (o sin método). */
  billetera?: Billetera;
  ubicacion?: Ubicacion;
  /** Lo asigna la base a partir de la ubicación; también se puede elegir a mano. */
  lugarId?: string;
  fecha: string;
  /** Hora real del pago, si se conoce (avisos de Apple Pay o Google Wallet confirmados). */
  pagadoEn?: string;
  createdAt: string;
}

export interface Presupuesto {
  id: string;
  categoriaId: string;
  montoLimite: number;
  mes: string;
}

export type TipoCuenta = "debito" | "credito" | "efectivo" | "ahorro";
export type Banco =
  | "banco_guayaquil" | "pichincha" | "produbanco" | "diners_club" | "banco_pacifico" | "banco_austro" | "otro"
  // Casas comerciales y créditos directos: siempre tipo "credito" (con cupo).
  | "comandato" | "artefacta" | "marcimex" | "la_ganga" | "japon" | "de_prati" | "creditos_economicos" | "otra_casa_comercial";
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
  /** Solo crédito: día del mes en que corta el estado de cuenta (1-31; en meses cortos, el último día). */
  diaCorte?: number;
  /** Solo crédito: día máximo de pago (1-31). */
  diaPago?: number;
  /** Saldo usable: para crédito es el cupo disponible, para el resto es el saldo. */
  disponible: number;
  createdAt: string;
}

export type TipoTransaccionDetectada = "gasto" | "ingreso";
export type EstadoTransaccionDetectada = "pendiente" | "confirmado" | "descartado";
/** Qué reconoció la app en el correo: un consumo con tarjeta, un pago de tarjeta o una transferencia. */
export type ClaseAviso = "consumo" | "pago_tarjeta" | "transferencia";
/** De dónde llegó el aviso a la bandeja. Los de billetera son siempre gastos. */
export type OrigenTransaccion = "correo" | "apple_pay" | "google_wallet";

/** Un gasto/ingreso que la app detectó sola (correo bancario o billetera), pendiente de revisión antes de guardarse. */
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
  origen: OrigenTransaccion;
  /** Nombre del comercio que dio la billetera. */
  comercio?: string;
  ubicacion?: Ubicacion;
  /** Últimos 3-4 dígitos de la tarjeta, para reconocer la cuenta. */
  tarjetaFinal?: string;
  /** Hora de la notificación de Google Wallet (si llegó tarde, la del pago). Sin ella, el pago es `createdAt`. */
  pagadoEn?: string;
  /** El correo habla de una transferencia: la base busca la otra mitad en otra cuenta propia. */
  esTransferencia?: boolean;
  /** Formato reconocido del correo: con las cuentas identificadas, la base lo registra sola. */
  clase?: ClaseAviso;
  /** La otra cuenta: la que pagó (pago de tarjeta) o la de destino (transferencia). */
  contraparteCuentaId?: string;
  /** Comisión que cobró el banco, aparte del monto. */
  comision?: number;
  /** Se resolvió como transferencia entre cuentas propias (junto con su otra mitad, si llegó). */
  transferenciaId?: string;
  /** El gasto que creó este aviso (al confirmarlo o al registrarse solo). */
  gastoId?: string;
  estado: EstadoTransaccionDetectada;
  createdAt: string;
}

/**
 * Dinero que pasa de una cuenta propia a otra. No es gasto ni ingreso: no
 * cuenta en el balance del mes ni en los presupuestos. Los saldos los mueve
 * la base. Si se borra una de las cuentas, su lado queda vacío (undefined).
 */
export interface Transferencia {
  id: string;
  cuentaOrigenId?: string;
  cuentaDestinoId?: string;
  monto: number;
  fecha: string;
  descripcion?: string;
  /** "correo": la juntó la base a partir de dos avisos, o se confirmó desde la bandeja. */
  origen: "manual" | "correo";
  createdAt: string;
}

/** Ajustes de la cuenta que la base necesita conocer (viven en `ajustes_usuario`). */
export interface AjustesUsuario {
  /**
   * La base registra sola lo que reconoce con seguridad: pagos con billetera
   * cuya tarjeta reconoce por sus últimos dígitos, y transferencias entre tus
   * cuentas que llegan por correo («enviada» + «recibida»). Encendido por defecto.
   */
  registroAutomatico: boolean;
}

/** 75 = llegaste al 75 %; 100 = llegaste al límite; 101 = te pasaste. */
export type NivelAvisoPresupuesto = 75 | 100 | 101;

/** Un presupuesto que acaba de cruzar un nivel: la base lo avisa una sola vez. */
export interface AvisoPresupuesto {
  presupuestoId: string;
  categoria: string;
  nivel: NivelAvisoPresupuesto;
  porcentaje: number;
  gastado: number;
  limite: number;
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
  /** Interés pendiente de la cuota actual en un diferido automático. */
  interesCuotaPendiente?: number;
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
  /** Lo creó la base para una cuota de un diferido (se cierra al pagarla y se borra con el diferido). */
  automatico?: boolean;
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
