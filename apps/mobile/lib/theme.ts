import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const lightColor = {
 bg: "#f1f2f7", surface: "#ffffff", surface2: "#e9ebf3", border: "#d8dae3",
 text: "#14151d", textMuted: "#52566b", textFaint: "#8a8ea3", primary: "#3552d1", primaryBg: "#e7ebfb",
 danger: "#c23b34", dangerBg: "#fbeae9", success: "#157a4b", successBg: "#e5f4ec", warning: "#a5690a", warningBg: "#f8ecda",
};
export type Colors = typeof lightColor;
export const darkColor: Colors = {
 bg: "#11131d", surface: "#1c1f2d", surface2: "#272b3d", border: "#393e54",
 text: "#f2f3fa", textMuted: "#b4bad0", textFaint: "#949cb8", primary: "#9aafff", primaryBg: "#2b365d",
 danger: "#ffaaa4", dangerBg: "#452827", success: "#7fd6a6", successBg: "#203c30", warning: "#edc17e", warningBg: "#423522",
};
export const color = lightColor;
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };
export const spacing = (n: number) => n * 4;
export const font = { display: "Fraunces", body: "IBMPlexSans", medium: "IBMPlexSansMedium", semibold: "IBMPlexSansSemiBold", mono: "IBMPlexMono" };
export const typography = {
 title: { fontFamily: font.display, fontSize: 30, lineHeight: 36 }, heading: { fontFamily: font.display, fontSize: 22, lineHeight: 28 },
 body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 }, label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
 amount: { fontFamily: font.mono, fontSize: 24, lineHeight: 32 },
};
export type ThemePreference = "light" | "dark" | "system";
const KEY = "gastos-app:visual-theme";
const ThemeContext = createContext({ color, mode: "light" as "light" | "dark", preference: "system" as ThemePreference, setPreference: (_value: ThemePreference) => {}, reduceMotion: true, ready: false });
export function ThemeProvider({ children }: { children: ReactNode }) {
 const system = useColorScheme();
 const [preference, setValue] = useState<ThemePreference>("system");
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
