import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, type LayoutRectangle, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../lib/theme";

/** Native Blur Fade equivalent, without GPU blur on long lists. */
export function BlurFade({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
 const { reduceMotion } = useTheme();
 const progress = useRef(new Animated.Value(1)).current;
 useEffect(() => {
  if (reduceMotion) { progress.setValue(1); return; }
  progress.setValue(0);
  const animation = Animated.timing(progress, { toValue: 1, duration: 220, delay: Math.min(delay, 300), easing: Easing.out(Easing.cubic), useNativeDriver: true });
  animation.start(); return () => animation.stop();
 }, [reduceMotion, delay, progress]);
 return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>{children}</Animated.View>;
}

export function AnimatedBackground({ layout, color, radius = 999 }: { layout?: LayoutRectangle; color: string; radius?: number }) {
 const { reduceMotion } = useTheme();
 const x = useRef(new Animated.Value(layout?.x ?? 0)).current;
 const width = useRef(new Animated.Value(layout?.width ?? 0)).current;
 useEffect(() => {
  if (!layout) return;
  const animation = Animated.parallel([Animated.timing(x, { toValue: layout.x, duration: reduceMotion ? 0 : 180, useNativeDriver: false }), Animated.timing(width, { toValue: layout.width, duration: reduceMotion ? 0 : 180, useNativeDriver: false })]);
  animation.start(); return () => animation.stop();
 }, [layout, reduceMotion, x, width]);
 if (!layout) return null;
 return <Animated.View pointerEvents="none" style={{ position: "absolute", left: x, top: layout.y, width, height: layout.height, backgroundColor: color, borderRadius: radius }} />;
}
