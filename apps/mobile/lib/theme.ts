import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const lightColor = {
 bg: "#f6f7f4", surface: "#ffffff", surface2: "#eff2ed", border: "#e2e7df",
 text: "#202421", textMuted: "#66706a", textFaint: "#7b857d", primary: "#202421", primaryBg: "#eff2ed",
 danger: "#a35d56", dangerBg: "#f9eeeb", success: "#257b57", successBg: "#eaf4ed", warning: "#956414", warningBg: "#f8f0dc",
};
export type Colors = typeof lightColor;
export const darkColor: Colors = {
 bg: "#171a18", surface: "#222723", surface2: "#2d352e", border: "#343b35",
 text: "#f1f3ef", textMuted: "#b9c2ba", textFaint: "#9ba69c", primary: "#edf1ea", primaryBg: "#2d352e",
 danger: "#dfaaa3", dangerBg: "#3b2d2b", success: "#91d4ad", successBg: "#273b2e", warning: "#edc17e", warningBg: "#423522",
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
