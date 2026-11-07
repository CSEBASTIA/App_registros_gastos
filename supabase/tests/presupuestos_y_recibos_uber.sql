-- Pruebas de la migración 20261107120000_presupuestos_y_recibos_uber.
-- Base DESECHABLE. M, N y K son usuarios propios de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7d000000-0000-4000-8000-000000000001', 'm-mes@prueba.local'),
  ('7d000000-0000-4000-8000-000000000002', 'n-mes@prueba.local'),
  ('7d000000-0000-4000-8000-000000000003', 'k-uber@prueba.local')
on conflict (id) do nothing;

create or replace function pg_temp.cat(p text) returns uuid language sql as $$
  select id from categorias where nombre = p and usuario_id is null and tipo = 'gasto' $$;
create or replace function pg_temp.limite(p_usuario uuid, p_cat text, p_mes text) returns numeric language sql as $$
  select monto_limite from presupuestos where usuario_id = p_usuario and categoria_id = pg_temp.cat(p_cat) and mes = p_mes $$;

-- 1) PRESUPUESTOS QUE SIGUEN DE UN MES AL OTRO ----------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7d000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into presupuestos (categoria_id, monto_limite, mes) values
  (pg_temp.cat('Comida'), 100, '2026-10'),
  (pg_temp.cat('Transporte'), 50, '2026-10');

do $$ declare n int; begin
  n := continuar_presupuestos('2026-11');
  insert into resultados values ('M01 el mes nuevo copia los presupuestos del anterior',
    n = 2 and pg_temp.limite(auth.uid(), 'Comida', '2026-11') = 100 and pg_temp.limite(auth.uid(), 'Transporte', '2026-11') = 50,
    n || ' copiados');
end $$;

do $$ declare n int; total int; begin
  n := continuar_presupuestos('2026-11');
  select count(*) into total from presupuestos where mes = '2026-11';
  insert into resultados values ('M02 abrir el mes otra vez no copia de nuevo', n = 0 and total = 2, n || ' copiados, ' || total || ' en el mes');
end $$;

do $$ declare n int; begin
  delete from presupuestos where mes = '2026-11' and categoria_id = pg_temp.cat('Comida');
  n := continuar_presupuestos('2026-11');
  insert into resultados values ('M03 un presupuesto borrado en el mes nuevo no reaparece',
    n = 0 and pg_temp.limite(auth.uid(), 'Comida', '2026-11') is null, n || ' copiados');
end $$;

do $$ declare n int; begin
  -- Diciembre se arma con lo que quedó en noviembre (sin Comida, que se borró).
  n := continuar_presupuestos('2026-12');
  insert into resultados values ('M04 el mes siguiente parte del último mes, con sus cambios',
    n = 1 and pg_temp.limite(auth.uid(), 'Transporte', '2026-12') = 50 and pg_temp.limite(auth.uid(), 'Comida', '2026-12') is null,
    n || ' copiados');
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7d000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
-- N dejó de abrir la app en octubre: sus últimos presupuestos son de septiembre.
insert into presupuestos (categoria_id, monto_limite, mes) values
  (pg_temp.cat('Comida'), 200, '2026-09'),
  (pg_temp.cat('Ocio'), 40, '2026-09'),
  -- Y ya creó a mano el de Ocio de noviembre, con otro límite.
  (pg_temp.cat('Ocio'), 60, '2026-11');

do $$ declare n int; begin
  n := continuar_presupuestos('2026-11');
  insert into resultados values ('M05 copia del último mes con presupuestos y respeta los ya creados',
    n = 1 and pg_temp.limite(auth.uid(), 'Comida', '2026-11') = 200 and pg_temp.limite(auth.uid(), 'Ocio', '2026-11') = 60,
    n || ' copiados');
end $$;

do $$ declare n int; begin
  select count(*) into n from presupuestos where usuario_id = '7d000000-0000-4000-8000-000000000001';
  insert into resultados values ('M06 solo prepara los presupuestos propios', n = 0, n || ' de M visibles para N');
end $$;

do $$ begin
  perform continuar_presupuestos('noviembre');
  insert into resultados values ('M07 un mes mal escrito se rechaza', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('M07 un mes mal escrito se rechaza', true, sqlerrm);
end $$;
commit;

begin;
set local role anon;
do $$ begin
  perform continuar_presupuestos('2026-11');
  insert into resultados values ('M08 sin sesión no se puede llamar', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('M08 sin sesión no se puede llamar', true, sqlerrm);
end $$;
commit;

-- 2) CATEGORÍA SUGERIDA ---------------------------------------------------

do $$ declare k uuid := '7d000000-0000-4000-8000-000000000003'; begin
  insert into resultados values ('M09 «UBER *EATS» es Comida y «UBER *TRIP» o DiDi son Transporte',
    categoria_sugerida(k, 'UBER *EATS PENDING') = pg_temp.cat('Comida')
      and categoria_sugerida(k, 'UBER *TRIP HELP.UBER.COM') = pg_temp.cat('Transporte')
      and categoria_sugerida(k, 'DIDI RIDES EC') = pg_temp.cat('Transporte'),
    'ok');
end $$;

-- 3) RECIBO DE UBER + AVISO DEL BANCO: UN SOLO GASTO, Y EL OTRO A VERIFICAR -

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7d000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7d900000-0000-4000-8000-000000000001', 'Visa Pichincha', 'credito', 'pichincha', '4242', 500, 500);

