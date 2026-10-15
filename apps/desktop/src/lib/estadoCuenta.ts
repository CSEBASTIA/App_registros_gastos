import type { TextItem } from "pdfjs-dist/types/src/display/api";
export { parseEstadoCuenta } from "core";
export type { TransaccionEstadoCuenta as TransaccionExtraida } from "core";

/**
 * Lee el texto crudo de un estado de cuenta: si es PDF se extrae la capa de
 * texto (pdf.js); si es imagen se corre OCR local (tesseract.js), igual que
 * con un recibo individual.
 */
export async function leerEstadoCuenta(archivo: File): Promise<string> {
  if (/\.(csv|txt)$/i.test(archivo.name) || archivo.type.startsWith("text/")) return archivo.text();
  const esPdf = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
  if (esPdf) return leerTextoPdf(archivo);

  const { recognize } = await import("tesseract.js");
  const {
    data: { text },
  } = await recognize(archivo, "spa");
  return text;
}

async function leerTextoPdf(archivo: File): Promise<string> {
  const [pdfjsLib, pdfjsWorker] = await Promise.all([
    import("pdfjs-dist"),
    // Vite resuelve esto a la URL del worker, necesario para ejecutar pdf.js fuera del hilo principal.
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

  const buffer = await archivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lineas: string[] = [];

  for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
    const pagina = await pdf.getPage(numPagina);
    const contenido = await pagina.getTextContent();

    // pdf.js entrega fragmentos de texto sueltos con su posición (x, y), no
    // líneas ya armadas: hay que agruparlos por coordenada Y (misma línea
    // visual) y ordenarlos por X para reconstruir el texto en orden de lectura.
    const items = contenido.items
      .filter((it): it is TextItem => "str" in it && "transform" in it && it.str.trim().length > 0)
      .map((it) => ({ texto: it.str, x: it.transform[4], y: it.transform[5] }));
    if (items.map((it) => it.texto).join("").trim().length < 8) {
      // Algunos bancos entregan el PDF como imágenes. OCR solo en esas páginas.
      const viewport = pagina.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("No se pudo leer la página escaneada.");
      await pagina.render({ canvasContext: contexto, viewport }).promise;
      const { recognize } = await import("tesseract.js");
      const { data: { text } } = await recognize(canvas, "spa");
      lineas.push(text);
      continue;
    }

    const porLinea = new Map<number, typeof items>();
    for (const item of items) {
      const claveY = Math.round(item.y / 2) * 2; // tolerancia de 2pt para variaciones menores de baseline
      const grupo = porLinea.get(claveY);
      if (grupo) grupo.push(item);
      else porLinea.set(claveY, [item]);
    }

    const lineasPagina = [...porLinea.entries()]
      .sort((a, b) => b[0] - a[0]) // de arriba hacia abajo (Y decreciente en coordenadas PDF)
      .map(([, grupo]) =>
        grupo
          .sort((a, b) => a.x - b.x)
          .map((it) => it.texto)
          .join(" ")
      );

    lineas.push(...lineasPagina);
  }

  return lineas.join("\n");
}
