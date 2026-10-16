-- =====================================================================
-- gastos-app — Migración de recordatorios de diferidos · 16-10-2026 5AM
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261016170000_recordatorios_diferidos.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261016170000_recordatorios_diferidos.sql
-- Migración de recordatorios de diferidos (fase C del plan de cuentas,
-- avisos y resumen).
--
-- Al comprar a cuotas (un gasto diferido), la base ya crea su deuda. Ahora
-- también crea un recordatorio por cada cuota, el mismo día de la compra de
-- cada mes (un 31 en un mes corto cae el último día), con el monto de la
-- cuota. Ejemplo: $130 a 3 meses el 10 de octubre → 10/10, 10/11 y 10/12,
-- de $43,34, $43,34 y $43,32.
--
-- 1) `recordatorios.automatico` marca los que creó la base. Siempre van
--    atados a su deuda.
-- 2) Al registrar un abono, los recordatorios de las cuotas ya pagadas se
--    marcan como hechos. Al saldar la deuda, se cierran todos.
-- 3) Al borrar el diferido (o su deuda), se borran sus recordatorios
--    automáticos. Los que creó el usuario y apuntaban a esa deuda se quedan,
--    sin deuda (antes, esa referencia impedía borrar la deuda).
-- 4) Los diferidos que ya existían reciben sus recordatorios, con las cuotas
--    ya pagadas marcadas como hechas.
--
-- Las fechas siguen la misma regla que `registrar_abono_deuda` usa para el
-- próximo pago, así que la cuota k cierra justo cuando el abono la paga.
-- Sin SQL dinámico.

alter table public.recordatorios add column if not exists automatico boolean not null default false;

alter table public.recordatorios drop constraint if exists recordatorios_automatico_con_deuda;
alter table public.recordatorios
  add constraint recordatorios_automatico_con_deuda
  check (not automatico or deuda_id is not null);

alter table public.recordatorios drop constraint if exists recordatorios_deuda_id_fkey;
alter table public.recordatorios
  add constraint recordatorios_deuda_id_fkey
  foreign key (deuda_id) references public.deudas(id) on delete set null;

-- 1) Crear los recordatorios al nacer la deuda de un diferido ---------

create or replace function public.crear_recordatorios_de_diferido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meses int;
begin
  if new.gasto_id is null or new.tipo <> 'diferido' then
    return null;
  end if;
  select meses_diferido into v_meses from public.gastos
  where id = new.gasto_id and usuario_id = new.usuario_id;
  if v_meses is null or v_meses < 1 then
    return null;
  end if;

  insert into public.recordatorios (usuario_id, titulo, tipo, monto, fecha, recurrente, completado, deuda_id, automatico)
  select
    new.usuario_id,
    left(format('Cuota %s de %s · %s', k + 1, v_meses, new.nombre), 120),
    'tarjeta',
    -- Sin interés, la última cuota lleva el redondeo: 130 / 3 = 43,34 + 43,34 + 43,32.
    case when k = v_meses - 1 and coalesce(new.tasa_interes, 0) = 0
      then greatest(new.monto_total - new.cuota_mensual * (v_meses - 1), 0.01)
      else new.cuota_mensual
    end,
    least(m.inicio + (extract(day from new.fecha_inicio)::int - 1),
      (m.inicio + interval '1 month' - interval '1 day')::date),
    false,
    false,
    new.id,
    true
  -- Tope de 60 cuotas: la app permite hasta 24.
  from generate_series(0, least(v_meses, 60) - 1) as k
  cross join lateral (
    select (date_trunc('month', new.fecha_inicio) + make_interval(months => k))::date as inicio
  ) as m;
  return null;
end;
$$;

drop trigger if exists trg_crear_recordatorios_de_diferido on public.deudas;
create trigger trg_crear_recordatorios_de_diferido
  after insert on public.deudas
  for each row when (new.gasto_id is not null)
  execute function public.crear_recordatorios_de_diferido();

-- 2) Cerrar los de las cuotas pagadas ---------------------------------

