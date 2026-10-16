import type { ReactNode } from "react";
import { Text } from "react-native";
import { abrirDocumento } from "../lib/legal";
import { useTheme, font } from "../lib/theme";

/**
 * Nombre de un documento legal dentro de una frase. Con dirección, es un
 * enlace que abre el documento; sin ella (desarrollo), queda como texto.
 */
export default function EnlaceLegal({ url, children }: { url?: string; children: ReactNode }) {
  const { color } = useTheme();
  if (!url) return <Text style={{ fontFamily: font.semibold, color: color.text }}>{children}</Text>;
  return (
    <Text
      accessibilityRole="link"
      onPress={() => abrirDocumento(url)}
      style={{ fontFamily: font.semibold, color: color.primary, textDecorationLine: "underline" }}
    >
      {children}
    </Text>
  );
}
