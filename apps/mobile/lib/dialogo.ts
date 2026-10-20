// Confirmaciones nativas y notificaciones visuales para móvil y web.
// En react-native-web, `Alert.alert` no muestra nada: ahí se usa el diálogo
// del navegador.
import { Alert, Platform } from "react-native";
import { notificar, type TipoNotificacion } from "./notificaciones";

/** Pregunta antes de una acción que no se puede deshacer. Resuelve `true` si el usuario acepta. */
export function confirmar(titulo: string, mensaje: string, accion: string, peligro = true): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" && window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: "Cancelar", style: "cancel", onPress: () => resolver(false) },
      { text: accion, style: peligro ? "destructive" : "default", onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) });
  });
}

/** Notificación breve, expandible y descartable con el gesto de deslizar. */
export function avisar(titulo: string, mensaje: string, tipo: TipoNotificacion = "info"): Promise<void> {
  notificar({ titulo, descripcion: mensaje, tipo });
  return Promise.resolve();
}
