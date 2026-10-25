/**
 * Planes de FinTrack: Gratis, Plus ($2.99/mes) y Pro ($4.99/mes).
 *
 * El plan de cada persona vive en la tabla `planes_usuario`, que la app solo
 * puede leer: lo escribe el servidor cuando confirma un pago. Sin fila, o con
 * el plan vencido, la persona está en Gratis.
 */
export type IdPlan = "gratis" | "plus" | "pro";
export type EstadoPlanUsuario = "activa" | "cancelada" | "vencida";

export interface Plan {
  id: IdPlan;
  nombre: string;
  /** Dólares al mes. */
  precioMensual: number;
  /** Frase corta para la tarjeta del plan. */
  lema: string;
  /** Lo que incluye, en el orden en que se muestra. */
  beneficios: string[];
  /** Etiqueta destacada en la pantalla de planes, si lleva. */
  destacado?: string;
}

export const PLANES: Plan[] = [
  {
    id: "gratis",
    nombre: "Gratis",
    precioMensual: 0,
    lema: "Empieza a ordenar tu dinero hoy.",
    beneficios: [
      "Registro de gastos e ingresos",
      "Cuentas, tarjetas y deudas",
      "Resumen del mes y presupuestos",
      "Recordatorios de pagos y cuotas",
    ],
  },
  {
    id: "plus",
    nombre: "Plus",
    precioMensual: 2.99,
    lema: "Tus gastos se registran solos.",
    destacado: "Más elegido",
    beneficios: [
      "Todo lo del plan Gratis",
      "Registro automático desde tu correo bancario",
      "Importar estados de cuenta en PDF",
      "Detector de suscripciones y alertas de subida de precio",
      "Lugares y mapa de tus pagos",
    ],
  },
  {
    id: "pro",
    nombre: "Pro",
    precioMensual: 4.99,
    lema: "Adelántate a fin de mes.",
    destacado: "Todo incluido",
    beneficios: [
      "Todo lo del plan Plus",
      "Proyección de cuánto gastarás a fin de mes",
      "Aviso antes de pasarte de un presupuesto",
      "Plan para salir de deudas y puntaje financiero",
      "Atención prioritaria",
    ],
  },
];

export function esIdPlan(valor: unknown): valor is IdPlan {
  return valor === "gratis" || valor === "plus" || valor === "pro";
}

export function planPorId(id: IdPlan): Plan {
  return PLANES.find((p) => p.id === id) ?? PLANES[0];
}

/** "Gratis" o "$2.99 al mes". */
export function textoPrecio(plan: Plan): string {
  return plan.precioMensual === 0 ? "Gratis" : `$${plan.precioMensual.toFixed(2)} al mes`;
}

/** Lo que guarda la tabla `planes_usuario` para la persona (sin fila = Gratis). */
export interface PlanUsuario {
  plan: IdPlan;
  estado: EstadoPlanUsuario;
  /** Fecha "YYYY-MM-DD" hasta la que está pagado (inclusive). */
  venceEn?: string;
}

export interface EstadoSuscriptor {
  /** El plan que la persona puede usar hoy. */
  plan: Plan;
  /** Lo que se muestra en el perfil: "Plan Gratis", "Activo", "Se renueva…". */
  titulo: string;
  detalle: string;
  /** Si tiene un plan pagado vigente. */
  esPago: boolean;
}

/**
 * Qué plan rige hoy y cómo se cuenta en el perfil. Un plan cancelado sigue
 * vigente hasta su fecha de vencimiento; después (o si venció), vuelve a Gratis.
 */
export function estadoSuscriptor(fila: PlanUsuario | null, hoy: string): EstadoSuscriptor {
  const gratis = planPorId("gratis");
  const sinPlan: EstadoSuscriptor = {
    plan: gratis,
    titulo: "Plan Gratis",
    detalle: "Pásate a Plus o Pro para que tus gastos se registren solos.",
    esPago: false,
  };
  if (!fila || fila.plan === "gratis") return sinPlan;

  const plan = planPorId(fila.plan);
  const vigente = fila.estado !== "vencida" && (!fila.venceEn || fila.venceEn >= hoy);
  if (!vigente) {
    return { ...sinPlan, detalle: `Tu plan ${plan.nombre} venció${fila.venceEn ? ` el ${fila.venceEn}` : ""}. Renuévalo para recuperar sus funciones.` };
  }
  if (fila.estado === "cancelada") {
    return {
      plan,
      titulo: `Plan ${plan.nombre} · cancelado`,
      detalle: fila.venceEn ? `Lo sigues usando hasta el ${fila.venceEn}; después pasas a Gratis.` : "Pasarás a Gratis al terminar el periodo pagado.",
      esPago: true,
    };
  }
  return {
    plan,
    titulo: `Plan ${plan.nombre} · activo`,
    detalle: fila.venceEn ? `${textoPrecio(plan)} · se renueva el ${fila.venceEn}.` : textoPrecio(plan),
    esPago: true,
  };
}
