import { useEffect, useState, type ReactNode } from "react";
import { Animated, FlatList, type StyleProp, type ViewStyle } from "react-native";
import { BlurFade } from "./Motion";
import { useTheme } from "../lib/theme";
type Entry<T> = { key: string; item: T; leaving: boolean };
function Leaving({ children }: { children: ReactNode }) {
  const { reduceMotion } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => { const animation = Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 160, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [opacity, reduceMotion]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ opacity }}>{children}</Animated.View>;
}
/** Virtualized presentation for future notifications; no data source attached. */
export default function AnimatedList<T>({ items, getKey, renderItem, style }: { items: T[]; getKey: (item: T) => string; renderItem: (item: T, index: number) => ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useTheme();
  const [entries, setEntries] = useState<Entry<T>[]>(() => items.map(item => ({ key: getKey(item), item, leaving: false })));
  useEffect(() => {
    const next = items.map(item => ({ key: getKey(item), item, leaving: false }));
    const keys = new Set(next.map(entry => entry.key));
    setEntries(previous => [...next, ...previous.filter(entry => !keys.has(entry.key)).map(entry => ({ ...entry, leaving: true }))]);
    const timer = setTimeout(() => setEntries(next), reduceMotion ? 0 : 180);
    return () => clearTimeout(timer);
  }, [items, getKey, reduceMotion]);
  return <FlatList style={style} data={entries} keyExtractor={entry => entry.key} renderItem={({ item: entry, index }) => entry.leaving ? <Leaving>{renderItem(entry.item, index)}</Leaving> : <BlurFade delay={Math.min(index * 35, 210)}>{renderItem(entry.item, index)}</BlurFade>} />;
}
