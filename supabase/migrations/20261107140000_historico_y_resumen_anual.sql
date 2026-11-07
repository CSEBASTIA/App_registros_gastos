-- Migración de movimientos históricos y resumen anual.
--
-- 1) Estados de cuenta de meses anteriores. El saldo de hoy de una cuenta (o
--    el cupo de una tarjeta) ya incluye lo que pasó en esos meses: si se
--    importaran como gastos normales, el saldo bajaría dos veces. Ahora un
--    gasto o ingreso puede ser `historico`: cuenta en los resúmenes, las
--    categorías y el año, pero no mueve el saldo de la cuenta. La marca se
--    pone al crearlo y no se cambia después (cambiarla descuadraría el saldo).
--    Un gasto histórico no puede ser diferido (no crea deuda ni cuotas).
-- 2) `resumen_anual(p_anio)`: totales del año por mes, por categoría y los
--    comercios donde más se gastó, sumados en la base. `security invoker`:
--    RLS deja ver solo lo propio.

-- 1) Movimientos históricos ----------------------------------------------

alter table public.gastos add column if not exists historico boolean not null default false;
alter table public.ingresos add column if not exists historico boolean not null default false;

alter table public.gastos drop constraint if exists gastos_historico_sin_diferido;
alter table public.gastos add constraint gastos_historico_sin_diferido
  check (not historico or metodo_pago is distinct from 'diferido');

create or replace function public.proteger_marca_historico()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.historico is distinct from old.historico then
    raise exception 'Un movimiento del historial no puede pasar a ser de hoy (ni al revés): elimínalo y regístralo de nuevo.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_marca_historico() from public, anon, authenticated;

drop trigger if exists trg_00_proteger_historico on public.gastos;
create trigger trg_00_proteger_historico before update of historico on public.gastos
  for each row execute function public.proteger_marca_historico();
drop trigger if exists trg_00_proteger_historico on public.ingresos;
create trigger trg_00_proteger_historico before update of historico on public.ingresos
  for each row execute function public.proteger_marca_historico();

-- Los disparadores que mueven el saldo, solo para lo que no es historial.
drop trigger if exists trg_aplicar_gasto_a_cuenta on public.gastos;
create trigger trg_aplicar_gasto_a_cuenta after insert on public.gastos
  for each row when (not new.historico) execute function public.aplicar_gasto_a_cuenta();
drop trigger if exists trg_revertir_gasto_de_cuenta on public.gastos;
create trigger trg_revertir_gasto_de_cuenta after delete on public.gastos
  for each row when (not old.historico) execute function public.revertir_gasto_de_cuenta();
drop trigger if exists trg_ajustar_gasto_actualizado on public.gastos;
create trigger trg_ajustar_gasto_actualizado after update of monto, cuenta_id on public.gastos
  for each row when (not old.historico) execute function public.ajustar_gasto_actualizado();
drop trigger if exists trg_crear_deuda_de_gasto_diferido on public.gastos;
create trigger trg_crear_deuda_de_gasto_diferido after insert on public.gastos
  for each row when (not new.historico) execute function public.crear_deuda_de_gasto_diferido();

drop trigger if exists trg_aplicar_ingreso_a_cuenta on public.ingresos;
create trigger trg_aplicar_ingreso_a_cuenta after insert on public.ingresos
  for each row when (not new.historico) execute function public.aplicar_ingreso_a_cuenta();
drop trigger if exists trg_revertir_ingreso_de_cuenta on public.ingresos;
create trigger trg_revertir_ingreso_de_cuenta after delete on public.ingresos
  for each row when (not old.historico) execute function public.revertir_ingreso_de_cuenta();
drop trigger if exists trg_ajustar_ingreso_actualizado on public.ingresos;
create trigger trg_ajustar_ingreso_actualizado after update of monto, cuenta_id on public.ingresos
  for each row when (not old.historico) execute function public.ajustar_ingreso_actualizado();

-- 2) Resumen anual --------------------------------------------------------

create or replace function public.resumen_anual(p_anio integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_desde date;
  v_hasta date;
begin
  if p_anio is null or p_anio < 2000 or p_anio > 2100 then
    raise exception 'Año inválido.' using errcode = '22023';
  end if;
  v_desde := make_date(p_anio, 1, 1);
  v_hasta := make_date(p_anio, 12, 31);

  return jsonb_build_object(
    'anio', p_anio,
    'meses', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', t.mes, 'gastos', t.total_gastos, 'ingresos', t.total_ingresos) order by t.mes), '[]'::jsonb)
      from totales_por_mes(v_desde, v_hasta) t
    ),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object('categoria_id', x.categoria_id, 'nombre', x.nombre, 'color', x.color, 'total', x.total, 'cantidad', x.cantidad)
                                order by x.total desc), '[]'::jsonb)
      from (
        select g.categoria_id, coalesce(c.nombre, 'Sin categoría') as nombre, c.color, sum(g.monto) as total, count(*) as cantidad
        from gastos g left join categorias c on c.id = g.categoria_id
        where g.fecha between v_desde and v_hasta
        group by g.categoria_id, c.nombre, c.color
      ) x
    ),
    'comercios', (
      select coalesce(jsonb_agg(jsonb_build_object('descripcion', x.descripcion, 'total', x.total, 'cantidad', x.cantidad)
                                order by x.total desc), '[]'::jsonb)
      from (
        select min(btrim(g.descripcion)) as descripcion, sum(g.monto) as total, count(*) as cantidad
        from gastos g
        where g.fecha between v_desde and v_hasta
        group by lower(btrim(g.descripcion))
        order by sum(g.monto) desc
        limit 8
      ) x
    )
  );
end;
$$;

revoke all on function public.resumen_anual(integer) from public, anon;
grant execute on function public.resumen_anual(integer) to authenticated;
