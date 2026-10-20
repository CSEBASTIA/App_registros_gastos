-- Pruebas de la migración 20261018120000_ajustes_y_transferencias.
-- Base DESECHABLE. T y U son usuarios propios de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-000000000020', 't-transferencias@prueba.local'),
  ('7f000000-0000-4000-8000-000000000021', 'u-transferencias@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000021","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, disponible) values
  ('7e100000-0000-4000-8000-0000000000a1', 'Ahorro de U', 'ahorro', 'pichincha', 1000);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible) values
  ('7e100000-0000-4000-8000-000000000001', 'Ahorro Pichincha', 'ahorro', 'pichincha', '1111', 500),
  ('7e100000-0000-4000-8000-000000000002', 'Efectivo', 'efectivo', 'otro', null, 20),
  ('7e100000-0000-4000-8000-000000000003', 'Débito Guayaquil', 'debito', 'banco_guayaquil', '2222', 300);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7e100000-0000-4000-8000-000000000004', 'Visa Produbanco', 'credito', 'produbanco', '3333', 200, 200);
commit;

-- Ayuda: disponible de una cuenta (sin RLS).
create or replace function pg_temp.saldo(p uuid) returns numeric language sql as $$ select disponible from cuentas where id = p $$;

-- T01-T03: una transferencia mueve los dos saldos y no es gasto ni ingreso
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into transferencias (id, cuenta_origen_id, cuenta_destino_id, monto, fecha, descripcion)
  values ('7e200000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-000000000002', 100, '2026-10-17', '  Para la semana  ');
do $$ declare g numeric; i numeric; d text; begin
  select coalesce(sum(total_gastos), 0), coalesce(sum(total_ingresos), 0) into g, i from totales_por_mes('2026-10-01', '2026-10-31');
  select descripcion into d from transferencias where id = '7e200000-0000-4000-8000-000000000001';
  insert into resultados values ('T02 no cuenta como gasto ni ingreso del mes', g = 0 and i = 0, format('gastos %s, ingresos %s', g, i));
  insert into resultados values ('T02b la descripción se guarda sin espacios de más', d = 'Para la semana', d);
end $$;
commit;
do $$ begin
  insert into resultados values ('T01 resta del origen y suma al destino',
    pg_temp.saldo('7e100000-0000-4000-8000-000000000001') = 400 and pg_temp.saldo('7e100000-0000-4000-8000-000000000002') = 120,
    format('ahorro %s, efectivo %s', pg_temp.saldo('7e100000-0000-4000-8000-000000000001'), pg_temp.saldo('7e100000-0000-4000-8000-000000000002')));
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
delete from transferencias where id = '7e200000-0000-4000-8000-000000000001';
commit;
do $$ begin
  insert into resultados values ('T03 borrarla devuelve los dos saldos',
    pg_temp.saldo('7e100000-0000-4000-8000-000000000001') = 500 and pg_temp.saldo('7e100000-0000-4000-8000-000000000002') = 20,
    format('ahorro %s, efectivo %s', pg_temp.saldo('7e100000-0000-4000-8000-000000000001'), pg_temp.saldo('7e100000-0000-4000-8000-000000000002')));
end $$;

