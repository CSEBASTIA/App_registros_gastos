-- Pruebas de la migración 20261016130000_borrar_ubicaciones.
-- Base DESECHABLE, usuarios D y E simulados con su JWT (propios de este archivo).

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-000000000004', 'd-ubicacion@prueba.local'),
  ('7f000000-0000-4000-8000-000000000005', 'e-ubicacion@prueba.local')
on conflict (id) do nothing;

-- E tiene un gasto con ubicación: no se debe tocar.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
insert into gastos (id, monto, descripcion, categoria_id, fecha, latitud, longitud)
  values ('7f100000-0000-4000-8000-0000000000e1', 4, 'Pan de E', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', -0.2200, -78.5200);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible) values
  ('7f200000-0000-4000-8000-000000000001', 'Ahorro V', 'ahorro', 300);
insert into cuentas (id, nombre, tipo, disponible, cupo_total) values
  ('7f200000-0000-4000-8000-000000000002', 'Visa V', 'credito', 1000, 1000);

insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, latitud, longitud, precision_m) values
  ('7f100000-0000-4000-8000-000000000001', 20, 'Mercado', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', '7f200000-0000-4000-8000-000000000001', -0.1500, -78.4800, 10),
  ('7f100000-0000-4000-8000-000000000002', 15, 'Mercado otra vez', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', '7f200000-0000-4000-8000-000000000001', -0.1500, -78.4800, 10);
insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido, billetera, latitud, longitud) values
  ('7f100000-0000-4000-8000-000000000003', 300, 'Televisor', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', '7f200000-0000-4000-8000-000000000002', 'diferido', 3, 'apple_pay', -0.1000, -78.4000);
insert into gastos (id, monto, descripcion, categoria_id, fecha) values
  ('7f100000-0000-4000-8000-000000000004', 5, 'Sin ubicación', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16');
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, origen, comercio, latitud, longitud, precision_m) values
  ('7f300000-0000-4000-8000-000000000001', 'applepay:v1', 'gasto', 9, 'Kiosko', '2026-10-16', 'apple_pay', 'KIOSKO', -0.1600, -78.4900, 15);

create temp table antes as
  select (select disponible from cuentas where id = '7f200000-0000-4000-8000-000000000001') as ahorro,
         (select disponible from cuentas where id = '7f200000-0000-4000-8000-000000000002') as visa,
         (select count(*) from lugares) as lugares,
         (select sum(monto) from gastos) as total;

-- V1: borra todo de una vez y dice cuánto
do $$ declare r jsonb; begin
  r := borrar_mis_ubicaciones();
  insert into resultados values ('V01 devuelve cuántos gastos, avisos y lugares limpió',
    r = '{"gastos": 3, "avisos": 1, "lugares": 2}'::jsonb, r::text);
end $$;

-- V2: los gastos siguen, sin ubicación ni lugar, con el mismo total
do $$ declare n int; con_ubicacion int; con_lugar int; total numeric; a record; begin
  select * into a from antes;
  select count(*), count(latitud), count(lugar_id), sum(monto) into n, con_ubicacion, con_lugar, total from gastos;
  insert into resultados values ('V02 los gastos siguen, sin ubicación ni lugar',
    n = 4 and con_ubicacion = 0 and con_lugar = 0 and total = a.total and a.lugares = 2,
    format('gastos %s, con ubicación %s, con lugar %s, total %s', n, con_ubicacion, con_lugar, total));
end $$;

-- V3: los saldos no cambian (el diferido tampoco se bloquea)
do $$ declare a record; ahorro numeric; visa numeric; billetera text; begin
  select * into a from antes;
  select disponible into ahorro from cuentas where id = '7f200000-0000-4000-8000-000000000001';
  select disponible into visa from cuentas where id = '7f200000-0000-4000-8000-000000000002';
  select g.billetera into billetera from gastos g where id = '7f100000-0000-4000-8000-000000000003';
  insert into resultados values ('V03 los saldos y la billetera no cambian',
    ahorro = a.ahorro and visa = a.visa and ahorro = 265 and billetera = 'apple_pay',
    format('ahorro %s, visa %s, billetera %s', ahorro, visa, billetera));
end $$;

-- V4: el aviso pendiente pierde la ubicación pero sigue pendiente
do $$ declare t transacciones_detectadas; begin
  select * into t from transacciones_detectadas where id = '7f300000-0000-4000-8000-000000000001';
  insert into resultados values ('V04 el aviso pendiente queda sin ubicación y sigue pendiente',
    t.latitud is null and t.precision_m is null and t.estado = 'pendiente' and t.comercio = 'KIOSKO',
    format('estado %s, latitud %s', t.estado, coalesce(t.latitud::text, 'null')));
end $$;

-- V5: repetirlo no hace nada
do $$ declare r jsonb; begin
  r := borrar_mis_ubicaciones();
  insert into resultados values ('V05 repetirlo no cambia nada', r = '{"gastos": 0, "avisos": 0, "lugares": 0}'::jsonb, r::text);
end $$;

-- V6: después se pueden volver a guardar ubicaciones
do $$ declare l uuid; begin
  insert into gastos (monto, descripcion, categoria_id, fecha, latitud, longitud)
    values (2, 'Café nuevo', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', -0.1500, -78.4800)
    returning lugar_id into l;
  insert into resultados values ('V06 después de borrar se puede volver a guardar la ubicación', l is not null, coalesce(l::text, 'null'));
end $$;
commit;

-- V7: lo de E quedó intacto
do $$ declare g gastos; n int; begin
  select * into g from gastos where id = '7f100000-0000-4000-8000-0000000000e1';
  select count(*) into n from lugares where usuario_id = '7f000000-0000-4000-8000-000000000005';
  insert into resultados values ('V07 no toca las ubicaciones ni los lugares de otra persona',
    g.latitud = -0.2200 and g.lugar_id is not null and n = 1, format('latitud %s, lugares de E %s', g.latitud, n));
end $$;

-- V8: sin sesión no se puede llamar
begin;
set local role anon;
do $$ begin
  perform borrar_mis_ubicaciones();
  insert into resultados values ('V08 sin sesión no se puede borrar', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('V08 sin sesión no se puede borrar', true, sqlerrm);
end $$;
commit;

-- V9: con el rol de usuario pero sin identidad, tampoco
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$ begin
  perform borrar_mis_ubicaciones();
  insert into resultados values ('V09 sin usuario identificado no se puede borrar', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('V09 sin usuario identificado no se puede borrar', true, sqlerrm);
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
