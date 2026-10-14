import { getSupabaseClient } from "../client";
import type { Ingreso } from "../types/domain";
import type { Database } from "../types/database";
import { cambiosIngresoSchema, type CambiosIngreso } from "../schemas/ingreso.schema";

type IngresoRow = Database["public"]["Tables"]["ingresos"]["Row"];

function filaAIngreso(row: IngresoRow): Ingreso {
  return {
    id: row.id,
    monto: Number(row.monto),
    descripcion: row.descripcion,
    categoriaId: row.categoria_id ?? undefined,
    categoriaDetalle: row.categoria_detalle ?? undefined,
    cuentaId: row.cuenta_id ?? undefined,
    fecha: row.fecha,
    createdAt: row.created_at,
  };
}

export async function listarIngresos(): Promise<Ingreso[]> {
  const { data, error } = await getSupabaseClient()
    .from("ingresos")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(filaAIngreso);
}

export async function crearIngreso(
  ingreso: Omit<Ingreso, "id" | "createdAt">
): Promise<Ingreso> {
  const { data, error } = await getSupabaseClient()
    .from("ingresos")
    .insert({
      monto: ingreso.monto,
      descripcion: ingreso.descripcion,
      categoria_id: ingreso.categoriaId ?? null,
      categoria_detalle: ingreso.categoriaDetalle ?? null,
      cuenta_id: ingreso.cuentaId ?? null,
      fecha: ingreso.fecha,
    })
    .select()
    .single();

  if (error) throw error;
  return filaAIngreso(data);
}

/**
 * Edita un ingreso. Valida los cambios y envía solo los campos presentes;
 * si cambian el monto o la cuenta, la base reajusta los saldos sola.
 */
export async function actualizarIngreso(id: string, cambios: CambiosIngreso): Promise<Ingreso> {
  const c = cambiosIngresoSchema.parse(cambios);
  const { data, error } = await getSupabaseClient()
    .from("ingresos")
    .update({
      ...(c.monto !== undefined ? { monto: c.monto } : {}),
      ...(c.descripcion !== undefined ? { descripcion: c.descripcion } : {}),
      ...(c.categoriaId !== undefined ? { categoria_id: c.categoriaId } : {}),
      ...(c.categoriaDetalle !== undefined ? { categoria_detalle: c.categoriaDetalle } : {}),
      ...(c.cuentaId !== undefined ? { cuenta_id: c.cuentaId } : {}),
      ...(c.fecha !== undefined ? { fecha: c.fecha } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return filaAIngreso(data);
}

export async function eliminarIngreso(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("ingresos").delete().eq("id", id);
  if (error) throw error;
}