-- T04-T08: reglas
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
do $$ begin
  begin
    insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto)
      values ('7e100000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-000000000004', 50);
    insert into resultados values ('T04 a una tarjeta de crédito no se transfiere (es «Pagar tarjeta»)', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('T04 a una tarjeta de crédito no se transfiere (es «Pagar tarjeta»)', sqlerrm like '%Pagar tarjeta%', sqlerrm);
  end;

  -- Avance de efectivo desde la tarjeta: dentro del cupo y también por encima
  -- (desde la migración de saldos, una tarjeta puede quedar sobreendeudada).
  insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto)
    values ('7e100000-0000-4000-8000-000000000004', '7e100000-0000-4000-8000-000000000002', 50);
  insert into transferencias (id, cuenta_origen_id, cuenta_destino_id, monto)
    values ('7e200000-0000-4000-8000-0000000000f5', '7e100000-0000-4000-8000-000000000004', '7e100000-0000-4000-8000-000000000002', 151);
  insert into resultados values ('T05 desde una tarjeta se puede pasar del cupo (queda en negativo)',
    (select disponible from cuentas where id = '7e100000-0000-4000-8000-000000000004') = -1,
    'tarjeta ' || (select disponible from cuentas where id = '7e100000-0000-4000-8000-000000000004'));
  -- Se deshace para que lo que sigue vea los saldos de siempre.
  delete from transferencias where id = '7e200000-0000-4000-8000-0000000000f5';

  begin
    insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto)
      values ('7e100000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-000000000001', 5);
    insert into resultados values ('T06 la misma cuenta en origen y destino se rechaza', false, 'se permitió');
  exception when invalid_parameter_value or check_violation then
    insert into resultados values ('T06 la misma cuenta en origen y destino se rechaza', true, sqlerrm);
  end;

  begin
    insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto)
      values ('7e100000-0000-4000-8000-000000000001', null, 5);
    insert into resultados values ('T06b sin cuenta de destino se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('T06b sin cuenta de destino se rechaza', true, sqlerrm);
  end;

  begin
    insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto)
      values ('7e100000-0000-4000-8000-0000000000a1', '7e100000-0000-4000-8000-000000000001', 300);
    insert into resultados values ('T07 no se puede sacar dinero de una cuenta ajena', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('T07 no se puede sacar dinero de una cuenta ajena', true, sqlerrm);
  end;
  begin
    insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto)
      values ('7e100000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-0000000000a1', 300);
    insert into resultados values ('T07b no se puede mandar dinero a una cuenta ajena', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('T07b no se puede mandar dinero a una cuenta ajena', true, sqlerrm);
  end;

  begin
    update transferencias set monto = 10;
    insert into resultados values ('T08 una transferencia no cambia de monto', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('T08 una transferencia no cambia de monto', true, sqlerrm);
  end;
  update transferencias set descripcion = 'Avance', fecha = '2026-10-16';
  insert into resultados values ('T08b la descripción y la fecha sí se editan',
    (select descripcion = 'Avance' and fecha = '2026-10-16' from transferencias limit 1), 'editada');
end $$;
commit;

do $$ begin
  insert into resultados values ('T07c la cuenta ajena quedó intacta',
    pg_temp.saldo('7e100000-0000-4000-8000-0000000000a1') = 1000, pg_temp.saldo('7e100000-0000-4000-8000-0000000000a1')::text);
end $$;

-- T09: U no ve las transferencias de T
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000021","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from transferencias;
  delete from transferencias;
  insert into resultados values ('T09 nadie ve ni borra las transferencias ajenas', n = 0, n || ' visibles');
end $$;
commit;
do $$ begin
  insert into resultados values ('T09b la transferencia de T sigue ahí', (select count(*) from transferencias where usuario_id = '7f000000-0000-4000-8000-000000000020') = 1, 'ok');
end $$;

-- T10: borrar una cuenta deja la transferencia y no toca la otra cuenta
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, disponible) values ('7e100000-0000-4000-8000-000000000005', 'Cuenta temporal', 'ahorro', 'otro', 80);
insert into transferencias (id, cuenta_origen_id, cuenta_destino_id, monto)
  values ('7e200000-0000-4000-8000-000000000010', '7e100000-0000-4000-8000-000000000005', '7e100000-0000-4000-8000-000000000003', 80);
delete from cuentas where id = '7e100000-0000-4000-8000-000000000005';
commit;
do $$ declare t transferencias; begin
  select * into t from transferencias where id = '7e200000-0000-4000-8000-000000000010';
  insert into resultados values ('T10 borrar la cuenta de origen deja la transferencia y el saldo del destino',
    t.id is not null and t.cuenta_origen_id is null and pg_temp.saldo('7e100000-0000-4000-8000-000000000003') = 380,
    format('origen %s, débito %s', t.cuenta_origen_id, pg_temp.saldo('7e100000-0000-4000-8000-000000000003')));
end $$;

-- T11: «enviada» y «recibida» llegan por separado y se juntan solas
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, banco, es_transferencia)
  values ('7e300000-0000-4000-8000-000000000001', 'tr-1-env', 'gasto', 50, 'Transferencia enviada', '2026-10-17', '7e100000-0000-4000-8000-000000000001', 'pichincha', true);
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, banco, es_transferencia)
  values ('7e300000-0000-4000-8000-000000000002', 'tr-1-rec', 'ingreso', 50, 'Transferencia recibida', '2026-10-18', '7e100000-0000-4000-8000-000000000003', 'banco_guayaquil', true);
commit;
do $$ declare t transferencias; a text; b text; ta uuid; tb uuid; n_gastos int; begin
  select * into t from transferencias where usuario_id = '7f000000-0000-4000-8000-000000000020' and origen = 'correo';
  select estado, transferencia_id into a, ta from transacciones_detectadas where id = '7e300000-0000-4000-8000-000000000001';
  select estado, transferencia_id into b, tb from transacciones_detectadas where id = '7e300000-0000-4000-8000-000000000002';
  select count(*) into n_gastos from gastos where usuario_id = '7f000000-0000-4000-8000-000000000020';
  insert into resultados values ('T11 enviada + recibida en otra cuenta propia = una transferencia, sin gasto ni ingreso',
    t.cuenta_origen_id = '7e100000-0000-4000-8000-000000000001' and t.cuenta_destino_id = '7e100000-0000-4000-8000-000000000003'
      and t.monto = 50 and t.fecha = '2026-10-17' and a = 'confirmado' and b = 'confirmado' and ta = t.id and tb = t.id
      and n_gastos = 0 and pg_temp.saldo('7e100000-0000-4000-8000-000000000001') = 450 and pg_temp.saldo('7e100000-0000-4000-8000-000000000003') = 430,
    format('%s→%s $%s %s; avisos %s/%s; gastos %s; ahorro %s, débito %s', t.cuenta_origen_id, t.cuenta_destino_id, t.monto, t.fecha, a, b, n_gastos,
      pg_temp.saldo('7e100000-0000-4000-8000-000000000001'), pg_temp.saldo('7e100000-0000-4000-8000-000000000003')));
