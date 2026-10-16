-- =====================================================================
-- gastos-app — Migración de resumen por lugar
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261016150000_resumen_por_lugar.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261016150000_resumen_por_lugar.sql
-- Migración de resumen por lugar (Fase 5 del plan de billeteras).
--
-- 1) resumen_por_lugar: cuánto pagaste en cada lugar, cuántas veces y cuándo.
-- 2) resumen_por_comercio: junta los lugares con el MISMO nombre (sin mirar
--    mayúsculas ni espacios). Para juntar dos sucursales basta con ponerles el
--    mismo nombre: cada una conserva su ubicación.
-- 3) fusionar_lugares: pasa los pagos de un lugar a otro y borra el primero,
--    en un solo paso.
-- Renombrar y borrar un lugar no necesitan función: son un UPDATE/DELETE
-- normales, limitados por RLS (migración de billeteras y ubicación).
--
-- Todas son `security invoker`: corren con los permisos de quien llama y RLS
-- filtra lo propio; además se filtra por auth.uid() explícitamente. El rango
-- de fechas se limita a 2 años para que nadie pida una consulta enorme. Usan
-- el índice existente gastos (usuario_id, fecha).

create or replace function public.resumen_por_lugar(p_desde date, p_hasta date)
returns table (
  lugar_id uuid,
  nombre text,
  latitud numeric,
  longitud numeric,
  pagos integer,
  total numeric,
  promedio numeric,
  -- Parte del total pagado en lugares durante el rango, en %.
  porcentaje numeric,
  primer_pago date,
  ultimo_pago date,
  -- La más frecuente; con empate, cualquiera de las empatadas.
  categoria_id uuid,
  -- La más usada; null si ningún pago fue con billetera.
  billetera text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null then
    raise exception 'Indica el rango de fechas.' using errcode = '22023';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha final es anterior a la inicial.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 731 then
    raise exception 'El rango máximo es de 2 años.' using errcode = '22023';
  end if;

  return query
  select
    l.id,
    l.nombre,
    l.latitud,
    l.longitud,
    count(*)::integer,
    sum(g.monto),
    round(avg(g.monto), 2),
    round(100 * sum(g.monto) / nullif(sum(sum(g.monto)) over (), 0), 1),
    min(g.fecha),
    max(g.fecha),
    mode() within group (order by g.categoria_id),
    mode() within group (order by g.billetera)
  from gastos g
  join lugares l on l.id = g.lugar_id
  where g.usuario_id = v_usuario
    and l.usuario_id = v_usuario
    and g.fecha between p_desde and p_hasta
  group by l.id
  order by sum(g.monto) desc, max(g.fecha) desc, l.id;
end;
$$;

create or replace function public.resumen_por_comercio(p_desde date, p_hasta date)
returns table (
  comercio text,
  locales integer,
  pagos integer,
  total numeric,
  promedio numeric,
  ultimo_pago date,
  lugar_ids uuid[]
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null then
    raise exception 'Indica el rango de fechas.' using errcode = '22023';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha final es anterior a la inicial.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 731 then
    raise exception 'El rango máximo es de 2 años.' using errcode = '22023';
  end if;

  return query
  select
    -- El nombre tal como está escrito en el lugar con más pagos.
    mode() within group (order by l.nombre),
    count(distinct l.id)::integer,
    count(*)::integer,
    sum(g.monto),
    round(avg(g.monto), 2),
    max(g.fecha),
    array_agg(distinct l.id)
  from gastos g
  join lugares l on l.id = g.lugar_id
  where g.usuario_id = v_usuario
    and l.usuario_id = v_usuario
    and g.fecha between p_desde and p_hasta
  group by lower(regexp_replace(btrim(l.nombre), '\s+', ' ', 'g'))
  order by sum(g.monto) desc, max(g.fecha) desc;
end;
$$;

create or replace function public.fusionar_lugares(p_origen uuid, p_destino uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_propios int;
  v_movidos int;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_origen is null or p_destino is null or p_origen = p_destino then
    raise exception 'Elige dos lugares distintos.' using errcode = '22023';
  end if;

  -- Bloquea los dos lugares, siempre en el mismo orden (sin interbloqueos).
  perform 1 from lugares
  where id in (p_origen, p_destino) and usuario_id = v_usuario
  order by id
  for update;
  select count(*) into v_propios from lugares where id in (p_origen, p_destino) and usuario_id = v_usuario;
  if v_propios <> 2 then
    raise exception 'El lugar indicado no existe o no es tuyo.' using errcode = '42501';
  end if;

  update gastos set lugar_id = p_destino where lugar_id = p_origen and usuario_id = v_usuario;
  get diagnostics v_movidos = row_count;
  delete from lugares where id = p_origen and usuario_id = v_usuario;
  return v_movidos;
end;
$$;

revoke all on function public.resumen_por_lugar(date, date) from public, anon;
revoke all on function public.resumen_por_comercio(date, date) from public, anon;
revoke all on function public.fusionar_lugares(uuid, uuid) from public, anon;
grant execute on function public.resumen_por_lugar(date, date) to authenticated;
grant execute on function public.resumen_por_comercio(date, date) to authenticated;
grant execute on function public.fusionar_lugares(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261016150000', 'resumen_por_lugar')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261016150000') then 'sí' else 'no' end as aplicada;
