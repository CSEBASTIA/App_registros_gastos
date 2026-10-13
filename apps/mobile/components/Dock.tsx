import { useEffect, useState } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, Text, View, type LayoutRectangle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, useTheme, type ThemePreference } from "../lib/theme";
import { AnimatedBackground, BlurFade } from "./Motion";
const ICONOS: Record<string, keyof typeof Ionicons.glyphMap> = { resumen: "home-outline", ingresos: "trending-up-outline", gastos: "document-text-outline", tarjetas: "card-outline", mas: "menu-outline" };
const MODES: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [{ value: "light", label: "Claro", icon: "sunny-outline" }, { value: "dark", label: "Oscuro", icon: "moon-outline" }, { value: "system", label: "Sistema", icon: "phone-portrait-outline" }];
export default function Dock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { color, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [themeLayouts, setThemeLayouts] = useState<Record<string, LayoutRectangle>>({});
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => { setKeyboard(true); setExpanded(false); });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  return <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: color.bg }}>
    <View style={[styles.island, { backgroundColor: color.surface, borderColor: color.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir selector de tema" accessibilityState={{ expanded }} onPress={() => setExpanded(true)} style={styles.handle}><View style={{ width: 30, height: 3, borderRadius: 2, backgroundColor: color.textFaint }} /></Pressable>
      <View style={styles.routes}>
        <AnimatedBackground layout={layouts[state.routes[state.index].key]} color={color.primaryBg} radius={14} />
        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options;
          const selected = index === state.index;
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name} accessibilityState={{ selected }} onLayout={event => { const layout = event.nativeEvent.layout; setLayouts(prev => ({ ...prev, [route.key]: layout })); }}
            onPress={() => { const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true }); if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params); }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={({ pressed }) => [styles.route, { opacity: pressed ? 0.65 : 1 }]}>
            <Ionicons name={ICONOS[route.name] ?? "ellipse-outline"} size={21} color={selected ? color.primary : color.textMuted} />
            <Text numberOfLines={1} style={{ fontFamily: selected ? font.semibold : font.medium, fontSize: 10, color: selected ? color.primary : color.textMuted }}>{options.title ?? route.name}</Text>
            {options.tabBarBadge != null && <Text style={[styles.badge, { backgroundColor: color.danger, color: color.surface }]}>{options.tabBarBadge}</Text>}
          </Pressable>;
        })}
      </View>
    </View>
    <Modal transparent visible={expanded} animationType="none" onRequestClose={() => setExpanded(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar selector de tema" onPress={() => setExpanded(false)} />
        <BlurFade style={[styles.panel, { backgroundColor: color.surface, borderColor: color.border, marginBottom: Math.max(insets.bottom, 12) + 118 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 22, color: color.text }}>Apariencia</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar selector de tema" onPress={() => setExpanded(false)} style={styles.close}><Ionicons name="close" size={22} color={color.textMuted} /></Pressable>
          </View>
          <View style={styles.themeRow}>
            <AnimatedBackground layout={themeLayouts[preference]} color={color.primaryBg} radius={12} />
            {MODES.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: preference === item.value }} onLayout={event => { const layout = event.nativeEvent.layout; setThemeLayouts(prev => ({ ...prev, [item.value]: layout })); }} onPress={() => setPreference(item.value)} style={styles.themeChoice}>
              <Ionicons name={item.icon} size={23} color={preference === item.value ? color.primary : color.textMuted} />
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: preference === item.value ? color.primary : color.text }}>{item.label}</Text>
            </Pressable>)}
          </View>
        </BlurFade>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ island: { borderWidth: 1, borderRadius: 26, paddingHorizontal: 6, paddingBottom: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 }, handle: { height: 44, alignItems: "center", justifyContent: "center" }, routes: { flexDirection: "row", gap: 4 }, route: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 14 }, badge: { position: "absolute", top: 0, right: 8, fontSize: 10, borderRadius: 10, paddingHorizontal: 4 }, overlay: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.2)" }, panel: { padding: 16, borderWidth: 1, borderRadius: 24, gap: 12 }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, themeRow: { flexDirection: "row", gap: 8 }, themeChoice: { flex: 1, minHeight: 72, gap: 6, alignItems: "center", justifyContent: "center" } });

