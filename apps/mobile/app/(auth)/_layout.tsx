import { Stack } from "expo-router";

// Layout propio del grupo (auth): sin él, la entrada <Stack.Screen name="(auth)">
// del _layout raíz apunta a una ruta que no existe y expo-router lo avisa en
// cada arranque. Login, registro y conectar correo van sin cabecera.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "none" }} />;
}
