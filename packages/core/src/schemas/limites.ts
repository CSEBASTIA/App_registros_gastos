import { z } from "zod";

/**
 * Límites de entrada compartidos por todos los esquemas. Son los mismos que
 * imponen los CHECK de la base (migración 20261013120000_seguridad_y_presupuestos):
 * validar acá da un mensaje claro antes de ir a la red, y la base es la
 * última barrera si alguien llama a la API sin pasar por la app.
 */
export const LIMITES = {
  descripcion: 200,
  nombre: 80,
  titulo: 120,
  detalle: 80,
  estilo: 60,
  facturaPath: 300,
  asunto: 300,
  /** numeric(12,2) admite hasta 9 999 999 999.99. */
  monto: 9_999_999_999.99,
  /** numeric(5,2). */
  tasaInteres: 999.99,
} as const;

export const FECHA_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MES_ISO = /^\d{4}-(0[1-9]|1[0-2])$/;

export const textoRequerido = (max: number) =>
  z.string().trim().min(1, "No puede estar vacío").max(max, `Máximo ${max} caracteres`);

export const montoPositivo = () =>
  z.number().positive("Debe ser mayor que 0").max(LIMITES.monto, "Monto demasiado grande");

export const montoNoNegativo = () =>
  z.number().nonnegative("No puede ser negativo").max(LIMITES.monto, "Monto demasiado grande");

export const fechaIso = () => z.string().regex(FECHA_ISO, "Formato esperado: YYYY-MM-DD");