end $$;

-- T12: las dos mitades en la misma sentencia se juntan una sola vez
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, es_transferencia) values
  ('tr-2-env', 'gasto', 25, 'Transferencia enviada', '2026-10-17', '7e100000-0000-4000-8000-000000000003', true),
  ('tr-2-rec', 'ingreso', 25, 'Transferencia recibida', '2026-10-17', '7e100000-0000-4000-8000-000000000001', true);
commit;
do $$ declare n int; p int; begin
  select count(*) into n from transferencias where usuario_id = '7f000000-0000-4000-8000-000000000020' and monto = 25;
  select count(*) into p from transacciones_detectadas where mensaje_id in ('tr-2-env', 'tr-2-rec') and estado = 'confirmado';
  insert into resultados values ('T12 llegadas juntas: una sola transferencia', n = 1 and p = 2, format('%s transferencias, %s avisos resueltos', n, p));
end $$;

-- T13: si hay dos candidatas, no adivina
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, es_transferencia) values
  ('tr-3-rec-a', 'ingreso', 70, 'Transferencia recibida', '2026-10-17', '7e100000-0000-4000-8000-000000000003', true),
  ('tr-3-rec-b', 'ingreso', 70, 'Transferencia recibida', '2026-10-17', '7e100000-0000-4000-8000-000000000002', true);
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, es_transferencia)
  values ('tr-3-env', 'gasto', 70, 'Transferencia enviada', '2026-10-17', '7e100000-0000-4000-8000-000000000001', true);
commit;
do $$ declare n int; p int; begin
  select count(*) into n from transferencias where usuario_id = '7f000000-0000-4000-8000-000000000020' and monto = 70;
  select count(*) into p from transacciones_detectadas where mensaje_id like 'tr-3-%' and estado = 'pendiente';
  insert into resultados values ('T13 con dos posibles destinos no junta nada: se decide en la bandeja', n = 0 and p = 3, format('%s transferencias, %s pendientes', n, p));
end $$;

-- T14: con el registro automático apagado no se juntan; T15: a una tarjeta tampoco
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
insert into ajustes_usuario (registro_automatico) values (false);
insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, es_transferencia) values
  ('tr-4-env', 'gasto', 15, 'Transferencia enviada', '2026-10-17', '7e100000-0000-4000-8000-000000000001', true),
  ('tr-4-rec', 'ingreso', 15, 'Transferencia recibida', '2026-10-17', '7e100000-0000-4000-8000-000000000003', true);
update ajustes_usuario set registro_automatico = true, updated_at = now();
insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, es_transferencia) values
  ('tr-5-env', 'gasto', 35, 'Transferencia enviada', '2026-10-17', '7e100000-0000-4000-8000-000000000001', true),
  ('tr-5-rec', 'ingreso', 35, 'Pago recibido', '2026-10-17', '7e100000-0000-4000-8000-000000000004', true);
commit;
do $$ declare p4 int; p5 int; begin
  select count(*) into p4 from transacciones_detectadas where mensaje_id like 'tr-4-%' and estado = 'pendiente';
  select count(*) into p5 from transacciones_detectadas where mensaje_id like 'tr-5-%' and estado = 'pendiente';
  insert into resultados values ('T14 con el registro automático apagado, quedan en la bandeja', p4 = 2, p4 || ' pendientes');
  insert into resultados values ('T15 si el destino es una tarjeta de crédito, quedan en la bandeja', p5 = 2, p5 || ' pendientes');
end $$;

