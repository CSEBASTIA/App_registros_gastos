// Las fuentes de core importan sin extensión ("../types/domain"), como
// espera un bundler (Vite / Metro). Node en modo ESM exige la extensión,
// así que para las pruebas resolvemos "./x" → "./x.ts" cuando hace falta.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        const relativo = specifier.startsWith("./") || specifier.startsWith("../");
        if (relativo && !/\\.[cm]?[jt]s$/.test(specifier)) {
          try {
            return await next(specifier + ".ts", context);
          } catch {}
        }
        return next(specifier, context);
      }
    `)
);
