import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const lightColor = {
 bg: "#ffffff", surface: "#ffffff", surface2: "#f5f5f5", border: "#dedede",
 text: "#111111", textMuted: "#62666c", textFaint: "#85898f", primary: "#111111", primaryBg: "#f1f1f1",
 danger: "#c23b34", dangerBg: "#fbeae9", success: "#157a4b", successBg: "#e5f4ec", warning: "#a5690a", warningBg: "#f8ecda",
};
export type Colors = typeof lightColor;
export const darkColor: Colors = {
 bg: "#171717", surface: "#202020", surface2: "#2a2a2a", border: "#3b3b3b",
 text: "#f5f5f5", textMuted: "#c1c1c1", textFaint: "#989898", primary: "#f2f2f2", primaryBg: "#353535",
 danger: "#ffaaa4", dangerBg: "#452827", success: "#7fd6a6", successBg: "#203c30", warning: "#edc17e", warningBg: "#423522",
};
export const color = lightColor;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const spacing = (n: number) => n * 4;
export const font = { display: "IBMPlexSans", body: "IBMPlexSans", medium: "IBMPlexSansMedium", semibold: "IBMPlexSansSemiBold", mono: "IBMPlexMono" };
export const typography = {
 title: { fontFamily: font.display, fontSize: 30, lineHeight: 36 }, heading: { fontFamily: font.display, fontSize: 22, lineHeight: 28 },
 body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 }, label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
 amount: { fontFamily: font.mono, fontSize: 24, lineHeight: 32 },
};
export type ThemePreference = "light" | "dark" | "system";
const KEY = "gastos-app:zallox-theme-v1";
const ThemeContext = createContext({ color, mode: "light" as "light" | "dark", preference: "light" as ThemePreference, setPreference: (_value: ThemePreference) => {}, reduceMotion: true, ready: false });
export function ThemeProvider({ children }: { children: ReactNode }) {
 const system = useColorScheme();
 const [preference, setValue] = useState<ThemePreference>("light");
 const [ready, setReady] = useState(false);
 const [reduceMotion, setReduceMotion] = useState(true);
 useEffect(() => {
  let alive = true;
  AsyncStorage.getItem(KEY).then(value => { if (alive && (value === "light" || value === "dark" || value === "system")) setValue(value); }).catch(() => {}).finally(() => { if (alive) setReady(true); });
  AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); }).catch(() => {});
  const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
  return () => { alive = false; listener.remove(); };
 }, []);
 const mode = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
 const setPreference = (value: ThemePreference) => { setValue(value); AsyncStorage.setItem(KEY, value).catch(() => {}); };
 return createElement(ThemeContext.Provider, { value: { color: mode === "dark" ? darkColor : lightColor, mode, preference, setPreference, reduceMotion, ready } }, children);
}
export const useTheme = () => useContext(ThemeContext);
