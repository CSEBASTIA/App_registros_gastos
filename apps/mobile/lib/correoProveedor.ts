import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as outlook from "./outlookAuth";
import * as gmail from "./gmailAuth";
import { traerCorreosNuevos as traerDeOutlook, type CorreoRecibido } from "./graphMail";
import { traerCorreosNuevos as traerDeGmail } from "./gmailApi";

export type ProveedorCorreo = "gmail" | "outlook";

export const ETIQUETA_PROVEEDOR: Record<ProveedorCorreo, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

const CLAVE_PROVEEDOR_ACTIVO = "correo_proveedor_activo";

async function obtenerSeguro(clave: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}
async function guardarSeguro(clave: string, valor: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(clave, valor);
  } catch {
    /* no-op */
  }
}
async function borrarSeguro(clave: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(clave);
  } catch {
    /* no-op */
  }
}

function moduloDe(proveedor: ProveedorCorreo) {
  return proveedor === "gmail" ? gmail : outlook;
}

export function proveedorConfigurado(proveedor: ProveedorCorreo): boolean {
  return moduloDe(proveedor).correoConfigurado();
}

export function algunProveedorConfigurado(): boolean {
  return gmail.correoConfigurado() || outlook.correoConfigurado();
}

/** Cuál proveedor está conectado ahora mismo (solo puede haber uno activo por vez), o null si ninguno. */
export async function proveedorConectado(): Promise<ProveedorCorreo | null> {
  const guardado = (await obtenerSeguro(CLAVE_PROVEEDOR_ACTIVO)) as ProveedorCorreo | null;
  if (!guardado) return null;
  const sigueConectado = await moduloDe(guardado).hayCorreoConectado();
  return sigueConectado ? guardado : null;
}

export async function conectarProveedor(proveedor: ProveedorCorreo): Promise<void> {
  // Solo un proveedor conectado a la vez: si había otro, se desconecta primero.
  const actual = await proveedorConectado();
  if (actual && actual !== proveedor) await moduloDe(actual).desconectarCorreo();

  await moduloDe(proveedor).conectarCorreo();
  await guardarSeguro(CLAVE_PROVEEDOR_ACTIVO, proveedor);
}

/** Desconecta el proveedor activo. `revocado` indica si el permiso se quitó también en el servidor del proveedor. */
export async function desconectarProveedorActivo(): Promise<{
  proveedor: ProveedorCorreo | null;
  revocado: boolean;
}> {
  const actual = await proveedorConectado();
  const { revocado } = actual ? await moduloDe(actual).desconectarCorreo() : { revocado: false };
  await borrarSeguro(CLAVE_PROVEEDOR_ACTIVO);
  return { proveedor: actual, revocado };
}

/** Trae correos nuevos del proveedor conectado, sea cual sea. */
export async function traerCorreosDelProveedorActivo(desde: Date): Promise<CorreoRecibido[]> {
  const proveedor = await proveedorConectado();
  if (!proveedor) throw new Error("El correo no está conectado.");
  return proveedor === "gmail" ? traerDeGmail(desde) : traerDeOutlook(desde);
}
