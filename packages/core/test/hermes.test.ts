import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../..", import.meta.url));

/** Archivos .ts/.tsx que terminan en el paquete del teléfono (core y apps/mobile). */
function fuentes(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    if (nombre === "node_modules" || nombre === "android" || nombre === "assets") return [];
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.tsx?$/.test(nombre) && !nombre.endsWith(".d.ts") ? [ruta] : [];
  });
}

// Hermes (React Native 0.74) no entiende \p{…} en una expresión armada con
// new RegExp: lanza un error al cargar el archivo y la app se cierra al abrirse
// (pasó con el APK 1.4.0). Babel traduce los literales /\p{L}/u, pero no un
// texto: en un texto el patrón se escribe "\\p{…}", que es lo que se busca aquí.
test("ningún new RegExp usa \\p{…}, que el teléfono no entiende", () => {
  const carpetas = ["packages/core/src", "apps/mobile/app", "apps/mobile/lib", "apps/mobile/components", "apps/mobile/modules"];
  const hallados = carpetas
    .flatMap((c) => fuentes(join(raiz, c)))
    .flatMap((archivo) =>
      readFileSync(archivo, "utf8")
        .split("\n")
        .map((linea, i) => (/\\\\[pP]\{/.test(linea) ? `${relative(raiz, archivo)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
  assert.deepEqual(hallados, []);
});