-- T16: confirmar desde la bandeja como transferencia (resuelve también la otra mitad)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
do $$ declare env uuid; t1 uuid; t2 uuid; t transferencias; e_env text; e_rec text; e_otra text; begin
  select id into env from transacciones_detectadas where mensaje_id = 'tr-3-env';
  t1 := confirmar_aviso_como_transferencia(env, '7e100000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-000000000003', null, null);
  t2 := confirmar_aviso_como_transferencia(env, '7e100000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-000000000003', null, null);
  select * into t from transferencias where id = t1;
  select estado into e_env from transacciones_detectadas where mensaje_id = 'tr-3-env';
  select estado into e_rec from transacciones_detectadas where mensaje_id = 'tr-3-rec-a';
  select estado into e_otra from transacciones_detectadas where mensaje_id = 'tr-3-rec-b';
  insert into resultados values ('T16 confirmar como transferencia: resuelve las dos mitades y no duplica al reintentar',
    t1 = t2 and t.cuenta_origen_id = '7e100000-0000-4000-8000-000000000001' and t.cuenta_destino_id = '7e100000-0000-4000-8000-000000000003'
      and t.monto = 70 and e_env = 'confirmado' and e_rec = 'confirmado' and e_otra = 'pendiente',
    format('mismo id %s; %s→%s; avisos %s/%s/%s', t1 = t2, t.cuenta_origen_id, t.cuenta_destino_id, e_env, e_rec, e_otra));
end $$;
commit;

-- T17: separar una transferencia que se juntó sola
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
do $$ declare tid uuid; n int; antes_a numeric; antes_d numeric; quedan int; marcados int; begin
  select id into tid from transferencias where monto = 25;
  antes_a := pg_temp.saldo('7e100000-0000-4000-8000-000000000001');
  antes_d := pg_temp.saldo('7e100000-0000-4000-8000-000000000003');
  n := separar_transferencia(tid);
  select count(*) into quedan from transferencias where id = tid;
  select count(*) into marcados from transacciones_detectadas where mensaje_id in ('tr-2-env', 'tr-2-rec') and estado = 'pendiente' and not es_transferencia;
  insert into resultados values ('T17 separar: borra la transferencia, ajusta los saldos y devuelve los dos avisos a la bandeja',
    n = 2 and quedan = 0 and marcados = 2
      and pg_temp.saldo('7e100000-0000-4000-8000-000000000001') = antes_a - 25
      and pg_temp.saldo('7e100000-0000-4000-8000-000000000003') = antes_d + 25,
    format('%s avisos, %s transferencias, %s pendientes sin marca', n, quedan, marcados));
end $$;
commit;

-- T18: una transferencia manual no se «separa»; T19: un aviso confirmado sigue sin volver atrás
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000020","role":"authenticated"}', true);
do $$ declare tid uuid; aid uuid; begin
  select id into tid from transferencias where origen = 'manual' limit 1;
  begin
    perform separar_transferencia(tid);
    insert into resultados values ('T18 una transferencia hecha a mano no se separa (se elimina)', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('T18 una transferencia hecha a mano no se separa (se elimina)', true, sqlerrm);
  end;
  select id into aid from transacciones_detectadas where mensaje_id = 'tr-1-env';
  begin
    update transacciones_detectadas set estado = 'pendiente', transferencia_id = null where id = aid;
    insert into resultados values ('T19 fuera de «separar», un aviso confirmado no vuelve a pendiente', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('T19 fuera de «separar», un aviso confirmado no vuelve a pendiente', true, sqlerrm);
  end;
end $$;
commit;

-- T20: U no puede convertir ni separar avisos de T
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000021","role":"authenticated"}', true);
do $$ declare aid uuid; begin
  select id into aid from transacciones_detectadas where mensaje_id = 'tr-3-rec-b';
  begin
    perform confirmar_aviso_como_transferencia('7e300000-0000-4000-8000-000000000001', '7e100000-0000-4000-8000-0000000000a1', '7e100000-0000-4000-8000-000000000001', null, null);
    insert into resultados values ('T20 nadie confirma avisos ajenos como transferencia', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('T20 nadie confirma avisos ajenos como transferencia', true, sqlerrm);
  end;
end $$;
commit;

-- T21: anon no ve nada ni ejecuta las funciones
begin;
set local role anon;
do $$ begin
  begin
    perform 1 from transferencias;
    insert into resultados values ('T21 anon no lee transferencias', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('T21 anon no lee transferencias', true, sqlerrm);
  end;
  begin
    perform separar_transferencia(gen_random_uuid());
    insert into resultados values ('T21b anon no ejecuta separar_transferencia', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('T21b anon no ejecuta separar_transferencia', true, sqlerrm);
  end;
end $$;
commit;

-- T22: funciones con search_path fijo
do $$ declare n int; begin
  select count(*) into n from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('registro_automatico_activo', 'validar_transferencia', 'aplicar_transferencia', 'revertir_transferencia',
                      'proteger_transferencia', 'emparejar_transferencia_detectada', 'confirmar_aviso_como_transferencia',
                      'separar_transferencia', 'proteger_estado_aviso')
    and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  insert into resultados values ('T22 las funciones nuevas fijan search_path', n = 0, n || ' sin fijar');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
