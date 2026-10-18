import BlurFade from "../components/BlurFade";
import { fechaLocal, sumarMontos } from "core";
import type {
  BalanceGeneral,
  EfectivoNeto,
  Categoria,
  Endeudamiento,
  Gasto,
  Ingreso,
  Recomendacion,
} from "core";
import BarraProgreso from "../components/BarraProgreso";
import EstadoVacio from "../components/EstadoVacio";
import {
  IconoAlerta,
  IconoCheck,
  IconoFlechaAbajo,
  IconoFlechaArriba,
  IconoGastos,
  IconoIngresos,
  IconoResumen,
} from "../components/iconos";

interface Props {
  balance: BalanceGeneral;
  efectivo: EfectivoNeto;
  endeudamiento: Endeudamiento;
  recomendaciones: Recomendacion[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  categorias: Categoria[];
}

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

export default function Resumen({
  balance,
  efectivo,
  endeudamiento,
  recomendaciones,
  gastos,
  ingresos,
  categorias,
}: Props) {
  const semana = construirSemana(gastos);
  const actividad = construirActividad(gastos, ingresos, categorias).slice(
    0,
    6,
  );

  return (
    <>
      <BlurFade className="resumen-intro">
        <p>Ingresos y gastos de este mes, en un solo lugar.</p>
      </BlurFade>

      <div className="saldo-hero">
        <div className="saldo-hero-principal">
          <div className="saldo-hero-header">Efectivo neto del mes</div>
          <div className="saldo-hero-valor">
            {efectivo.efectivoNeto > 0 ? "+" : efectivo.efectivoNeto < 0 ? "−" : ""}$
            {Math.abs(efectivo.efectivoNeto).toFixed(2)}
          </div>
          {(efectivo.conTarjeta > 0 || efectivo.pagosTarjeta > 0) && (
            <p className="saldo-hero-nota">
              {[
                efectivo.conTarjeta > 0 &&
                  `Con tarjeta de crédito: $${efectivo.conTarjeta.toFixed(2)}. No baja tu efectivo hasta que pagues la tarjeta.`,
                efectivo.pagosTarjeta > 0 &&
                  `Incluye $${efectivo.pagosTarjeta.toFixed(2)} que pagaste a tus tarjetas.`,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
        </div>
        <div className="saldo-hero-stats">
          <div className="saldo-hero-stat">
            <span className="saldo-hero-stat-icono saldo-hero-stat-icono-positivo">
              <IconoFlechaArriba />
            </span>
            <div>
              <span className="saldo-hero-stat-etiqueta">Ingresos del mes</span>
              <span className="saldo-hero-stat-valor">
                ${efectivo.totalIngresos.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="saldo-hero-stat">
            <span className="saldo-hero-stat-icono saldo-hero-stat-icono-negativo">
              <IconoFlechaAbajo />
            </span>
            <div>
              <span className="saldo-hero-stat-etiqueta">Salió de tu dinero</span>
              <span className="saldo-hero-stat-valor">
                ${sumarMontos([efectivo.gastadoConTuDinero, efectivo.pagosTarjeta]).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="resumen-grid">
        <div className="resumen-grid-principal">
          <div className="card">
            <div className="form-gasto-header">
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
                Resumen semanal
              </h3>
              <span className="etiqueta">Últimos 7 días</span>
            </div>
            <div className="grafico-semanal">
              {semana.map((dia) => (
                <div className="barra-dia" key={dia.fecha}>
                  <div className="barra-dia-pista">
                    <div
                      className={`barra-dia-relleno ${dia.esHoy ? "barra-dia-relleno-activa" : ""}`}
                      style={{ height: `${dia.alturaPorcentaje}%` }}
                      title={`$${dia.total.toFixed(2)}`}
                    />
                  </div>
                  <span
                    className={`barra-dia-etiqueta ${dia.esHoy ? "barra-dia-etiqueta-activa" : ""}`}
                  >
                    {dia.etiqueta}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <VeredictoFinanciero
            balance={balance}
            endeudamiento={endeudamiento}
          />

          <div className="card">
            <div className="form-gasto-header">
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
                Recomendaciones
              </h3>
            </div>
            {recomendaciones.length === 0 ? (
              <EstadoVacio
                icono={<IconoResumen />}
                titulo="Todavía no hay recomendaciones"
                subtitulo="Registra más gastos e ingresos para que podamos analizar tus hábitos."
              />
            ) : (
              <ul className="lista-recomendaciones">
                {recomendaciones.map((r, i) => (
                  <li
                    key={i}
                    className={`recomendacion recomendacion-${r.severidad}`}
                  >
                    {r.mensaje}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card resumen-grid-lateral">
          <div className="form-gasto-header">
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
              Actividad reciente
            </h3>
          </div>
          {actividad.length === 0 ? (
            <EstadoVacio
              icono={<IconoResumen />}
              titulo="Sin movimientos todavía"
              subtitulo="Tus últimos gastos e ingresos aparecerán aquí."
            />
          ) : (
            <ul className="actividad-lista">
              {actividad.map((item) => (
                <li className="actividad-item" key={`${item.tipo}-${item.id}`}>
                  <span
                    className="actividad-icono"
                    style={
                      item.tipo === "ingreso"
                        ? undefined
                        : { background: `${item.color}1f`, color: item.color }
                    }
                  >
                    {item.tipo === "ingreso" ? (
                      <IconoIngresos />
                    ) : (
                      <IconoGastos />
                    )}
                  </span>
                  <div className="actividad-info">
                    <span className="actividad-descripcion">
                      {item.descripcion}
                    </span>
                    <span className="actividad-subtitulo">
                      {item.subtitulo}
                    </span>
                  </div>
                  <span
                    className={`actividad-monto ${item.tipo === "ingreso" ? "valor-positivo" : "valor-negativo"}`}
                  >
                    {item.tipo === "ingreso" ? "+" : "-"}$
                    {item.monto.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function etiquetaNivel(nivel: Endeudamiento["nivel"]) {
  return nivel === "alto" ? "Alto" : nivel === "moderado" ? "Moderado" : "Bajo";
}

function colorNivel(nivel: Endeudamiento["nivel"]) {
  if (nivel === "alto") return "var(--color-danger)";
  if (nivel === "moderado") return "var(--color-warning)";
  return "var(--color-success)";
}

type EstadoFinanciero = "bien" | "atencion" | "riesgo";

function veredictoFinanciero(
  balance: BalanceGeneral,
  endeudamiento: Endeudamiento,
): { titulo: string; detalle: string; estado: EstadoFinanciero } {
  if (endeudamiento.nivel === "alto") {
    return {
      estado: "riesgo",
      titulo: "Endeudamiento alto",
      detalle: `El ${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso mensual se va en cuotas de deuda. Evita tomar más deuda por ahora.`,
    };
  }
  if (balance.totalIngresos > 0 && balance.balance < 0) {
    return {
      estado: "riesgo",
      titulo: "Gastando más de lo que ingresa",
      detalle: `Este mes tus gastos superan tus ingresos por $${Math.abs(balance.balance).toFixed(2)}.`,
    };
  }
  if (endeudamiento.nivel === "moderado") {
    return {
      estado: "atencion",
      titulo: "Endeudamiento moderado",
      detalle: `El ${endeudamiento.porcentaje.toFixed(0)}% de tu ingreso se va en cuotas. Vale la pena vigilarlo.`,
    };
  }
  return {
    estado: "bien",
    titulo: "Estás en buena forma",
    detalle: "Tus ingresos cubren tus gastos y cuotas de deuda sin problema.",
  };
}

function VeredictoFinanciero({
  balance,
  endeudamiento,
}: {
  balance: BalanceGeneral;
  endeudamiento: Endeudamiento;
}) {
  const veredicto = veredictoFinanciero(balance, endeudamiento);
  const Icono = veredicto.estado === "bien" ? IconoCheck : IconoAlerta;

  return (
    <div className="card veredicto-financiero">
      <div className="form-gasto-header">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Salud financiera</h3>
        <span
          className={`nivel-${endeudamiento.nivel}`}
          style={{ fontSize: "0.8rem", fontWeight: 600 }}
        >
          Endeudamiento: {etiquetaNivel(endeudamiento.nivel)}
        </span>
      </div>
      <div
        className={`veredicto-financiero-cuerpo veredicto-${veredicto.estado}`}
      >
        <span className="veredicto-financiero-icono">
          <Icono />
        </span>
        <div>
          <p className="veredicto-financiero-titulo">{veredicto.titulo}</p>
          <p className="veredicto-financiero-detalle">{veredicto.detalle}</p>
        </div>
      </div>
      {/* el color sale del nivel calculado en core, no de umbrales propios
          de la barra: antes un 34% se pintaba verde justo debajo de la
          etiqueta "Endeudamiento: Moderado" */}
      <BarraProgreso
        porcentaje={endeudamiento.porcentaje}
        color={colorNivel(endeudamiento.nivel)}
      />
    </div>
  );
}

function construirSemana(gastos: Gasto[]) {
  const hoy = new Date();
  const dias: {
    fecha: string;
    etiqueta: string;
    total: number;
    esHoy: boolean;
  }[] = [];

  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const clave = fechaLocal(fecha); // día local, no UTC
    const total = gastos
      .filter((g) => g.fecha === clave)
      .reduce((acc, g) => acc + g.monto, 0);
    dias.push({
      fecha: clave,
      etiqueta: DIAS_SEMANA[fecha.getDay()],
      total,
      esHoy: i === 0,
    });
  }

  const maximo = Math.max(...dias.map((d) => d.total), 1);
  return dias.map((d) => ({
    ...d,
    alturaPorcentaje: Math.max(6, (d.total / maximo) * 100),
  }));
}

interface ItemActividad {
  id: string;
  tipo: "gasto" | "ingreso";
  descripcion: string;
  subtitulo: string;
  monto: number;
  fecha: string;
  createdAt: string;
  color: string;
}

function construirActividad(
  gastos: Gasto[],
  ingresos: Ingreso[],
  categorias: Categoria[],
): ItemActividad[] {
  const items: ItemActividad[] = [
    ...gastos.map((g) => {
      const categoria = categorias.find((c) => c.id === g.categoriaId);
      const esOtrosConDetalle =
        categoria?.nombre === "Otros" && g.categoriaDetalle;
      return {
        id: g.id,
        tipo: "gasto" as const,
        descripcion: g.descripcion || categoria?.nombre || "Gasto",
        subtitulo: esOtrosConDetalle
          ? g.categoriaDetalle!
          : (categoria?.nombre ?? "Sin categoría"),
        monto: g.monto,
        fecha: g.fecha,
        createdAt: g.createdAt,
        // hex literal (no var()): más abajo se concatena un sufijo de alpha
        // ("...1f") para el fondo del ícono, y eso no funciona con var().
        color: categoria?.color ?? "#85898f",
      };
    }),
    ...ingresos.map((i) => ({
      id: i.id,
      tipo: "ingreso" as const,
      descripcion: i.descripcion || "Ingreso",
      subtitulo: "Ingreso",
      monto: i.monto,
      fecha: i.fecha,
      createdAt: i.createdAt,
      color: "var(--color-success)",
    })),
  ];

  return items.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
