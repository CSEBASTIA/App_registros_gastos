// Confirmaciones y avisos que funcionan en el teléfono y en la versión web.
// En react-native-web, `Alert.alert` no muestra nada: ahí se usa el diálogo
// del navegador.
import { Alert, Platform } from "react-native";

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

/** Un aviso con un solo botón. Resuelve cuando el usuario lo cierra. */
export function avisar(titulo: string, mensaje: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${titulo}\n\n${mensaje}`);
    return Promise.resolve();
  }
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [{ text: "Entendido", onPress: () => resolver() }], {
      cancelable: true,
      onDismiss: () => resolver(),
    });
  });
}
