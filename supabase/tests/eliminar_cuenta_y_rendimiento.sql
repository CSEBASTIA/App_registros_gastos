-- Pruebas de la Migración de eliminar cuenta (20261015190000) y de la
-- Migración de rendimiento (20261015200000). Base DESECHABLE.

\set ON_ERROR_STOP 1
create temp table resultados_ec (prueba text, ok boolean, detalle text);
grant all on resultados_ec to authenticated, anon;

insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-000000000005', 'e@prueba.local'),
  ('f0000000-0000-4000-8000-000000000006', 'f@prueba.local')
on conflict (id) do nothing;

-- Datos de E en las 10 tablas (incluye un diferido con abono y un
-- recordatorio ligado a esa deuda, los casos que más fácil traban un borrado).
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, disponible) values ('d1000000-0000-4000-8000-000000000001', 'Ahorro E', 'ahorro', 1000);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values ('d1000000-0000-4000-8000-000000000002', 'Visa E', 'credito', 1000, 1000);
-- (en categorias, usuario_id vacío = global: la app siempre lo envía)
insert into categorias (id, nombre, color, tipo, usuario_id) values ('d2000000-0000-4000-8000-000000000001', 'Mascotas E', '#123456', 'gasto', 'e0000000-0000-4000-8000-000000000005');
insert into gastos (monto, descripcion, categoria_id, cuenta_id) values (100, 'Veterinario', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001');
insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido) values ('d3000000-0000-4000-8000-000000000001', 300, 'TV', 'd1000000-0000-4000-8000-000000000002', 'diferido', 3);
select registrar_abono_deuda((select id from deudas where gasto_id = 'd3000000-0000-4000-8000-000000000001'), 100, 'd1000000-0000-4000-8000-000000000001') is not null;
insert into recordatorios (titulo, tipo, fecha, deuda_id) values ('Cuota TV', 'pago', '2026-11-15', (select id from deudas where gasto_id = 'd3000000-0000-4000-8000-000000000001'));
insert into ingresos (monto, descripcion, cuenta_id) values (500, 'Sueldo', 'd1000000-0000-4000-8000-000000000001');
insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto) values ('d1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 50);
insert into presupuestos (categoria_id, monto_limite, mes) values ('d2000000-0000-4000-8000-000000000001', 200, '2026-10');
insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha) values ('msg-e-1', 'gasto', 12, 'Aviso', '2026-10-15');
commit;

-- Datos de F, que no deben tocarse; con gastos en dos meses para los totales.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, disponible) values ('d4000000-0000-4000-8000-000000000001', 'Ahorro F', 'ahorro', 700);
insert into gastos (monto, descripcion, fecha) values (10.10, 'Agosto', '2026-08-20'), (20.20, 'Octubre', '2026-10-02'), (0.10, 'Octubre 2', '2026-10-30');
insert into ingresos (monto, descripcion, fecha) values (100, 'Octubre', '2026-10-01');
commit;

-- E1: sin sesión no se puede llamar
begin;
set local role anon;
do $$ begin
  perform eliminar_mi_cuenta('ELIMINAR');
  insert into resultados_ec values ('E1 sin sesión no se puede eliminar una cuenta', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados_ec values ('E1 sin sesión no se puede eliminar una cuenta', true, sqlerrm);
end $$;
commit;

-- E2: sin la palabra de confirmación no borra nada
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$ begin
  perform eliminar_mi_cuenta('si');
  insert into resultados_ec values ('E2 sin escribir ELIMINAR no borra', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados_ec values ('E2 sin escribir ELIMINAR no borra', true, sqlerrm);
end $$;
commit;

-- E3: con facturas guardadas se niega (no deja archivos huérfanos)
insert into storage.objects (bucket_id, name) values ('facturas', 'e0000000-0000-4000-8000-000000000005/factura.pdf');
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$ begin
  perform eliminar_mi_cuenta('ELIMINAR');
  insert into resultados_ec values ('E3 con facturas guardadas no borra la cuenta', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados_ec values ('E3 con facturas guardadas no borra la cuenta', true, sqlerrm);
end $$;
commit;
delete from storage.objects where name = 'e0000000-0000-4000-8000-000000000005/factura.pdf';

-- E4: borra al usuario y todo lo suyo en las 10 tablas
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select eliminar_mi_cuenta('ELIMINAR');
commit;
do $$ declare quedan int; usuario int; begin
  select count(*) into usuario from auth.users where id = 'e0000000-0000-4000-8000-000000000005';
  select (select count(*) from cuentas where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from categorias where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from gastos where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from deudas where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from abonos_deuda where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from recordatorios where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from ingresos where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from pagos_tarjeta where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from presupuestos where usuario_id = 'e0000000-0000-4000-8000-000000000005')
       + (select count(*) from transacciones_detectadas where usuario_id = 'e0000000-0000-4000-8000-000000000005')
    into quedan;
  insert into resultados_ec values ('E4 eliminar la cuenta borra al usuario y sus datos de las 10 tablas',
    usuario = 0 and quedan = 0, format('usuario %s, filas restantes %s', usuario, quedan));
end $$;

-- E5: lo de otra persona queda intacto
do $$ declare filas int; saldo numeric; begin
  select count(*) into filas from gastos where usuario_id = 'f0000000-0000-4000-8000-000000000006';
  select disponible into saldo from cuentas where id = 'd4000000-0000-4000-8000-000000000001';
  insert into resultados_ec values ('E5 los datos de otra persona quedan intactos', filas = 3 and saldo = 700,
    format('%s gastos, saldo %s', filas, saldo));
end $$;

-- R1: ninguna regla de RLS llama a auth.uid() por fila
do $$ declare n int; begin
  select count(*) into n from pg_policies
  where schemaname = 'public' and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
    and coalesce(qual, '') !~* 'select auth\.uid' and coalesce(with_check, '') !~* 'select auth\.uid';
  insert into resultados_ec values ('R1 las reglas de RLS calculan auth.uid() una vez por consulta', n = 0, n || ' reglas sin envolver');
end $$;

-- R2: todas las claves foráneas de public tienen índice
do $$ declare n int; begin
  select count(*) into n from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]);
  insert into resultados_ec values ('R2 todas las claves foráneas tienen índice', n = 0, n || ' sin índice');
end $$;

-- R3: totales por mes, con meses vacíos en 0 y solo los datos propios
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
do $$ declare r text; begin
  select string_agg(format('%s:%s/%s', mes, total_gastos, total_ingresos), ' ' order by mes) into r
  from totales_por_mes('2026-08-01', '2026-10-31');
  insert into resultados_ec values ('R3 totales por mes correctos, con meses vacíos y solo lo propio',
    r = '2026-08:10.10/0 2026-09:0/0 2026-10:20.30/100.00', r);
end $$;
do $$ begin
  perform totales_por_mes('2026-10-31', '2026-08-01');
  insert into resultados_ec values ('R4 rango de fechas al revés rechazado', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados_ec values ('R4 rango de fechas al revés rechazado', true, sqlerrm);
end $$;
commit;

begin;
set local role anon;
do $$ begin
  perform totales_por_mes('2026-08-01', '2026-10-31');
  insert into resultados_ec values ('R5 sin sesión no se pueden pedir totales', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados_ec values ('R5 sin sesión no se pueden pedir totales', true, sqlerrm);
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados_ec order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados_ec;
