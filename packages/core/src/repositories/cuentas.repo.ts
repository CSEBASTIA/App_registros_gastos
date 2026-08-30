import { getSupabaseClient } from "../client";
import type { Cuenta } from "../types/domain";
import type { Database } from "../types/database";

type CuentaRow = Database["public"]["Tables"]["cuentas"]["Row"];

function filaACuenta(row: CuentaRow): Cuenta {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo as Cuenta["tipo"],
    banco: row.banco as Cuenta["banco"],
    marca: (row.marca as Cuenta["marca"]) ?? undefined,
    estilo: row.estilo ?? undefined,
    cupoTotal: row.cupo_total !== null ? Number(row.cupo_total) : undefined,
    disponible: Number(row.disponible),
    createdAt: row.created_at,
  };
}

export async function listarCuentas(): Promise<Cuenta[]> {
  const { data, error } = await getSupabaseClient()
    .from("cuentas")
    .select("*")
    .order("created_at");

  if (error) throw error;
  return (data ?? []).map(filaACuenta);
}

export async function crearCuenta(cuenta: Omit<Cuenta, "id" | "createdAt">): Promise<Cuenta> {
  const { data, error } = await getSupabaseClient()
    .from("cuentas")
    .insert({
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      banco: cuenta.banco,
      marca: cuenta.marca ?? null,
      estilo: cuenta.estilo ?? null,
      cupo_total: cuenta.cupoTotal ?? null,
      disponible: cuenta.disponible,
    })
    .select()
    .single();

  if (error) throw error;
  return filaACuenta(data);
}

export async function eliminarCuenta(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("cuentas").delete().eq("id", id);
  if (error) throw error;
}
