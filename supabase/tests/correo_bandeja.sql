-- Pruebas de la migración 20261014140000_correo_confirmacion_y_privacidad.
-- Base DESECHABLE, usuarios A y B simulados con su JWT.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local'),
  ('b0000000-0000-4000-8000-000000000002', 'b@prueba.local')
on conflict (id) do nothing;

-- Un aviso de B, para probar el aislamiento.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, correo_asunto)
  values ('f7000000-0000-4000-8000-000000000009', 'msg-b-1', 'gasto', 10, 'Compra B', '2026-10-14', 'Asunto B');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible)
  values ('f1000000-0000-4000-8000-000000000001', 'Ahorro F1', 'ahorro', 500);
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, correo_asunto, cuenta_id) values
  ('f7000000-0000-4000-8000-000000000001', 'msg-1', 'gasto', 40, 'Compra supermercado', '2026-10-14', 'Consumo con tu tarjeta', 'f1000000-0000-4000-8000-000000000001'),
  ('f7000000-0000-4000-8000-000000000002', 'msg-2', 'ingreso', 100, 'Transferencia recibida', '2026-10-14', 'Te transfirieron', 'f1000000-0000-4000-8000-000000000001'),
  ('f7000000-0000-4000-8000-000000000003', 'msg-3', 'gasto', 15, 'Otra compra', '2026-10-14', 'Consumo', null);

-- B1: confirmar crea el gasto, descuenta la cuenta, marca el aviso y borra el asunto
do $$ declare cat uuid; gid uuid; t transacciones_detectadas; saldo numeric; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  gid := confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000001', 40, 'Compra supermercado', cat, 'f1000000-0000-4000-8000-000000000001');
  select * into t from transacciones_detectadas where id = 'f7000000-0000-4000-8000-000000000001';
  select disponible into saldo from cuentas where id = 'f1000000-0000-4000-8000-000000000001';
  insert into resultados values ('B1 confirmar crea el gasto, descuenta la cuenta y borra el asunto',
    gid is not null and t.estado = 'confirmado' and t.correo_asunto is null and saldo = 460,
    format('estado %s, asunto %s, saldo %s', t.estado, coalesce(t.correo_asunto, 'null'), saldo));
end $$;

-- B2: reintentar no duplica (idempotente)
do $$ declare cat uuid; gid uuid; n int; saldo numeric; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  gid := confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000001', 40, 'Compra supermercado', cat, 'f1000000-0000-4000-8000-000000000001');
  select count(*) into n from gastos where descripcion = 'Compra supermercado';
  select disponible into saldo from cuentas where id = 'f1000000-0000-4000-8000-000000000001';
  insert into resultados values ('B2 confirmar dos veces no duplica el gasto ni el descuento',
    gid is null and n = 1 and saldo = 460, format('id devuelto %s, gastos %s, saldo %s', coalesce(gid::text, 'null'), n, saldo));
end $$;

-- B3: un ingreso suma a la cuenta
do $$ declare saldo numeric; begin
  perform confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000002', 100, 'Transferencia recibida', null, 'f1000000-0000-4000-8000-000000000001');
  select disponible into saldo from cuentas where id = 'f1000000-0000-4000-8000-000000000001';
  insert into resultados values ('B3 confirmar un ingreso lo suma a la cuenta (460+100)', saldo = 560, 'saldo ' || saldo);
end $$;

-- B4: un gasto sin categoría no se confirma
do $$ begin
  perform confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000003', 15, 'Otra compra', null, null);
  insert into resultados values ('B4 un gasto sin categoría no se confirma', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('B4 un gasto sin categoría no se confirma', true, sqlerrm);
end $$;

-- B5: lo descartado no se confirma después
update transacciones_detectadas set estado = 'descartado', correo_asunto = null where id = 'f7000000-0000-4000-8000-000000000003';
do $$ declare cat uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  perform confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000003', 15, 'Otra compra', cat, null);
  insert into resultados values ('B5 un aviso descartado no se puede confirmar', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('B5 un aviso descartado no se puede confirmar', true, sqlerrm);
end $$;

-- B6: A no puede confirmar el aviso de B
do $$ declare cat uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  perform confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000009', 10, 'Compra B', cat, null);
  insert into resultados values ('B6 A no puede confirmar avisos de B', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('B6 A no puede confirmar avisos de B', true, sqlerrm);
end $$;

-- B7: confirmar con una cuenta ajena lo rechaza la validación de referencias
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha)
  values ('f7000000-0000-4000-8000-000000000004', 'msg-4', 'ingreso', 5, 'Prueba', '2026-10-14');
do $$ begin
  perform confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000004', 5, 'Prueba', null, 'e1000000-0000-4000-8000-000000000099');
  insert into resultados values ('B7 no se confirma hacia una cuenta que no es tuya', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('B7 no se confirma hacia una cuenta que no es tuya', true, sqlerrm);
end $$;

-- B8: borrar los datos del correo (lo que hace "Desconectar") solo toca lo propio
do $$ declare propios int; ajenos int; gastos_a int; begin
  delete from transacciones_detectadas where id is not null;
  select count(*) into propios from transacciones_detectadas;
  select count(*) into gastos_a from gastos where descripcion = 'Compra supermercado';
  insert into resultados values ('B8 borrar los datos del correo deja los gastos confirmados',
    propios = 0 and gastos_a = 1, format('avisos propios %s, gasto confirmado %s', propios, gastos_a));
end $$;
commit;

do $$ declare ajenos int; begin
  select count(*) into ajenos from transacciones_detectadas where usuario_id = 'b0000000-0000-4000-8000-000000000002';
  insert into resultados values ('B9 el borrado de A no toca los avisos de B', ajenos = 1, ajenos || ' avisos de B');
end $$;

begin;
set local role anon;
do $$ begin
  perform confirmar_transaccion_detectada('f7000000-0000-4000-8000-000000000009', 1, 'x', null, null);
  insert into resultados values ('B10 sin sesión no se puede confirmar', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('B10 sin sesión no se puede confirmar', true, sqlerrm);
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
