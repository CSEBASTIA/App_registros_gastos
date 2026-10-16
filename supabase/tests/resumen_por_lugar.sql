-- Pruebas de la migración 20261016150000_resumen_por_lugar.
-- Base DESECHABLE. H tiene 3 lugares y 10 pagos de montos conocidos; I es
-- otra persona; J tiene 10 000 gastos para medir el rendimiento.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-000000000008', 'h-resumen@prueba.local'),
  ('7f000000-0000-4000-8000-000000000009', 'i-resumen@prueba.local'),
  ('7f000000-0000-4000-8000-00000000000a', 'j-resumen@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000008","role":"authenticated"}', true);

-- El primer gasto de cada punto crea el lugar con su descripción.
insert into gastos (monto, descripcion, categoria_id, fecha, latitud, longitud, billetera)
select v.monto, v.descripcion, (select id from categorias where nombre = v.categoria and usuario_id is null), v.fecha::date, v.lat, v.lon, v.billetera
from (values
  (1, 10, 'Supermaxi El Bosque', 'Comida', '2026-10-02', -0.1700, -78.4800, 'apple_pay'),
  (2, 20, 'Compra', 'Comida', '2026-10-05', -0.1700, -78.4800, 'apple_pay'),
  (3, 30, 'Compra', 'Ocio', '2026-10-20', -0.1701, -78.4800, null),
  (4, 15, 'Supermaxi Cumbayá', 'Transporte', '2026-10-03', -0.2000, -78.4300, null),
  (5, 25, 'Compra', 'Transporte', '2026-10-25', -0.2000, -78.4300, 'google_wallet'),
  (6, 40, 'Farmacia', 'Servicios', '2026-09-15', -0.2500, -78.5000, null),
  (7, 5, 'Remedio', 'Servicios', '2026-10-01', -0.2500, -78.5000, null),
  (8, 5, 'Remedio', 'Servicios', '2026-10-11', -0.2500, -78.5000, null),
  (9, 5, 'Remedio', 'Servicios', '2026-10-12', -0.2500, -78.5000, null),
  (10, 50, 'Noviembre', 'Comida', '2026-11-02', -0.1700, -78.4800, null)
) as v(orden, monto, descripcion, categoria, fecha, lat, lon, billetera)
order by v.orden;
insert into gastos (monto, descripcion, categoria_id, fecha)
  values (100, 'Sin ubicación', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-10');

-- X01: el resumen de octubre da los totales exactos, en orden
do $$ declare filas text; esperado text; begin
  select string_agg(format('%s|%s|%s|%s|%s|%s|%s|%s|%s', r.nombre, r.pagos, r.total, r.promedio, r.porcentaje,
                           r.primer_pago, r.ultimo_pago, c.nombre, coalesce(r.billetera, '-')), ' / ' order by r.total desc)
    into filas
  from resumen_por_lugar('2026-10-01', '2026-10-31') r left join categorias c on c.id = r.categoria_id;
  esperado := 'Supermaxi El Bosque|3|60.00|20.00|52.2|2026-10-02|2026-10-20|Comida|apple_pay'
    || ' / Supermaxi Cumbayá|2|40.00|20.00|34.8|2026-10-03|2026-10-25|Transporte|google_wallet'
    || ' / Farmacia|3|15.00|5.00|13.0|2026-10-01|2026-10-12|Servicios|-';
  insert into resultados values ('X01 el resumen de octubre da los totales exactos al centavo y en orden', filas = esperado, filas);
end $$;

-- X02: otro rango, otros números (y los gastos sin ubicación no cuentan)
do $$ declare filas text; begin
  select string_agg(r.nombre || '|' || r.pagos || '|' || r.total || '|' || r.porcentaje, ' / ') into filas
  from resumen_por_lugar('2026-09-01', '2026-09-30') r;
  insert into resultados values ('X02 septiembre solo trae la farmacia (40, 100 %)', filas = 'Farmacia|1|40.00|100.0', filas);
end $$;

-- X03: por comercio, y al poner el mismo nombre se juntan las sucursales
do $$ declare antes text; despues text; begin
  select string_agg(r.comercio || '|' || r.locales || '|' || r.pagos || '|' || r.total, ' / ') into antes
  from resumen_por_comercio('2026-10-01', '2026-10-31') r;
  update lugares set nombre = '  supermaxi   EL BOSQUE ' where nombre = 'Supermaxi Cumbayá';
  select string_agg(r.comercio || '|' || r.locales || '|' || r.pagos || '|' || r.total || '|' || cardinality(r.lugar_ids), ' / ') into despues
  from resumen_por_comercio('2026-10-01', '2026-10-31') r;
  insert into resultados values ('X03 por comercio: el mismo nombre (sin mirar mayúsculas ni espacios) junta las sucursales',
    antes = 'Supermaxi El Bosque|1|3|60.00 / Supermaxi Cumbayá|1|2|40.00 / Farmacia|1|3|15.00'
      and despues = 'Supermaxi El Bosque|2|5|100.00|2 / Farmacia|1|3|15.00|1',
    antes || '  →  ' || despues);
  update lugares set nombre = 'Supermaxi Cumbayá' where nombre = '  supermaxi   EL BOSQUE ';
end $$;

-- X04: rangos imposibles se rechazan
do $$ declare errores int := 0; begin
  begin perform resumen_por_lugar('2026-10-31', '2026-10-01'); exception when invalid_parameter_value then errores := errores + 1; end;
  begin perform resumen_por_lugar('2020-01-01', '2026-10-31'); exception when invalid_parameter_value then errores := errores + 1; end;
  begin perform resumen_por_lugar(null, '2026-10-31'); exception when invalid_parameter_value then errores := errores + 1; end;
  begin perform resumen_por_comercio('2026-10-31', '2026-10-01'); exception when invalid_parameter_value then errores := errores + 1; end;
  insert into resultados values ('X04 rango al revés, de más de 2 años o vacío se rechaza', errores = 4, errores || ' de 4');
end $$;

-- X05: fusionar Cumbayá en El Bosque mueve sus 2 pagos y suma los totales
do $$ declare l1 uuid; l2 uuid; movidos int; r record; quedan int; total_mes numeric; begin
  select id into l1 from lugares where nombre = 'Supermaxi El Bosque';
  select id into l2 from lugares where nombre = 'Supermaxi Cumbayá';
  movidos := fusionar_lugares(l2, l1);
  select * into r from resumen_por_lugar('2026-10-01', '2026-10-31') where lugar_id = l1;
  select count(*) into quedan from lugares where id = l2;
  select sum(total) into total_mes from resumen_por_lugar('2026-10-01', '2026-10-31');
  insert into resultados values ('X05 fusionar mueve los pagos, borra el lugar y el total es la suma de ambos',
    movidos = 2 and quedan = 0 and r.pagos = 5 and r.total = 100 and total_mes = 115,
    format('movidos %s, pagos %s, total %s, total del mes %s', movidos, r.pagos, r.total, total_mes));
end $$;

-- X06: fusionar un lugar consigo mismo no
do $$ declare l1 uuid; begin
  select id into l1 from lugares where nombre = 'Supermaxi El Bosque';
  perform fusionar_lugares(l1, l1);
  insert into resultados values ('X06 no se fusiona un lugar consigo mismo', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('X06 no se fusiona un lugar consigo mismo', true, sqlerrm);
end $$;

-- X07: renombrar es un UPDATE normal; un nombre vacío se rechaza
do $$ declare n int; begin
  update lugares set nombre = 'Supermaxi' where nombre = 'Supermaxi El Bosque';
  get diagnostics n = row_count;
  begin
    update lugares set nombre = '   ' where nombre = 'Supermaxi';
    insert into resultados values ('X07 renombrar funciona y un nombre vacío se rechaza', false, 'aceptó un nombre vacío');
  exception when check_violation then
    insert into resultados values ('X07 renombrar funciona y un nombre vacío se rechaza', n = 1, n || ' renombrado');
  end;
end $$;

-- X08: borrar un lugar conserva sus pagos y lo saca del resumen
do $$ declare filas text; sin_lugar int; begin
  delete from lugares where nombre = 'Farmacia';
  select string_agg(r.nombre || '|' || r.total, ' / ') into filas from resumen_por_lugar('2026-09-01', '2026-10-31') r;
  select count(*) into sin_lugar from gastos where descripcion in ('Farmacia', 'Remedio') and lugar_id is null;
  insert into resultados values ('X08 borrar un lugar conserva sus pagos y lo saca del resumen',
    filas = 'Supermaxi|100.00' and sin_lugar = 4, format('%s; pagos sin lugar %s', filas, sin_lugar));
end $$;
commit;

-- X09: otra persona no ve nada ni puede fusionar lugares ajenos
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$ declare n int; m int; ajeno uuid; begin
  select count(*) into n from resumen_por_lugar('2026-01-01', '2026-12-31');
  select count(*) into m from resumen_por_comercio('2026-01-01', '2026-12-31');
  reset role;
  select id into ajeno from lugares where usuario_id = '7f000000-0000-4000-8000-000000000008' limit 1;
  insert into lugares (id, usuario_id, nombre, latitud, longitud)
    values ('7f400000-0000-4000-8000-000000000001', '7f000000-0000-4000-8000-000000000009', 'Mío', 0, 0);
  set local role authenticated;
  insert into resultados values ('X09 otra persona ve el resumen vacío', n = 0 and m = 0, format('lugares %s, comercios %s', n, m));
  begin
    perform fusionar_lugares('7f400000-0000-4000-8000-000000000001', ajeno);
    insert into resultados values ('X10 no se puede fusionar con un lugar ajeno', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('X10 no se puede fusionar con un lugar ajeno', true, sqlerrm);
  end;
end $$;
commit;

-- X11-X12: sin sesión, no
begin;
set local role anon;
do $$ begin
  perform resumen_por_lugar('2026-10-01', '2026-10-31');
  insert into resultados values ('X11 sin sesión no hay resumen', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('X11 sin sesión no hay resumen', true, sqlerrm);
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$ begin
  perform resumen_por_lugar('2026-10-01', '2026-10-31');
  insert into resultados values ('X12 sin usuario identificado no hay resumen', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('X12 sin usuario identificado no hay resumen', true, sqlerrm);
end $$;
commit;

-- X13: rendimiento con 10 000 gastos en 50 lugares
insert into gastos (usuario_id, monto, descripcion, categoria_id, fecha, latitud, longitud)
select '7f000000-0000-4000-8000-00000000000a', 1 + (i % 7), 'Local ' || (i % 50),
  (select id from categorias where nombre = 'Comida' and usuario_id is null),
  date '2026-01-01' + (i % 365), -1.0 - (i % 50) * 0.01, -78.0
from generate_series(1, 10000) i;
analyze gastos;
analyze lugares;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ declare t0 timestamptz; ms_lugar numeric; ms_comercio numeric; n int; pagos int; total numeric; begin
  t0 := clock_timestamp();
  select count(*), sum(r.pagos), sum(r.total) into n, pagos, total from resumen_por_lugar('2026-01-01', '2026-12-31') r;
  ms_lugar := extract(epoch from clock_timestamp() - t0) * 1000;
  t0 := clock_timestamp();
  perform count(*) from resumen_por_comercio('2026-01-01', '2026-12-31');
  ms_comercio := extract(epoch from clock_timestamp() - t0) * 1000;
  insert into resultados values ('X13 con 10 000 gastos en 50 lugares, el resumen tarda menos de medio segundo',
    n = 50 and pagos = 10000 and ms_lugar < 500 and ms_comercio < 500,
    format('%s lugares, %s pagos, $%s; por lugar %s ms, por comercio %s ms', n, pagos, total, round(ms_lugar), round(ms_comercio)));
end $$;
commit;

-- Plan de la consulta (informativo): qué índice usa la base.
do $$ declare plan text; begin
  for plan in execute
    'explain select g.lugar_id, sum(g.monto) from gastos g
     where g.usuario_id = ''7f000000-0000-4000-8000-00000000000a'' and g.fecha between ''2026-10-01'' and ''2026-10-31''
       and g.lugar_id is not null
     group by g.lugar_id'
  loop
    if plan ~ 'Scan' then raise notice 'plan: %', btrim(plan); end if;
  end loop;
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
