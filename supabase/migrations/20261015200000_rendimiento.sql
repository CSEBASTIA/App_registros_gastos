-- Migración de rendimiento.

-- 1) Índices para las claves foráneas que no tenían (los pide el asesor de
--    rendimiento de Supabase). Sin ellos, borrar una categoría, una cuenta o
--    una deuda recorría tablas enteras buscando lo que dependía de ella.
create index if not exists categorias_usuario_id_idx on public.categorias (usuario_id);
create index if not exists gastos_categoria_id_idx on public.gastos (categoria_id);
create index if not exists presupuestos_categoria_id_idx on public.presupuestos (categoria_id);
create index if not exists ingresos_categoria_id_idx on public.ingresos (categoria_id);
create index if not exists pagos_tarjeta_cuenta_id_idx on public.pagos_tarjeta (cuenta_id);
create index if not exists pagos_tarjeta_cuenta_origen_id_idx on public.pagos_tarjeta (cuenta_origen_id);
create index if not exists deudas_cuenta_id_idx on public.deudas (cuenta_id);
create index if not exists recordatorios_deuda_id_idx on public.recordatorios (deuda_id);
create index if not exists transacciones_detectadas_categoria_id_idx on public.transacciones_detectadas (categoria_id);
create index if not exists transacciones_detectadas_cuenta_id_idx on public.transacciones_detectadas (cuenta_id);
create index if not exists abonos_deuda_cuenta_id_idx on public.abonos_deuda (cuenta_id);
create index if not exists abonos_deuda_deuda_id_idx on public.abonos_deuda (deuda_id);

-- 2) Las reglas de RLS llamaban a auth.uid() una vez POR FILA. Envuelto en
--    (select auth.uid()), Postgres lo calcula una sola vez por consulta
--    (recomendación del asesor de Supabase). El significado no cambia: solo
--    se reemplaza la llamada dentro de cada regla existente. Las que ya
--    estaban envueltas se dejan igual, así que se puede volver a correr.
do $$
declare
  p record;
  v_using text;
  v_check text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      and coalesce(qual, '') !~* 'select auth\.uid'
      and coalesce(with_check, '') !~* 'select auth\.uid'
  loop
    v_using := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    v_check := replace(p.with_check, 'auth.uid()', '(select auth.uid())');
    execute format('alter policy %I on public.%I%s%s', p.policyname, p.tablename,
      case when v_using is not null then format(' using (%s)', v_using) else '' end,
      case when v_check is not null then format(' with check (%s)', v_check) else '' end);
  end loop;
end;
$$;

-- 3) Totales de gastos e ingresos por mes, calculados en la base. Para los
--    gráficos y el resumen ya no hace falta descargar todos los movimientos.
--    SECURITY INVOKER: RLS aplica, cada quien suma solo lo suyo.
create or replace function public.totales_por_mes(p_desde date, p_hasta date)
returns table (mes text, total_gastos numeric, total_ingresos numeric)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas inválido.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 3660 then
    raise exception 'El rango no puede pasar de 10 años.' using errcode = '22023';
  end if;

  return query
  with meses as (
    select to_char(m, 'YYYY-MM') as mes
    from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') as m
  ),
  g as (
    select to_char(fecha, 'YYYY-MM') as mes, sum(monto) as total
    from gastos where fecha between p_desde and p_hasta group by 1
  ),
  i as (
    select to_char(fecha, 'YYYY-MM') as mes, sum(monto) as total
    from ingresos where fecha between p_desde and p_hasta group by 1
  )
  select meses.mes, coalesce(g.total, 0)::numeric, coalesce(i.total, 0)::numeric
  from meses
  left join g on g.mes = meses.mes
  left join i on i.mes = meses.mes
  order by meses.mes;
end;
$$;

revoke all on function public.totales_por_mes(date, date) from public, anon;
grant execute on function public.totales_por_mes(date, date) to authenticated;
