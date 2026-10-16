import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setSupabaseClient } from "../src/client.ts";
import {
  DOCUMENTOS_LEGALES,
  VERSION_LEGAL,
  datosAceptacionRegistro,
  destinoPorAceptacion,
  documentosPendientes,
  esDocumentoLegal,
  esVersionLegal,
  plataformaLegal,
} from "../src/lib/legal.ts";
import {
  aceptarDocumentosPendientes,
  documentosLegalesPendientes,
  listarAceptaciones,
  registrarAceptacion,
} from "../src/repositories/legal.repo.ts";

const leer = (rutaDesdeLaRaiz: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rutaDesdeLaRaiz}`, import.meta.url)), "utf8");

// ---------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------

test("esVersionLegal: solo fechas reales AAAA-MM-DD", () => {
  for (const ok of ["2026-10-16", "2027-02-28", "2028-02-29"]) assert.ok(esVersionLegal(ok), ok);
  for (const mal of ["", "hoy", "2026-1-1", "2026-13-45", "2027-02-29", "2026-10-16T00:00", " 2026-10-16", "2026/10/16"]) {
    assert.ok(!esVersionLegal(mal), JSON.stringify(mal));
  }
});

test("documentos y plataformas: solo los conocidos", () => {
  assert.deepEqual([...DOCUMENTOS_LEGALES], ["terminos", "privacidad"]);
  assert.ok(esDocumentoLegal("terminos") && esDocumentoLegal("privacidad"));
  assert.ok(!esDocumentoLegal("cookies") && !esDocumentoLegal(""));
  assert.equal(plataformaLegal("android"), "android");
  assert.equal(plataformaLegal("ios"), "ios");
  assert.equal(plataformaLegal("web"), "web");
  assert.equal(plataformaLegal("windows"), undefined);
  assert.equal(plataformaLegal(undefined), undefined);
});

test("VERSION_LEGAL: fechas válidas, dentro del rango que acepta la base (desde 2026-10-01)", () => {
  for (const doc of DOCUMENTOS_LEGALES) {
    assert.ok(esVersionLegal(VERSION_LEGAL[doc]), doc);
    assert.ok(VERSION_LEGAL[doc] >= "2026-10-01", `${doc}: la base rechaza versiones anteriores a 2026-10-01`);
  }
});

test("documentosPendientes: sin aceptaciones faltan los dos; con ambas vigentes, ninguno", () => {
  assert.deepEqual(documentosPendientes([]), ["terminos", "privacidad"]);
  const al_dia = DOCUMENTOS_LEGALES.map((documento) => ({ documento, version: VERSION_LEGAL[documento] }));
  assert.deepEqual(documentosPendientes(al_dia), []);
});

test("documentosPendientes: solo falta el que no aceptó, o el que cambió de versión", () => {
  const vigentes = { terminos: "2026-11-01", privacidad: "2026-10-16" } as const;
  const aceptadas = [
    { documento: "terminos", version: "2026-10-16" }, // versión vieja de los términos
    { documento: "privacidad", version: "2026-10-16" },
  ];
  assert.deepEqual(documentosPendientes(aceptadas, vigentes), ["terminos"]);
  assert.deepEqual(documentosPendientes([{ documento: "privacidad", version: "2026-10-16" }], vigentes), ["terminos"]);
  assert.deepEqual(documentosPendientes([{ documento: "terminos", version: "2026-11-01" }], vigentes), ["privacidad"]);
});

test("documentosPendientes: una versión MÁS NUEVA ya aceptada no se vuelve a pedir; una inválida no cuenta", () => {
  const vigentes = { terminos: "2026-10-16", privacidad: "2026-10-16" } as const;
  assert.deepEqual(
    documentosPendientes(
      [
        { documento: "terminos", version: "2027-01-01" },
        { documento: "privacidad", version: "2099-99-99" }, // basura: no es fecha
      ],
      vigentes
    ),
    ["privacidad"]
  );
  assert.deepEqual(documentosPendientes([{ documento: "cookies", version: "2026-10-16" }], vigentes), ["terminos", "privacidad"]);
});

test("datosAceptacionRegistro: manda la versión vigente de cada documento y la plataforma si se conoce", () => {
  assert.deepEqual(datosAceptacionRegistro(), {
    acepta_terminos: VERSION_LEGAL.terminos,
    acepta_privacidad: VERSION_LEGAL.privacidad,
  });
  assert.deepEqual(datosAceptacionRegistro("android"), {
    acepta_terminos: VERSION_LEGAL.terminos,
    acepta_privacidad: VERSION_LEGAL.privacidad,
    plataforma: "android",
  });
});

test("destinoPorAceptacion: sin exigirla, o sin sesión, no interviene", () => {
  for (const estado of ["comprobando", "al-dia", "pendiente", "error"] as const) {
    assert.equal(destinoPorAceptacion({ exigir: false, haySesion: true, estado, ruta: "/resumen" }), null, `exigir=false, ${estado}`);
    assert.equal(destinoPorAceptacion({ exigir: true, haySesion: false, estado, ruta: "/login" }), null, `sin sesión, ${estado}`);
  }
});

test("destinoPorAceptacion: mientras comprueba, espera (no navega)", () => {
  for (const ruta of ["/login", "/resumen", "/aceptar-terminos"]) {
    assert.equal(destinoPorAceptacion({ exigir: true, haySesion: true, estado: "comprobando", ruta }), "esperar", ruta);
  }
});

test("destinoPorAceptacion: con pendientes o con error, todo lleva a aceptar y de ahí no se sale", () => {
  for (const estado of ["pendiente", "error"] as const) {
    for (const ruta of ["/", "/login", "/resumen", "/cuentas", "/ubicacion"]) {
      assert.equal(destinoPorAceptacion({ exigir: true, haySesion: true, estado, ruta }), "/aceptar-terminos", `${estado} en ${ruta}`);
    }
    assert.equal(destinoPorAceptacion({ exigir: true, haySesion: true, estado, ruta: "/aceptar-terminos" }), "esperar", estado);
  }
});

test("destinoPorAceptacion: al día, sigue lo normal y la pantalla de aceptación devuelve al resumen", () => {
  assert.equal(destinoPorAceptacion({ exigir: true, haySesion: true, estado: "al-dia", ruta: "/resumen" }), null);
  assert.equal(destinoPorAceptacion({ exigir: true, haySesion: true, estado: "al-dia", ruta: "/login" }), null);
  assert.equal(destinoPorAceptacion({ exigir: true, haySesion: true, estado: "al-dia", ruta: "/aceptar-terminos" }), "/resumen");
});

// ---------------------------------------------------------------------
// Repositorio, con un cliente de Supabase simulado
// ---------------------------------------------------------------------

type Fila = { documento: string; version: string; plataforma: string | null; origen: string; aceptado_en: string };

function clienteFalso(filas: Fila[], errorRpc: unknown = null) {
  const rpcs: { nombre: string; args: Record<string, unknown> }[] = [];
  const consulta = {
    select: () => consulta,
    order: () => consulta,
    then: (resolver: (v: unknown) => unknown) => resolver({ data: filas, error: null }),
  };
  setSupabaseClient({
    from: (tabla: string) => {
      assert.equal(tabla, "aceptaciones_legales");
      return consulta;
    },
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      rpcs.push({ nombre, args });
      return { data: null, error: errorRpc };
    },
  } as any);
  return rpcs;
}

const fila = (documento: string, version: string, extra: Partial<Fila> = {}): Fila => ({
  documento,
  version,
  plataforma: "android",
  origen: "registro",
  aceptado_en: "2026-10-16T10:00:00Z",
  ...extra,
});

test("listarAceptaciones: convierte las filas y descarta documentos o versiones desconocidos", async () => {
  clienteFalso([
    fila("terminos", "2026-10-16"),
    fila("privacidad", "2026-10-16", { plataforma: null, origen: "app" }),
    fila("cookies", "2026-10-16"),
    fila("terminos", "hoy"),
  ]);
  const r = await listarAceptaciones();
  assert.deepEqual(r, [
    { documento: "terminos", version: "2026-10-16", plataforma: "android", origen: "registro", aceptadoEn: "2026-10-16T10:00:00Z" },
    { documento: "privacidad", version: "2026-10-16", plataforma: undefined, origen: "app", aceptadoEn: "2026-10-16T10:00:00Z" },
  ]);
});

test("registrarAceptacion: manda a la base la versión de ESTA app, no una que elija la pantalla", async () => {
  const rpcs = clienteFalso([]);
  await registrarAceptacion("terminos", "web");
  await registrarAceptacion("privacidad");
  assert.deepEqual(rpcs, [
    { nombre: "registrar_aceptacion_legal", args: { p_documento: "terminos", p_version: VERSION_LEGAL.terminos, p_plataforma: "web" } },
    { nombre: "registrar_aceptacion_legal", args: { p_documento: "privacidad", p_version: VERSION_LEGAL.privacidad } },
  ]);
});

test("registrarAceptacion: un documento desconocido ni sale a la red; un error de la base se propaga", async () => {
  const rpcs = clienteFalso([]);
  await assert.rejects(() => registrarAceptacion("cookies" as any), /desconocido/);
  assert.equal(rpcs.length, 0);
  clienteFalso([], { message: "Versión del documento no válida." });
  await assert.rejects(() => registrarAceptacion("terminos"), (e: any) => e.message === "Versión del documento no válida.");
});

test("documentosLegalesPendientes y aceptarDocumentosPendientes: solo registra lo que falta", async () => {
  // Cuenta anterior a los términos: no tiene nada aceptado.
  let rpcs = clienteFalso([]);
  assert.deepEqual(await documentosLegalesPendientes(), ["terminos", "privacidad"]);
  assert.deepEqual(await aceptarDocumentosPendientes("android"), ["terminos", "privacidad"]);
  assert.deepEqual(rpcs.map((r) => r.args.p_documento), ["terminos", "privacidad"]);

  // Ya aceptó los términos: solo falta la privacidad.
  rpcs = clienteFalso([fila("terminos", VERSION_LEGAL.terminos)]);
  assert.deepEqual(await aceptarDocumentosPendientes(), ["privacidad"]);
  assert.deepEqual(rpcs.map((r) => r.args.p_documento), ["privacidad"]);

  // Al día: no llama a la base.
  rpcs = clienteFalso([fila("terminos", VERSION_LEGAL.terminos), fila("privacidad", VERSION_LEGAL.privacidad)]);
  assert.deepEqual(await aceptarDocumentosPendientes(), []);
  assert.equal(rpcs.length, 0);
});

// ---------------------------------------------------------------------
// Los textos legales y el código no se pueden separar sin que una prueba falle
// ---------------------------------------------------------------------

const PAGINAS = { terminos: "apps/mobile/public/terminos.html", privacidad: "apps/mobile/public/privacidad.html" } as const;

test("cada página declara la misma versión que VERSION_LEGAL (y la muestra a la persona)", () => {
  for (const doc of DOCUMENTOS_LEGALES) {
    const html = leer(PAGINAS[doc]);
    const meta = html.match(/<meta name="version-legal" content="([^"]+)"/)?.[1];
    assert.equal(meta, VERSION_LEGAL[doc], `${doc}: la etiqueta version-legal no coincide con VERSION_LEGAL`);
    assert.ok(html.includes(`Versión ${VERSION_LEGAL[doc]}`), `${doc}: la página no muestra "Versión ${VERSION_LEGAL[doc]}"`);
  }
});

test("las páginas se enlazan entre sí y la de privacidad conserva el ancla de eliminar la cuenta (Google Play)", () => {
  const terminos = leer(PAGINAS.terminos);
  const privacidad = leer(PAGINAS.privacidad);
  assert.ok(terminos.includes('href="privacidad.html"'));
  assert.ok(privacidad.includes('href="terminos.html"'));
  assert.ok(privacidad.includes('id="eliminar-cuenta"'));
});

test("las páginas solo dejan pendientes los datos que docs/legal/README.md dice que hay que completar", () => {
  const permitidos = new Set([
    "Nombre completo o razón social",
    "cédula o RUC",
    "ciudad",
    "correo de contacto",
    "fecha de publicación",
    "región del proyecto de Supabase, por ejemplo Estados Unidos",
    "número",
  ]);
  for (const doc of DOCUMENTOS_LEGALES) {
    const sinComentarios = leer(PAGINAS[doc]).replace(/<!--[\s\S]*?-->/g, "");
    for (const [, texto] of sinComentarios.matchAll(/\[([^\]\n]+)\]/g)) {
      assert.ok(permitidos.has(texto), `${doc}: campo pendiente desconocido [${texto}]`);
    }
  }
});

test("el registro de tratamiento de datos menciona TODAS las tablas de la base", () => {
  const tipos = leer("packages/core/src/types/database.ts");
  const tablas = tipos
    .slice(tipos.indexOf("Tables: {"), tipos.indexOf("Views:"))
    .matchAll(/^ {6}([a-z_]+): \{$/gm);
  const nombres = [...tablas].map((m) => m[1]);
  assert.ok(nombres.length >= 13, `se esperaban al menos 13 tablas, hay ${nombres.length}`);
  assert.ok(nombres.includes("aceptaciones_legales"));
  const registro = leer("docs/legal/registro-tratamiento-datos.md");
  const faltan = nombres.filter((t) => !registro.includes(`\`${t}\``));
  assert.deepEqual(faltan, [], `Tablas que faltan en docs/legal/registro-tratamiento-datos.md: ${faltan.join(", ")}`);
});