create or replace function pg_temp.aviso(p_id text, p_monto numeric, p_fecha date, p_banco text, p_hora timestamptz, p_comercio text)
returns void language sql as $$
  insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, banco, cuenta_id, clase, comercio, tarjeta_final, pagado_en)
  values (p_id, 'gasto', p_monto, p_comercio, p_fecha, p_banco, '7d900000-0000-4000-8000-000000000001', 'consumo', p_comercio, '4242', p_hora) $$;
create or replace function pg_temp.marcado(p_id text) returns boolean language sql as $$
  select estado = 'pendiente' and posible_duplicado_de is not null from transacciones_detectadas where mensaje_id = p_id $$;
create or replace function pg_temp.gastos_de(p_monto numeric) returns int language sql as $$
  select count(*)::int from gastos where cuenta_id = '7d900000-0000-4000-8000-000000000001' and monto = p_monto $$;

-- U01: primero el recibo de Uber (sin banco ni hora), después el aviso del banco.
do $$ declare r jsonb; r2 jsonb; cat uuid; begin
  perform pg_temp.aviso('uber-1', 4.52, '2026-11-05', null, null, 'Uber');
  r := registrar_avisos_correo();
  select categoria_id into cat from gastos where cuenta_id = '7d900000-0000-4000-8000-000000000001' and monto = 4.52;
  perform pg_temp.aviso('banco-1', 4.52, '2026-11-05', 'pichincha', '2026-11-05 20:10:00-05', 'UBER *TRIP');
  r2 := registrar_avisos_correo();
  insert into resultados values ('U01 el recibo de Uber se registra solo (Transporte); el aviso del banco queda a verificar',
    r -> 0 ->> 'resultado' = 'registrado' and cat = pg_temp.cat('Transporte')
      and r2 -> 0 ->> 'resultado' = 'verificar' and pg_temp.marcado('banco-1') and pg_temp.gastos_de(4.52) = 1,
    format('%s · %s · %s gasto(s)', r -> 0 ->> 'resultado', r2 -> 0 ->> 'resultado', pg_temp.gastos_de(4.52)));
end $$;

-- U02: al revés, primero el banco (con hora) y al día siguiente el recibo.
do $$ declare r jsonb; begin
  perform pg_temp.aviso('banco-2', 7.10, '2026-11-06', 'pichincha', '2026-11-06 23:50:00-05', 'UBER *TRIP');
  perform registrar_avisos_correo();
  perform pg_temp.aviso('uber-2', 7.10, '2026-11-07', null, null, 'Uber');
  r := registrar_avisos_correo();
  insert into resultados values ('U02 si el banco avisó primero, el recibo de Uber queda a verificar',
    r -> 0 ->> 'resultado' = 'verificar' and pg_temp.marcado('uber-2') and pg_temp.gastos_de(7.10) = 1, format('%s gasto(s)', pg_temp.gastos_de(7.10)));
end $$;

-- U03: dos viajes iguales el mismo día, sin aviso del banco: son dos gastos.
do $$ begin
  perform pg_temp.aviso('uber-3', 3.00, '2026-11-07', null, null, 'Uber');
  perform pg_temp.aviso('uber-4', 3.00, '2026-11-07', null, null, 'Uber');
  perform registrar_avisos_correo();
  insert into resultados values ('U03 dos viajes de Uber iguales el mismo día no se juntan', pg_temp.gastos_de(3.00) = 2, pg_temp.gastos_de(3.00) || ' gasto(s)');
end $$;

-- U04: dos viajes iguales con su aviso del banco cada uno: dos gastos, no cuatro ni uno.
do $$ begin
  perform pg_temp.aviso('banco-5', 5.25, '2026-11-04', 'pichincha', '2026-11-04 08:00:00-05', 'UBER *TRIP');
  perform pg_temp.aviso('banco-6', 5.25, '2026-11-04', 'pichincha', '2026-11-04 18:30:00-05', 'UBER *TRIP');
  perform registrar_avisos_correo();
  perform pg_temp.aviso('uber-5', 5.25, '2026-11-04', null, null, 'Uber');
  perform pg_temp.aviso('uber-6', 5.25, '2026-11-04', null, null, 'Uber');
  perform registrar_avisos_correo();
  insert into resultados values ('U04 dos viajes iguales con aviso del banco quedan en dos gastos',
    pg_temp.gastos_de(5.25) = 2 and pg_temp.marcado('uber-5') and pg_temp.marcado('uber-6'),
    pg_temp.gastos_de(5.25) || ' gasto(s)');