create or replace function public.cerrar_recordatorios_de_diferido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Solo se cierran, nunca se reabren: si el usuario marcó uno como hecho,
  -- se respeta.
  update public.recordatorios set completado = true
  where deuda_id = new.id
    and automatico
    and not completado
    and (new.saldo_pendiente <= 0 or (new.proximo_pago is not null and fecha < new.proximo_pago));
  return null;
end;
$$;

drop trigger if exists trg_cerrar_recordatorios_de_diferido on public.deudas;
create trigger trg_cerrar_recordatorios_de_diferido
  after update of saldo_pendiente, proximo_pago on public.deudas
  for each row when (new.gasto_id is not null)
  execute function public.cerrar_recordatorios_de_diferido();

-- 3) Borrarlos con su deuda -------------------------------------------

create or replace function public.borrar_recordatorios_de_diferido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.recordatorios where deuda_id = old.id and automatico;
  return old;
end;
$$;

-- BEFORE: así ya no existen cuando la FK suelta los recordatorios manuales.
-- Corre después de trg_proteger_borrado_deuda (orden alfabético), que impide
-- borrar un diferido con abonos.
drop trigger if exists trg_quitar_recordatorios_de_diferido on public.deudas;
create trigger trg_quitar_recordatorios_de_diferido
  before delete on public.deudas
  for each row
  execute function public.borrar_recordatorios_de_diferido();

-- Un recordatorio no cambia de automático a manual ni al revés.
create or replace function public.proteger_recordatorio_automatico()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.automatico is distinct from old.automatico then
    raise exception 'Un recordatorio automático no se puede convertir en manual (ni al revés).'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_recordatorio_automatico on public.recordatorios;
create trigger trg_proteger_recordatorio_automatico
  before update of automatico on public.recordatorios
  for each row
  execute function public.proteger_recordatorio_automatico();

-- 4) Diferidos que ya existían ----------------------------------------
-- Función de mantenimiento: solo la puede correr el dueño de la base (no se
-- expone por la API). Crea los recordatorios que le falten a cada diferido y
-- devuelve cuántos creó. Volver a correrla no duplica nada.

create or replace function public.crear_recordatorios_faltantes_de_diferidos()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_creados integer;
begin
  insert into public.recordatorios (usuario_id, titulo, tipo, monto, fecha, recurrente, completado, deuda_id, automatico)
  select
    d.usuario_id,
    left(format('Cuota %s de %s · %s', k + 1, g.meses_diferido, d.nombre), 120),
    'tarjeta',
    case when k = g.meses_diferido - 1 and coalesce(d.tasa_interes, 0) = 0
      then greatest(d.monto_total - d.cuota_mensual * (g.meses_diferido - 1), 0.01)
      else d.cuota_mensual
    end,
    f.fecha,
    false,
    d.saldo_pendiente <= 0 or (d.proximo_pago is not null and f.fecha < d.proximo_pago),
    d.id,
    true
  from public.deudas d
  join public.gastos g on g.id = d.gasto_id and g.usuario_id = d.usuario_id
  cross join lateral generate_series(0, least(g.meses_diferido, 60) - 1) as k
  cross join lateral (
    select least(m.inicio + (extract(day from d.fecha_inicio)::int - 1),
      (m.inicio + interval '1 month' - interval '1 day')::date) as fecha
    from (select (date_trunc('month', d.fecha_inicio) + make_interval(months => k))::date as inicio) as m
  ) as f
  where d.tipo = 'diferido'
    and g.meses_diferido > 0
    and not exists (select 1 from public.recordatorios r where r.deuda_id = d.id and r.automatico);
  get diagnostics v_creados = row_count;
  return v_creados;
end;
$$;

revoke execute on function public.crear_recordatorios_faltantes_de_diferidos() from public, anon, authenticated;

select public.crear_recordatorios_faltantes_de_diferidos();

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261016170000', 'recordatorios_diferidos')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261016170000') then 'sí' else 'no' end as aplicada;
