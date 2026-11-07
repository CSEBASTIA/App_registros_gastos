-- Pruebas de la migración 20261107140000_historico_y_resumen_anual.
-- Base DESECHABLE. H y J son usuarios propios de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7b000000-0000-4000-8000-000000000001', 'h-historico@prueba.local'),
  ('7b000000-0000-4000-8000-000000000002', 'j-historico@prueba.local')
on conflict (id) do nothing;

create or replace function pg_temp.cat(p text) returns uuid language sql as $$
  select id from categorias where nombre = p and usuario_id is null and tipo = 'gasto' $$;
create or replace function pg_temp.saldo(p uuid) returns numeric language sql as $$ select disponible from cuentas where id = p $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7b000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, disponible) values ('7b900000-0000-4000-8000-000000000001', 'Ahorro H', 'ahorro', 'pichincha', 100);
insert into cuentas (id, nombre, tipo, banco, disponible, cupo_total) values ('7b900000-0000-4000-8000-000000000002', 'Visa H', 'credito', 'pichincha', 500, 500);

-- H01: un gasto del historial (estado de cuenta de marzo) no mueve el saldo de hoy.
do $$ begin
  insert into gastos (id, monto, descripcion, categoria_id, cuenta_id, fecha, historico)
    values ('7b800000-0000-4000-8000-000000000001', 80, 'Supermaxi', pg_temp.cat('Comida'), '7b900000-0000-4000-8000-000000000002', '2026-03-10', true);
  insert into ingresos (monto, descripcion, cuenta_id, fecha, historico)
    values (40, 'Sueldo de marzo', '7b900000-0000-4000-8000-000000000001', '2026-03-01', true);
  insert into resultados values ('H01 lo importado de un mes pasado no cambia saldo ni cupo',
    pg_temp.saldo('7b900000-0000-4000-8000-000000000001') = 100 and pg_temp.saldo('7b900000-0000-4000-8000-000000000002') = 500,
    format('ahorro %s, cupo %s', pg_temp.saldo('7b900000-0000-4000-8000-000000000001'), pg_temp.saldo('7b900000-0000-4000-8000-000000000002')));
end $$;

-- H02: editarlo o borrarlo tampoco.
do $$ begin
  update gastos set monto = 90 where id = '7b800000-0000-4000-8000-000000000001';
  delete from gastos where id = '7b800000-0000-4000-8000-000000000001';
  insert into resultados values ('H02 editar o borrar un gasto del historial no toca el cupo',
    pg_temp.saldo('7b900000-0000-4000-8000-000000000002') = 500, 'cupo ' || pg_temp.saldo('7b900000-0000-4000-8000-000000000002'));
end $$;

-- H03: un gasto normal sí lo mueve (nada cambió para lo de hoy).
do $$ begin
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha) values (30, 'Almuerzo', pg_temp.cat('Comida'), '7b900000-0000-4000-8000-000000000001', '2026-11-07');
  insert into resultados values ('H03 un gasto de hoy sigue bajando el saldo', pg_temp.saldo('7b900000-0000-4000-8000-000000000001') = 70,
    'ahorro ' || pg_temp.saldo('7b900000-0000-4000-8000-000000000001'));
end $$;

-- H04: la marca no se cambia después.
do $$ begin
  update gastos set historico = true where descripcion = 'Almuerzo';
  insert into resultados values ('H04 un gasto de hoy no puede pasar al historial', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('H04 un gasto de hoy no puede pasar al historial', true, sqlerrm);
end $$;

-- H05: un gasto del historial no puede ser diferido (no crea deuda).
do $$ begin
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, metodo_pago, meses_diferido, fecha, historico)
    values (300, 'Televisor', pg_temp.cat('Ocio'), '7b900000-0000-4000-8000-000000000002', 'diferido', 6, '2026-02-01', true);
  insert into resultados values ('H05 un gasto del historial no puede ser diferido', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('H05 un gasto del historial no puede ser diferido', true, sqlerrm);
end $$;

-- H06: el resumen anual suma por mes y por categoría, historial incluido.
do $$ declare r jsonb; marzo jsonb; comida numeric; begin
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha, historico)
    values (25.5, 'Uber', pg_temp.cat('Transporte'), '7b900000-0000-4000-8000-000000000002', '2026-03-12', true),
           (14.5, 'UBER ', pg_temp.cat('Transporte'), '7b900000-0000-4000-8000-000000000002', '2026-03-20', true);
  r := resumen_anual(2026);
  select m into marzo from jsonb_array_elements(r -> 'meses') m where m ->> 'mes' = '2026-03';
  select (c ->> 'total')::numeric into comida from jsonb_array_elements(r -> 'categorias') c where c ->> 'nombre' = 'Comida';
  insert into resultados values ('H06 el resumen anual trae los 12 meses, el historial y los totales por categoría',
    jsonb_array_length(r -> 'meses') = 12 and (marzo ->> 'gastos')::numeric = 40 and (marzo ->> 'ingresos')::numeric = 40
      and comida = 30
      and (r -> 'comercios' -> 0 ->> 'total')::numeric = 40 and (r -> 'comercios' -> 0 ->> 'cantidad')::int = 2,
    format('marzo %s, comida %s, primer comercio %s', marzo, comida, r -> 'comercios' -> 0));
end $$;

do $$ begin
  perform resumen_anual(1500);
  insert into resultados values ('H07 un año fuera de rango se rechaza', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('H07 un año fuera de rango se rechaza', true, sqlerrm);
end $$;
commit;

-- H08: cada quien ve solo su año.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare r jsonb; begin
  r := resumen_anual(2026);
  insert into resultados values ('H08 el resumen anual solo suma lo propio',
    jsonb_array_length(r -> 'categorias') = 0 and jsonb_array_length(r -> 'comercios') = 0, r ->> 'categorias');
end $$;
commit;

begin;
set local role anon;
do $$ begin
  perform resumen_anual(2026);
  insert into resultados values ('H09 sin sesión no hay resumen anual', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('H09 sin sesión no hay resumen anual', true, sqlerrm);
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
