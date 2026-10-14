import { Redirect } from "expo-router";

// La ruta raíz "/" no tiene pantalla propia (el inicio es la pestaña
// Resumen). Sin este archivo expo-router muestra "Unmatched Route" al abrir
// la app en "/". Si no hay sesión, el _layout raíz redirige luego a /login.
export default function Inicio() {
  return <Redirect href="/resumen" />;
}
