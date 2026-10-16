-- =====================================================================
-- gastos-app — Migración de eliminar cuenta
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261015190000_eliminar_cuenta.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261015190000_eliminar_cuenta.sql
-- Migración de eliminar cuenta.
--
-- Google Play exige que quien se registra pueda borrar su cuenta desde la
-- app, y la Ley Orgánica de Protección de Datos Personales de Ecuador da
-- derecho a la eliminación. La app no puede borrar usuarios de auth (eso
-- requiere la clave service_role, que nunca va en una app): lo hace esta
-- función, y solo para quien la llama.
--
-- Las facturas (archivos en Storage) las borra antes la app con la API de
-- Storage: Supabase no permite borrar archivos con SQL. Si queda alguna, la
-- función se niega, para no dejar facturas huérfanas con datos personales.
create or replace function public.eliminar_mi_cuenta(p_confirmacion text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  -- Evita que un error de programación borre la cuenta sin querer.
  if p_confirmacion is distinct from 'ELIMINAR' then
    raise exception 'Escribe ELIMINAR para confirmar.' using errcode = '22023';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'facturas' and (storage.foldername(name))[1] = v_usuario::text
  ) then
    raise exception 'Todavía quedan facturas guardadas. Inténtalo de nuevo.' using errcode = '22023';
  end if;

  -- Las 10 tablas de la app apuntan a auth.users con ON DELETE CASCADE: se
  -- borran todos sus datos (y sus sesiones, que también cuelgan de auth.users).
  delete from auth.users where id = v_usuario;
end;
$$;

revoke all on function public.eliminar_mi_cuenta(text) from public, anon;
grant execute on function public.eliminar_mi_cuenta(text) to authenticated;


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261015190000', 'eliminar_cuenta')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261015190000') then 'sí' else 'no' end as aplicada;
