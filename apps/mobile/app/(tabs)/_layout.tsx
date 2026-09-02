import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { color } from "../../lib/theme";

const ICONOS: Record<string, keyof typeof Ionicons.glyphMap> = {
  resumen: "home-outline",
  ingresos: "trending-up-outline",
  gastos: "document-text-outline",
  tarjetas: "card-outline",
  mas: "menu-outline",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        tabBarIcon: ({ color: c, size }) => <Ionicons name={ICONOS[route.name]} size={size} color={c} />,
      })}
    >
      <Tabs.Screen name="resumen" options={{ title: "Resumen" }} />
      <Tabs.Screen name="ingresos" options={{ title: "Ingresos" }} />
      <Tabs.Screen name="gastos" options={{ title: "Gastos" }} />
      <Tabs.Screen name="tarjetas" options={{ title: "Tarjetas" }} />
      <Tabs.Screen name="mas" options={{ title: "Más" }} />
    </Tabs>
  );
}
