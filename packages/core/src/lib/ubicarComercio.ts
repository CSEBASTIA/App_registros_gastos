/**
 * Dónde queda el comercio de un consumo que llegó por correo. El aviso del
 * banco trae el nombre del comercio («AKI TARQUI», «TIENDA PRUEBA S A») pero no dónde
 * está. Si la persona activó «Guardar la ubicación de mis pagos», la app busca
 * ese nombre en OpenStreetMap (Nominatim) cerca de donde está el teléfono y
 * toma el resultado más cercano: así el gasto queda en un lugar con dirección.
 * Es una aproximación: con varias sucursales del mismo nombre, puede elegir
 * otra (se corrige moviendo el gasto de lugar o renombrando el lugar).
 *
 * Aquí está lo que no depende de la red ni del GPS, para probarlo.
 */

export interface PuntoAproximado {
  latitud: number;
  longitud: number;
}

export interface ComercioUbicado extends PuntoAproximado {
  /** Dirección legible («Av. 9 de Octubre, Tarqui, Guayaquil…»), recortada a 200 caracteres. */
  direccion: string;
  /** Distancia al teléfono, en km. */
  distanciaKm: number;
}

/** Hasta dónde se busca alrededor del teléfono (en grados: ~0,25° ≈ 28 km en Ecuador). */
export const RADIO_BUSQUEDA_GRADOS = 0.25;
/** Un resultado más lejos que esto no se toma: probablemente es otra sucursal u otra ciudad. */
export const DISTANCIA_MAXIMA_KM = 15;

// Lo que los bancos agregan al nombre comercial y OpenStreetMap no conoce.
const SUFIJOS_SOCIETARIOS = /\b(?:s\.?\s?a\.?|c\.?\s?a\.?|cia\.?\s+ltda\.?|ltda\.?|s\.?\s?a\.?\s?s\.?|cia|ec|ecu|quito|uio|gye)\s*$/i;

/** «TIENDA PRUEBA S A» → «TIENDA PRUEBA»; «CORPORACION FAVORITA C.A.» → «CORPORACION FAVORITA»; «AKI TARQUI» igual. */
export function nombreParaBuscar(comercio: string): string | undefined {
  let nombre = comercio.replace(/[*#|_]+/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3 && SUFIJOS_SOCIETARIOS.test(nombre); i++) nombre = nombre.replace(SUFIJOS_SOCIETARIOS, "").trim();
  // Números de local o de terminal al final («TIENDA 12», «KFC 0123»): no ayudan a buscar.
  nombre = nombre.replace(/\s+\d+$/, "").trim();
  return nombre.length >= 2 && /\p{L}/u.test(nombre) ? nombre.slice(0, 80) : undefined;
}

/** La búsqueda en Nominatim: solo en Ecuador y dentro de un cuadro alrededor del teléfono. */
export function urlBusquedaComercio(nombre: string, cerca: PuntoAproximado): string {
  const r = RADIO_BUSQUEDA_GRADOS;
  // Con 2 decimales (~1 km): Nominatim no necesita la posición exacta para buscar.
  const lat = Math.round(cerca.latitud * 100) / 100;
  const lon = Math.round(cerca.longitud * 100) / 100;
  const viewbox = [lon - r, lat + r, lon + r, lat - r].map((n) => n.toFixed(2)).join(",");
  const parametros = new URLSearchParams({
    q: nombre,
    format: "jsonv2",
    countrycodes: "ec",
    limit: "5",
    viewbox,
    bounded: "1",
    "accept-language": "es",
  });
  return `https://nominatim.openstreetmap.org/search?${parametros.toString()}`;
}

/** Distancia entre dos puntos en km (haversine). */
export function distanciaKm(a: PuntoAproximado, b: PuntoAproximado): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * De lo que devolvió Nominatim, el resultado más cercano al teléfono y a menos
 * de `DISTANCIA_MAXIMA_KM`. La respuesta viene de un tercero: se valida todo.
 */
export function comercioMasCercano(respuesta: unknown, cerca: PuntoAproximado): ComercioUbicado | undefined {
  if (!Array.isArray(respuesta)) return undefined;
  let mejor: ComercioUbicado | undefined;
  for (const r of respuesta.slice(0, 10)) {
    const fila = r as { lat?: unknown; lon?: unknown; display_name?: unknown };
    const latitud = Number(fila.lat);
    const longitud = Number(fila.lon);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) continue;
    const direccion = typeof fila.display_name === "string" ? fila.display_name.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200) : "";
    if (!direccion) continue;
    const d = distanciaKm(cerca, { latitud, longitud });
    if (d > DISTANCIA_MAXIMA_KM) continue;
    if (!mejor || d < mejor.distanciaKm) mejor = { latitud, longitud, direccion, distanciaKm: d };
  }
  return mejor;
}
