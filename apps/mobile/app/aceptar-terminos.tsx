import { useContext, useState } from "react";
import { Platform } from "react-native";
import { aceptarDocumentosPendientes, mensajeError, plataformaLegal } from "core";
import { supabase } from "../lib/supabase";
import { AceptacionContext } from "../lib/legal";
import PantallaAceptacion from "../components/PantallaAceptacion";

/**
 * Pantalla de aceptación de términos y privacidad. La guarda de rutas de
 * `app/_layout.tsx` lleva aquí a quien inició sesión sin haber aceptado la
 * versión vigente (solo con EXPO_PUBLIC_EXIGIR_ACEPTACION=1). Al aceptar, la
 * guarda se entera por el contexto y devuelve a la persona al resumen.
 */
export default function AceptarTerminos() {
  const { estado, pendientes, error: errorCarga, reintentar, alDia } = useContext(AceptacionContext);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setError(null);
    setGuardando(true);
    try {
      await aceptarDocumentosPendientes(plataformaLegal(Platform.OS));
      alDia();
    } catch (err) {
      setError(mensajeError(err));
      setGuardando(false);
    }
  }

  return (
    <PantallaAceptacion
      // "al-dia" dura un instante, hasta que la guarda cambia de ruta.
      estado={estado === "al-dia" ? "comprobando" : estado}
      pendientes={pendientes}
      errorCarga={errorCarga}
      guardando={guardando}
      error={error}
      onAceptar={aceptar}
      onReintentar={reintentar}
      onCerrarSesion={() => supabase.auth.signOut()}
    />
  );
}