end $$;

-- U05: Uber Eats va a Comida.
do $$ declare cat uuid; begin
  perform pg_temp.aviso('uber-7', 12.30, '2026-11-07', null, null, 'Uber Eats');
  perform registrar_avisos_correo();
  select categoria_id into cat from gastos where cuenta_id = '7d900000-0000-4000-8000-000000000001' and monto = 12.30;
  insert into resultados values ('U05 un pedido de Uber Eats se registra como Comida', cat = pg_temp.cat('Comida'), coalesce(cat::text, 'sin gasto'));
end $$;

-- U07: un recibo sin la tarjeta va a la que más usas en Uber; sin historial, a la Bandeja.
do $$ declare r jsonb; c uuid; begin
  insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, clase, comercio)
    values ('uber-8', 'gasto', 2.40, 'Uber', '2026-11-07', 'consumo', 'Uber'),
           ('otro-1', 'gasto', 9.90, 'Cabify', '2026-11-07', 'consumo', 'Cabify');
  r := registrar_avisos_correo();
  select cuenta_id into c from gastos where monto = 2.40;
  insert into resultados values ('U07 sin tarjeta en el recibo, se usa la más frecuente en ese comercio; sin historial, Bandeja',
    c = '7d900000-0000-4000-8000-000000000001'
      and (select estado from transacciones_detectadas where mensaje_id = 'otro-1') = 'pendiente',
    coalesce(c::text, 'sin gasto'));
end $$;

-- U08: recibo y aviso con hora (el caso real: banco 20:05, recibo 20:12) → a verificar, no se junta solo.
do $$ declare r jsonb; begin
  perform pg_temp.aviso('banco-9', 2.90, '2026-11-05', 'pichincha', '2026-11-05 20:05:36-05', 'UBER BV USDNUSD ECUADOR');
  perform registrar_avisos_correo();
  perform pg_temp.aviso('uber-9', 2.90, '2026-11-05', null, '2026-11-05 20:12:00-05', 'Uber');
  r := registrar_avisos_correo();
  insert into resultados values ('U08 recibo y aviso del banco con hora: un gasto y el otro a verificar',
    r -> 0 ->> 'resultado' = 'verificar' and pg_temp.marcado('uber-9') and pg_temp.gastos_de(2.90) = 1,
    format('%s · %s gasto(s)', r -> 0 ->> 'resultado', pg_temp.gastos_de(2.90)));
end $$;

-- U09: dos viajes iguales con hora: cada recibo apunta al cobro más cercano.
do $$ declare g1 uuid; g2 uuid; ok boolean; begin
  perform pg_temp.aviso('banco-10', 1.75, '2026-11-03', 'pichincha', '2026-11-03 09:00:00-05', 'UBER BV');
  perform pg_temp.aviso('banco-11', 1.75, '2026-11-03', 'pichincha', '2026-11-03 11:30:00-05', 'UBER BV');
  perform registrar_avisos_correo();
  select gasto_id into g1 from transacciones_detectadas where mensaje_id = 'banco-10';
  select gasto_id into g2 from transacciones_detectadas where mensaje_id = 'banco-11';
  perform pg_temp.aviso('uber-10', 1.75, '2026-11-03', null, '2026-11-03 11:35:00-05', 'Uber');
  perform registrar_avisos_correo();
  select posible_duplicado_de = g2 into ok from transacciones_detectadas where mensaje_id = 'uber-10';
  insert into resultados values ('U09 con hora, el recibo se compara con el cobro más cercano', ok and g1 <> g2, coalesce(ok::text, 'sin marca'));
end $$;

-- U06: la tarjeta se descontó una sola vez por cada cobro.
do $$ declare d numeric; begin
  select disponible into d from cuentas where id = '7d900000-0000-4000-8000-000000000001';
  insert into resultados values ('U06 el cupo de la tarjeta baja una vez por cobro',
    d = 500 - 4.52 - 7.10 - 3.00 * 2 - 5.25 * 2 - 12.30 - 2.40 - 2.90 - 1.75 * 2, 'disponible ' || d);
end $$;
commit;

do $$ declare sin_fijar int; begin
  select count(*) into sin_fijar from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('continuar_presupuestos', 'categoria_sugerida', 'registrar_avisos_correo')
    and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  insert into resultados values ('M10 las funciones con permisos elevados fijan el search_path', sin_fijar = 0, sin_fijar || ' sin fijar');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
