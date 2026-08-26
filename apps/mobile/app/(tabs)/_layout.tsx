import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Gastos" }} />
      <Tabs.Screen name="nuevo" options={{ title: "Nuevo" }} />
      <Tabs.Screen name="resumen" options={{ title: "Resumen" }} />
    </Tabs>
  );
}
