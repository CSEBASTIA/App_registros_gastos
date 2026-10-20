import type { FragmentoTextoPdf } from "core";

/** El PDF pide clave (muchos bancos la ponen: suele ser la cédula) o la clave no sirvió. */
export class ErrorClavePdf extends Error {
  readonly motivo: "necesaria" | "incorrecta";
  constructor(motivo: "necesaria" | "incorrecta") {
    super(motivo === "necesaria" ? "Este PDF tiene clave. Escríbela para abrirlo." : "La clave no es correcta.");
    this.name = "ErrorClavePdf";
    this.motivo = motivo;
  }
}

export interface LectorPdfRef {
  /** Fragmentos de texto de cada página del PDF (en base64). La clave no se guarda en ningún lado. */
  leer(base64: string, clave?: string): Promise<FragmentoTextoPdf[][]>;
}

const ESPERA_CARGA_MS = 30_000;

/**
 * La causa técnica, corta, para que la persona pueda contarla si algo falla
 * en su teléfono («Invalid PDF structure», «Unexpected token…»). Son mensajes
 * de pdf.js o del WebView: no traen contenido del estado de cuenta.
 */
function detalle(motivo: unknown): string {
  const texto = String((motivo as { message?: unknown })?.message ?? motivo ?? "")
    .replace(/s+/g, " ")
    .trim()
    .slice(0, 90);
  return texto ? ` (detalle: ${texto})` : "";
}
const ESPERA_LECTURA_MS = 90_000;

type Pendiente = {
  resolver: (p: FragmentoTextoPdf[][]) => void;
  rechazar: (e: Error) => void;
  reloj: ReturnType<typeof setTimeout>;
};

/**
 * Habla con la página del lector (lib/lectorPdfPagina.ts), sea un WebView en
 * el teléfono o un iframe en la web: le entrega pdf.js cuando avisa que cargó,
 * espera a que esté lista y empareja cada lectura con su respuesta.
 */
export class ClienteLectorPdf {
  private pendientes = new Map<number, Pendiente>();
  private siguienteId = 1;
  private resolverListo!: () => void;
  private rechazarListo!: (e: Error) => void;
  private listo: Promise<void>;
  private enviar: (mensaje: string) => void;
  private cargarCodigo: () => Promise<{ pdf: string; worker: string }>;

  constructor(enviar: (mensaje: string) => void, cargarCodigo: () => Promise<{ pdf: string; worker: string }>) {
    this.enviar = enviar;
    this.cargarCodigo = cargarCodigo;
    this.listo = new Promise<void>((ok, mal) => {
      this.resolverListo = ok;
      this.rechazarListo = mal;
    });
    this.listo.catch(() => {}); // se informa a quien intente leer
  }

  /** Mensaje (texto JSON) que llegó desde la página. */
  recibir(datos: unknown): void {
    if (typeof datos !== "string") return;
    let m: any;
    try {
      m = JSON.parse(datos);
    } catch {
      return;
    }
    if (m?.tipo === "pagina") {
      this.cargarCodigo()
        .then((c) => this.enviar(JSON.stringify({ tipo: "codigo", ...c })))
        .catch((e) => this.rechazarListo(new Error(`No se pudo cargar el lector de PDF de la app.${detalle(e)}`)));
    } else if (m?.tipo === "listo") {
      this.resolverListo();
    } else if (m?.tipo === "resultado" || m?.tipo === "error") {
      if (m.id == null) {
        this.rechazarListo(new Error(`No se pudo iniciar el lector de PDF.${detalle(m.mensaje)}`));
        return;
      }
      const p = this.pendientes.get(m.id);
      if (!p) return;
      this.pendientes.delete(m.id);
      clearTimeout(p.reloj);
      if (m.tipo === "resultado") p.resolver(m.paginas as FragmentoTextoPdf[][]);
      else if (m.clave === "necesaria" || m.clave === "incorrecta") p.rechazar(new ErrorClavePdf(m.clave));
      else p.rechazar(new Error(`No se pudo leer el PDF. ¿Es el archivo original que envía el banco?${detalle(m.mensaje)}`));
    }
  }

  async leer(base64: string, clave?: string): Promise<FragmentoTextoPdf[][]> {
    let relojCarga: ReturnType<typeof setTimeout> | undefined;
    const espera = new Promise<never>((_, mal) => {
      relojCarga = setTimeout(
        () => mal(new Error("El lector de PDF tardó demasiado en abrir. Intenta de nuevo.")),
        ESPERA_CARGA_MS
      );
    });
    try {
      await Promise.race([this.listo, espera]);
    } finally {
      clearTimeout(relojCarga);
    }
    const id = this.siguienteId++;
    return new Promise<FragmentoTextoPdf[][]>((resolver, rechazar) => {
      const reloj = setTimeout(() => {
        this.pendientes.delete(id);
        rechazar(new Error("El PDF tardó demasiado en leerse. Prueba con un archivo más liviano."));
      }, ESPERA_LECTURA_MS);
      this.pendientes.set(id, { resolver, rechazar, reloj });
      this.enviar(JSON.stringify({ tipo: "leer", id, base64, clave }));
    });
  }

  /** Al desmontar: nadie se queda esperando. */
  cerrar(): void {
    for (const p of this.pendientes.values()) {
      clearTimeout(p.reloj);
      p.rechazar(new Error("Se cerró la pantalla antes de terminar de leer el PDF."));
    }
    this.pendientes.clear();
  }
}
