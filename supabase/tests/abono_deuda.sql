-- Pruebas de la migración 20261014120000_abono_deuda_atomico (Paso 2).
-- Mismo método que seguridad_y_presupuestos.sql: base DESECHABLE, dos
-- usuarios simulados con su JWT. La prueba de concurrencia (dos abonos
-- simultáneos) vive en correr.sh porque necesita dos sesiones.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local'),
  ('b0000000-0000-4000-8000-000000000002', 'b@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible) values ('c1000000-0000-4000-8000-000000000001', 'Ahorro A', 'ahorro', 500);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values ('c1000000-0000-4000-8000-000000000002', 'Visa A', 'credito', 1000, 1000);
insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual, proximo_pago)
  values ('c3000000-0000-4000-8000-000000000001', 'Préstamo A', 'prestamo', 300, 300, 100, '2026-11-01');

-- A1: abono que cubre la cuota
select registrar_abono_deuda('c3000000-0000-4000-8000-000000000001', 100, 'c1000000-0000-4000-8000-000000000001', '2026-10-14');
do $$ declare d deudas; a numeric; n int; begin
  select * into d from deudas where id = 'c3000000-0000-4000-8000-000000000001';
  select disponible into a from cuentas where id = 'c1000000-0000-4000-8000-000000000001';
  select count(*) into n from abonos_deuda where deuda_id = d.id;
  insert into resultados values ('A1 abono de la cuota: saldo, cuenta, próximo pago e historial',
    d.saldo_pendiente = 200 and a = 400 and d.proximo_pago = '2026-12-01' and n = 1,
    format('saldo %s, ahorro %s, próximo %s, abonos %s', d.saldo_pendiente, a, d.proximo_pago, n));
end $$;

-- A2: abono menor a la cuota no mueve la fecha
select registrar_abono_deuda('c3000000-0000-4000-8000-000000000001', 50, 'c1000000-0000-4000-8000-000000000001');
do $$ declare d deudas; begin
  select * into d from deudas where id = 'c3000000-0000-4000-8000-000000000001';
  insert into resultados values ('A2 abono parcial no adelanta el próximo pago',
    d.saldo_pendiente = 150 and d.proximo_pago = '2026-12-01', format('saldo %s, próximo %s', d.saldo_pendiente, d.proximo_pago));
end $$;

-- A3: abono mayor al saldo se recorta y solo se cobra lo debido
select registrar_abono_deuda('c3000000-0000-4000-8000-000000000001', 999, 'c1000000-0000-4000-8000-000000000001');
do $$ declare d deudas; a numeric; begin
  select * into d from deudas where id = 'c3000000-0000-4000-8000-000000000001';
  select disponible into a from cuentas where id = 'c1000000-0000-4000-8000-000000000001';
  insert into resultados values ('A3 abono de más se recorta al saldo (cobra 150, no 999)',
    d.saldo_pendiente = 0 and a = 200 and d.proximo_pago is null, format('saldo %s, ahorro %s, próximo %s', d.saldo_pendiente, a, d.proximo_pago));
end $$;

do $$ begin
  perform registrar_abono_deuda('c3000000-0000-4000-8000-000000000001', 10);
  insert into resultados values ('A4 deuda saldada rechaza abonos', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('A4 deuda saldada rechaza abonos', true, sqlerrm);
end $$;

insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual)
  values ('c3000000-0000-4000-8000-000000000002', 'Otra A', 'otro', 100, 100, 10);

do $$ begin
  perform registrar_abono_deuda('c3000000-0000-4000-8000-000000000002', 0);
  insert into resultados values ('A5 abono de 0 rechazado', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('A5 abono de 0 rechazado', true, sqlerrm);
end $$;

do $$ begin
  perform registrar_abono_deuda('c3000000-0000-4000-8000-000000000002', 10, 'c1000000-0000-4000-8000-000000000002');
  insert into resultados values ('A6 no se abona desde una tarjeta de crédito', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('A6 no se abona desde una tarjeta de crédito', true, sqlerrm);
end $$;

-- A7: cuota de un diferido en tarjeta libera cupo
insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
  values ('c4000000-0000-4000-8000-000000000001', 600, 'Laptop', 'c1000000-0000-4000-8000-000000000002', 'diferido', 6);
do $$ declare deuda_id uuid; t numeric; a numeric; d numeric; begin
  select id into deuda_id from deudas where gasto_id = 'c4000000-0000-4000-8000-000000000001';
  perform registrar_abono_deuda(deuda_id, 100, 'c1000000-0000-4000-8000-000000000001');
  select disponible into t from cuentas where id = 'c1000000-0000-4000-8000-000000000002';
  select disponible into a from cuentas where id = 'c1000000-0000-4000-8000-000000000001';
  select saldo_pendiente into d from deudas where id = deuda_id;
  insert into resultados values ('A7 cuota de diferido: tarjeta +100, ahorro -100, deuda -100',
    t = 500 and a = 100 and d = 500, format('tarjeta %s, ahorro %s, deuda %s', t, a, d));
end $$;

-- A9: el historial no se escribe a mano
do $$ begin
  insert into abonos_deuda (deuda_id, monto) values ('c3000000-0000-4000-8000-000000000002', 5);
  insert into resultados values ('A9 no se puede insertar abonos a mano', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('A9 no se puede insertar abonos a mano', true, sqlerrm);
end $$;
commit;

-- A8: B contra A
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform registrar_abono_deuda('c3000000-0000-4000-8000-000000000002', 10);
  insert into resultados values ('A8 B no puede abonar a la deuda de A', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('A8 B no puede abonar a la deuda de A', true, sqlerrm);
end $$;
insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual)
  values ('c3000000-0000-4000-8000-000000000003', 'Deuda B', 'otro', 100, 100, 10);
do $$ begin
  perform registrar_abono_deuda('c3000000-0000-4000-8000-000000000003', 10, 'c1000000-0000-4000-8000-000000000001');
  insert into resultados values ('A8b B no puede pagar su deuda con la cuenta de A', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('A8b B no puede pagar su deuda con la cuenta de A', true, sqlerrm);
end $$;
do $$ declare n int; begin
  select count(*) into n from abonos_deuda;
  insert into resultados values ('A8c B no ve el historial de abonos de A', n = 0, n || ' visibles');
end $$;
commit;

-- A10: sin sesión no se puede llamar
begin;
set local role anon;
do $$ begin
  perform registrar_abono_deuda('c3000000-0000-4000-8000-000000000002', 10);
  insert into resultados values ('A10 anon no puede ejecutar la función', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('A10 anon no puede ejecutar la función', true, sqlerrm);
end $$;
commit;

do $$ declare sin_path int; begin
  select count(*) into sin_path from pg_proc where proname = 'registrar_abono_deuda'
    and not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%');
  insert into resultados values ('A11 la función fija search_path', sin_path = 0, sin_path || ' sin fijar');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
