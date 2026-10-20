// Lugar de los consumos que se registraron solos desde el correo. El aviso del
// banco trae el comercio («AKI TARQUI») pero no dónde está: si la persona
// activó «Guardar la ubicación de mis pagos», se busca ese nombre en
// OpenStreetMap cerca de donde está el teléfono (ver core `ubicarComercio`) y el
// gasto queda en ese lugar, con su dirección. Solo sale hacia OpenStreetMap el
// nombre del comercio y un cuadro de ~28 km alrededor (con 2 decimales).
import * as Location from "expo-location";
import { Platform } from "react-native";
import {
  actualizarGasto,
  comercioMasCercano,
  crearFetchConTimeout,
  guardarDireccionLugar,
  nombreParaBuscar,
  urlBusquedaComercio,
  type AvisoRegistrado,
  type ComercioUbicado,
} from "core";
import { guardarUbicacionActiva } from "./ubicacion";

const fetchNominatim = crearFetchConTimeout({ ms: 10_000 });
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Cuántos consumos quedaron con lugar. Nunca lanza: sin lugar, el gasto queda igual. */
export async function ubicarComerciosRegistrados(registrados: AvisoRegistrado[]): Promise<number> {
  const pendientes = registrados.filter(
    (r) => r.resultado === "registrado" && r.clase === "consumo" && r.sinLugar && r.gastoId && r.comercio
  );
  if (pendientes.length === 0 || Platform.OS === "web") return 0;
  try {
    if (!(await guardarUbicacionActiva())) return 0;
    if ((await Location.getForegroundPermissionsAsync()).status !== "granted") return 0;
    const posicion =
      (await Location.getLastKnownPositionAsync({ maxAge: 6 * 60 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const cerca = { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };

    const encontrados = new Map<string, ComercioUbicado | undefined>();
    let ubicados = 0;
    for (const r of pendientes) {
      const nombre = nombreParaBuscar(r.comercio!);
      if (!nombre) continue;
      const clave = nombre.toLowerCase();
      if (!encontrados.has(clave)) {
        // Nominatim pide como mucho una búsqueda por segundo.
        if (encontrados.size > 0) await espera(1100);
        const res = await fetchNominatim(urlBusquedaComercio(nombre, cerca), {
          headers: { Accept: "application/json", "User-Agent": "FinTrack (com.csebastia.gastosapp)" },
        });
        encontrados.set(clave, res.ok ? comercioMasCercano(await res.json(), cerca) : undefined);
      }
      const lugar = encontrados.get(clave);
      if (!lugar) continue;
      // La base asigna el lugar (o lo crea con el nombre del comercio) al recibir la ubicación.
      const gasto = await actualizarGasto(r.gastoId!, {
        ubicacion: { latitud: lugar.latitud, longitud: lugar.longitud, precisionM: 50 },
      });
      if (gasto.lugarId) await guardarDireccionLugar(gasto.lugarId, lugar.direccion);
      ubicados += 1;
    }
    return ubicados;
  } catch {
    return 0;
  }
}
