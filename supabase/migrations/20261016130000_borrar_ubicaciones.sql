-- Migración de borrar ubicaciones (Fase 2 del plan de billeteras).
--
-- "Borrar todas mis ubicaciones": la Ley Orgánica de Protección de Datos
-- Personales da derecho a eliminar un dato personal sin borrar la cuenta.
-- En un solo paso (una transacción): quita la ubicación y el lugar de todos
-- los gastos, la ubicación de los avisos de la bandeja y borra los lugares.
-- Los gastos y sus montos no cambian: los saldos quedan igual.
--
-- `security invoker`: corre con los permisos de quien llama; RLS limita cada
-- UPDATE/DELETE a sus filas, y además se filtra por auth.uid() explícitamente.

create or replace function public.borrar_mis_ubicaciones()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_gastos int;
  v_avisos int;
  v_lugares int;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;

  update gastos
  set latitud = null, longitud = null, precision_m = null, lugar_id = null
  where usuario_id = v_usuario and (latitud is not null or lugar_id is not null);
  get diagnostics v_gastos = row_count;

  update transacciones_detectadas
  set latitud = null, longitud = null, precision_m = null
  where usuario_id = v_usuario and latitud is not null;
  get diagnostics v_avisos = row_count;

  delete from lugares where usuario_id = v_usuario;
  get diagnostics v_lugares = row_count;

  return jsonb_build_object('gastos', v_gastos, 'avisos', v_avisos, 'lugares', v_lugares);
end;
$$;

revoke execute on function public.borrar_mis_ubicaciones() from public, anon;
grant execute on function public.borrar_mis_ubicaciones() to authenticated;

notify pgrst, 'reload schema';
