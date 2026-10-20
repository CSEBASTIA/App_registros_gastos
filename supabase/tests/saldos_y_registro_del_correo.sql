-- Pruebas de la migración 20261019120000_saldos_y_registro_del_correo.
-- Base DESECHABLE. S y U son usuarios propios de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-000000000040', 's-saldos@prueba.local'),
  ('7f000000-0000-4000-8000-000000000041', 'u-saldos@prueba.local')
on conflict (id) do nothing;

-- Cuentas de S: ahorro en Guayaquil (…4321) y en Pichincha (…8765), una AMEX (…1234) y efectivo.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000040","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible) values
  ('7e900000-0000-4000-8000-000000000001', 'Ahorro Guayaquil', 'ahorro', 'banco_guayaquil', '4321', 100),
  ('7e900000-0000-4000-8000-000000000002', 'Ahorro Pichincha', 'ahorro', 'pichincha', '8765', 50),
  ('7e900000-0000-4000-8000-000000000004', 'Efectivo', 'efectivo', 'otro', null, 10);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7e900000-0000-4000-8000-000000000003', 'AMEX', 'credito', 'banco_guayaquil', '1234', 40, 100);
commit;

-- Y una cuenta de U (para el aislamiento).
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000041","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, disponible) values
  ('7e900000-0000-4000-8000-0000000000a1', 'Ahorro de U', 'ahorro', 'pichincha', 500);
commit;

create or replace function pg_temp.saldo(p uuid) returns numeric language sql as $$ select disponible from cuentas where id = p $$;

-- 1) SALDOS ---------------------------------------------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000040","role":"authenticated"}', true);

-- S01: un gasto que dejaría el efectivo en negativo se rechaza y no mueve nada
do $$ declare cat uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  begin
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha) values (11, 'Almuerzo', cat, '7e900000-0000-4000-8000-000000000004', '2026-10-19');
    insert into resultados values ('S01 un gasto que deja el efectivo en negativo se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('S01 un gasto que deja el efectivo en negativo se rechaza',
      sqlerrm like '%no puede quedar con saldo negativo%' and pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = 10, sqlerrm);
  end;
end $$;

-- S02: una tarjeta sí puede pasarse del cupo (queda en negativo: sobreendeudada)
do $$ declare cat uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, metodo_pago, fecha) values (60, 'Compra grande', cat, '7e900000-0000-4000-8000-000000000003', 'credito', '2026-10-19');
  insert into resultados values ('S02 una tarjeta puede pasarse del cupo (40 - 60 = -20)',
    pg_temp.saldo('7e900000-0000-4000-8000-000000000003') = -20, 'disponible ' || pg_temp.saldo('7e900000-0000-4000-8000-000000000003'));
end $$;

-- S03: un avance desde la tarjeta también puede pasarse del cupo
do $$ begin
  insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto) values ('7e900000-0000-4000-8000-000000000003', '7e900000-0000-4000-8000-000000000004', 5);
  insert into resultados values ('S03 un avance desde la tarjeta puede pasarse del cupo (-20 - 5 = -25)',
    pg_temp.saldo('7e900000-0000-4000-8000-000000000003') = -25 and pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = 15,
    format('tarjeta %s, efectivo %s', pg_temp.saldo('7e900000-0000-4000-8000-000000000003'), pg_temp.saldo('7e900000-0000-4000-8000-000000000004')));
end $$;

-- S04: una transferencia desde una cuenta sin saldo suficiente se rechaza
do $$ begin
  begin
    insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto) values ('7e900000-0000-4000-8000-000000000004', '7e900000-0000-4000-8000-000000000002', 16);
    insert into resultados values ('S04 una transferencia sin saldo suficiente se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('S04 una transferencia sin saldo suficiente se rechaza',
      pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = 15 and pg_temp.saldo('7e900000-0000-4000-8000-000000000002') = 50, sqlerrm);
  end;
end $$;

-- S05: borrar un ingreso que dejaría la cuenta en negativo se rechaza
do $$ declare cat uuid; i uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into ingresos (monto, descripcion, cuenta_id, fecha) values (20, 'Venta', '7e900000-0000-4000-8000-000000000004', '2026-10-19') returning id into i;
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha) values (30, 'Mercado', cat, '7e900000-0000-4000-8000-000000000004', '2026-10-19');
  begin
    delete from ingresos where id = i;
    insert into resultados values ('S05 borrar un ingreso que deja la cuenta en negativo se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('S05 borrar un ingreso que deja la cuenta en negativo se rechaza',
      pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = 5 and exists (select 1 from ingresos where id = i), sqlerrm);
  end;
end $$;

-- S06: pagar una tarjeta desde una cuenta sin saldo suficiente se rechaza
do $$ begin
  begin
    insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto, fecha) values ('7e900000-0000-4000-8000-000000000003', '7e900000-0000-4000-8000-000000000004', 6, '2026-10-19');
    insert into resultados values ('S06 pagar la tarjeta desde una cuenta sin saldo suficiente se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('S06 pagar la tarjeta desde una cuenta sin saldo suficiente se rechaza',
      pg_temp.saldo('7e900000-0000-4000-8000-000000000003') = -25 and pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = 5, sqlerrm);
  end;
end $$;
commit;

-- S07: una cuenta que ya estaba en negativo (datos de antes) puede subir, pero no bajar más
set session_replication_role = replica;
update cuentas set disponible = -5 where id = '7e900000-0000-4000-8000-000000000004';
set session_replication_role = default;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000040","role":"authenticated"}', true);
do $$ declare cat uuid; subio boolean; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into ingresos (monto, descripcion, cuenta_id, fecha) values (3, 'Vuelto', '7e900000-0000-4000-8000-000000000004', '2026-10-19');
  subio := pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = -2;
  begin
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha) values (1, 'Chicle', cat, '7e900000-0000-4000-8000-000000000004', '2026-10-19');
    insert into resultados values ('S07 una cuenta ya en negativo puede subir pero no bajar más', false, 'se permitió bajar');
  exception when invalid_parameter_value then
    insert into resultados values ('S07 una cuenta ya en negativo puede subir pero no bajar más', subio, 'saldo ' || pg_temp.saldo('7e900000-0000-4000-8000-000000000004'));
  end;
end $$;
commit;
-- El efectivo vuelve a 10 para lo que sigue.
set session_replication_role = replica;
update cuentas set disponible = 10 where id = '7e900000-0000-4000-8000-000000000004';
update cuentas set disponible = 40 where id = '7e900000-0000-4000-8000-000000000003';
set session_replication_role = default;

-- 2) REGISTRO DEL CORREO ----------------------------------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000040","role":"authenticated"}', true);

-- Un lugar ya conocido con el nombre del comercio.
insert into lugares (id, nombre, latitud, longitud) values ('7e800000-0000-4000-8000-000000000001', 'TIENDA PRUEBA S A', -2.19, -79.89);
-- Un gasto que ya registró Google Wallet a las 12:00 (para el duplicado).
insert into gastos (id, monto, descripcion, categoria_id, cuenta_id, metodo_pago, billetera, fecha, pagado_en)
  select '7e700000-0000-4000-8000-000000000001', 9.99, 'Cafetería', id, '7e900000-0000-4000-8000-000000000003', 'credito', 'google_wallet', '2026-10-18', '2026-10-18 12:00:00-05'
  from categorias where nombre = 'Comida' and usuario_id is null;
-- Un gasto anotado a mano el mismo día, sin hora.
insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha)
  select 3.50, 'Pan', id, '7e900000-0000-4000-8000-000000000001', '2026-10-18' from categorias where nombre = 'Comida' and usuario_id is null;

insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, clase, comercio, tarjeta_final, pagado_en, correo_asunto) values
  -- C1: consumo con la AMEX
  ('7e600000-0000-4000-8000-000000000001', 'c1', 'gasto', 12.34, 'TIENDA PRUEBA S A', '2026-10-17', '7e900000-0000-4000-8000-000000000003', 'consumo', 'TIENDA PRUEBA S A', '1234', '2026-10-17 12:34:56-05', 'Consumo por $ 12.34 en TIENDA PRUEBA S A'),
  -- C2: el mismo café que ya registró Google Wallet (2 minutos después)
  ('7e600000-0000-4000-8000-000000000002', 'c2', 'gasto', 9.99, 'Cafetería', '2026-10-18', '7e900000-0000-4000-8000-000000000003', 'consumo', 'Cafetería', '1234', '2026-10-18 12:02:00-05', null),
  -- C3: igual a uno anotado a mano el mismo día (sin hora): que decida la persona
  ('7e600000-0000-4000-8000-000000000003', 'c3', 'gasto', 3.50, 'Panadería', '2026-10-18', '7e900000-0000-4000-8000-000000000001', 'consumo', 'Panadería', '4321', '2026-10-18 08:00:00-05', null),
  -- C4: consumo con débito que dejaría la cuenta en negativo
  ('7e600000-0000-4000-8000-000000000004', 'c4', 'gasto', 80, 'Electrónica', '2026-10-18', '7e900000-0000-4000-8000-000000000002', 'consumo', 'Electrónica', '8765', '2026-10-18 10:00:00-05', null),
  -- C5: consumo sin cuenta reconocida
  ('7e600000-0000-4000-8000-000000000005', 'c5', 'gasto', 4, 'Kiosco', '2026-10-18', null, 'consumo', 'Kiosco', '9999', '2026-10-18 11:00:00-05', null);

insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, contraparte_cuenta_id, clase, tarjeta_final, pagado_en) values
  -- P1 y P2: el mismo pago de tarjeta en dos correos (el del banco y el comprobante)
  ('7e600000-0000-4000-8000-000000000011', 'p1', 'gasto', 50, 'Pago de la tarjeta ••1234', '2026-10-17', '7e900000-0000-4000-8000-000000000003', '7e900000-0000-4000-8000-000000000001', 'pago_tarjeta', '1234', '2026-10-17 13:45:00-05'),
  ('7e600000-0000-4000-8000-000000000012', 'p2', 'gasto', 50, 'Pago de la tarjeta ••234', '2026-10-17', '7e900000-0000-4000-8000-000000000003', '7e900000-0000-4000-8000-000000000001', 'pago_tarjeta', '234', '2026-10-17 13:45:00-05'),
  -- P3: pago de tarjeta sin saber desde qué cuenta: a la bandeja
  ('7e600000-0000-4000-8000-000000000013', 'p3', 'gasto', 5, 'Pago de la tarjeta ••1234', '2026-10-18', '7e900000-0000-4000-8000-000000000003', null, 'pago_tarjeta', '1234', '2026-10-18 09:00:00-05');

insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, contraparte_cuenta_id, clase, comision, es_transferencia, pagado_en) values
  -- T1: transferencia entre cuentas propias con comisión
  ('7e600000-0000-4000-8000-000000000021', 't1', 'gasto', 10.00, 'Transferencia a la cuenta ••8765', '2026-10-19', '7e900000-0000-4000-8000-000000000001', '7e900000-0000-4000-8000-000000000002', 'transferencia', 0.25, true, '2026-10-19 09:00:00-05'),
  -- T2: transferencia a un tercero: a la bandeja
  ('7e600000-0000-4000-8000-000000000022', 't2', 'gasto', 2, 'Transferencia ••4444', '2026-10-19', '7e900000-0000-4000-8000-000000000002', null, 'transferencia', null, true, null),
  -- T3: una «transferencia» que apunta a una cuenta de otra persona: no se usa
  ('7e600000-0000-4000-8000-000000000023', 't3', 'gasto', 1, 'Transferencia rara', '2026-10-19', '7e900000-0000-4000-8000-000000000001', '7e900000-0000-4000-8000-0000000000a1', 'transferencia', null, true, null);

do $$ declare r jsonb; begin
  r := registrar_avisos_correo();
  insert into resultados values ('X00 registrar_avisos_correo responde una lista', jsonb_typeof(r) = 'array', r::text);
  create temp table respuesta_correo as select r as r;
end $$;
commit;

do $$
declare
  r jsonb := (select r from respuesta_correo);
  a transacciones_detectadas;
  g gastos;
  n int;
begin
  -- C1
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000001';
  select * into g from gastos where id = a.gasto_id;
  insert into resultados values ('C1 un consumo reconocido se registra solo: gasto con crédito, hora, comercio y lugar',
    a.estado = 'confirmado' and g.monto = 12.34 and g.descripcion = 'TIENDA PRUEBA S A' and g.metodo_pago = 'credito'
      and g.pagado_en = '2026-10-17 12:34:56-05' and g.fecha = '2026-10-17' and g.lugar_id = '7e800000-0000-4000-8000-000000000001'
      and pg_temp.saldo('7e900000-0000-4000-8000-000000000003') = 40 - 9.99 - 12.34 + 50,
    format('estado %s, gasto %s %s %s, lugar %s, tarjeta %s', a.estado, g.monto, g.metodo_pago, g.pagado_en, g.lugar_id, pg_temp.saldo('7e900000-0000-4000-8000-000000000003')));
  insert into resultados values ('C1b al resolverse, el aviso olvida comercio, dígitos y asunto',
    a.comercio is null and a.tarjeta_final is null and a.correo_asunto is null, coalesce(a.comercio, '') || coalesce(a.tarjeta_final, ''));
  insert into resultados values ('C1c la respuesta dice qué se registró, con la tarjeta y sin pedir lugar',
    exists (select 1 from jsonb_array_elements(r) e where e ->> 'aviso' = '7e600000-0000-4000-8000-000000000001'
      and e ->> 'resultado' = 'registrado' and e ->> 'tarjeta' = '1234' and (e ->> 'sin_lugar')::boolean = false),
    r::text);

  -- C2
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000002';
  select count(*) into n from gastos where monto = 9.99 and cuenta_id = '7e900000-0000-4000-8000-000000000003';
  insert into resultados values ('C2 lo que ya registró Google Wallet a la misma hora no se duplica',
    a.estado = 'confirmado' and a.gasto_id = '7e700000-0000-4000-8000-000000000001' and n = 1, format('estado %s, gastos %s', a.estado, n));

  -- C3, C4, C5
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000003';
  insert into resultados values ('C3 igual a uno anotado a mano el mismo día: queda en la bandeja', a.estado = 'pendiente', a.estado);
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000004';
  insert into resultados values ('C4 si dejaría la cuenta en negativo: queda en la bandeja y no se escribe nada',
    a.estado = 'pendiente' and not exists (select 1 from gastos where descripcion = 'Electrónica'), a.estado);
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000005';
  insert into resultados values ('C5 sin cuenta reconocida: queda en la bandeja', a.estado = 'pendiente', a.estado);

  -- P1, P2, P3
  select count(*) into n from pagos_tarjeta where cuenta_id = '7e900000-0000-4000-8000-000000000003' and monto = 50;
  insert into resultados values ('P1 un pago de tarjeta que llega en dos correos se registra una vez (sube el cupo, baja el ahorro)',
    n = 1
      and (select count(*) from transacciones_detectadas where id in ('7e600000-0000-4000-8000-000000000011', '7e600000-0000-4000-8000-000000000012') and estado = 'confirmado') = 2,
    format('pagos %s, ahorro %s', n, pg_temp.saldo('7e900000-0000-4000-8000-000000000001')));
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000013';
  insert into resultados values ('P3 un pago de tarjeta sin cuenta de origen queda en la bandeja', a.estado = 'pendiente', a.estado);

  -- T1, T2, T3
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000021';
  insert into resultados values ('T1 transferencia entre cuentas propias: se registra y la comisión es un gasto aparte',
    a.estado = 'confirmado' and a.transferencia_id is not null
      and pg_temp.saldo('7e900000-0000-4000-8000-000000000002') = 60.00
      and exists (select 1 from gastos where descripcion = 'Comisión de transferencia' and monto = 0.25 and cuenta_id = '7e900000-0000-4000-8000-000000000001')
      and exists (select 1 from transferencias where id = a.transferencia_id and monto = 10.00 and origen = 'correo'),
    format('estado %s, ahorro GYE %s, ahorro Pichincha %s', a.estado, pg_temp.saldo('7e900000-0000-4000-8000-000000000001'), pg_temp.saldo('7e900000-0000-4000-8000-000000000002')));
end $$;

-- Ahorro de Guayaquil: 100 - 3,50 (pan) - 50 (pago P1) - 10 (transferencia T1) - 0,25 (comisión) = 36,25.
do $$ begin
  insert into resultados values ('T1b el ahorro de Guayaquil queda en 100 - 3,50 - 50 - 10 - 0,25 = 36,25',
    pg_temp.saldo('7e900000-0000-4000-8000-000000000001') = 36.25, 'saldo ' || pg_temp.saldo('7e900000-0000-4000-8000-000000000001'));
end $$;

do $$ declare a transacciones_detectadas; begin
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000022';
  insert into resultados values ('T2 una transferencia a un tercero queda en la bandeja', a.estado = 'pendiente', a.estado);
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000023';
  insert into resultados values ('T3 una cuenta de otra persona en el aviso no se usa: queda en la bandeja',
    a.estado = 'pendiente' and pg_temp.saldo('7e900000-0000-4000-8000-0000000000a1') = 500, a.estado);
end $$;

-- T4: la otra mitad («recibida») de la transferencia que ya se registró no se vuelve a contar
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000040","role":"authenticated"}', true);
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, es_transferencia) values
  ('7e600000-0000-4000-8000-000000000024', 't4', 'ingreso', 10.00, 'Transferencia recibida', '2026-10-19', '7e900000-0000-4000-8000-000000000002', true);
select registrar_avisos_correo() is not null;
commit;
do $$ declare a transacciones_detectadas; t uuid; begin
  select * into a from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000024';
  select transferencia_id into t from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000021';
  insert into resultados values ('T4 el aviso de «recibida» se junta con la transferencia ya registrada (sin sumar otra vez)',
    a.estado = 'confirmado' and a.transferencia_id = t and pg_temp.saldo('7e900000-0000-4000-8000-000000000002') = 60.00,
    format('estado %s, saldo %s', a.estado, pg_temp.saldo('7e900000-0000-4000-8000-000000000002')));
end $$;

-- R1: confirmar en la bandeja un pago de tarjeta (P3), eligiendo la cuenta de origen
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000040","role":"authenticated"}', true);
do $$ declare p uuid; p2 uuid; antes numeric := pg_temp.saldo('7e900000-0000-4000-8000-000000000003'); begin
  p := confirmar_aviso_como_pago_tarjeta('7e600000-0000-4000-8000-000000000013', '7e900000-0000-4000-8000-000000000003', '7e900000-0000-4000-8000-000000000004');
  p2 := confirmar_aviso_como_pago_tarjeta('7e600000-0000-4000-8000-000000000013', '7e900000-0000-4000-8000-000000000003', '7e900000-0000-4000-8000-000000000004');
  insert into resultados values ('R1 confirmar un pago de tarjeta desde la bandeja: sube el cupo, baja el efectivo y no se duplica',
    p is not null and p2 is null and pg_temp.saldo('7e900000-0000-4000-8000-000000000003') = antes + 5
      and pg_temp.saldo('7e900000-0000-4000-8000-000000000004') = 5
      and (select estado from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000013') = 'confirmado',
    format('pago %s, reintento %s, tarjeta %s, efectivo %s', p, p2, pg_temp.saldo('7e900000-0000-4000-8000-000000000003'), pg_temp.saldo('7e900000-0000-4000-8000-000000000004')));
  begin
    perform confirmar_aviso_como_pago_tarjeta('7e600000-0000-4000-8000-000000000005', '7e900000-0000-4000-8000-000000000001', '7e900000-0000-4000-8000-000000000004');
    insert into resultados values ('R2 solo se paga una tarjeta de crédito', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('R2 solo se paga una tarjeta de crédito', true, sqlerrm);
  end;
end $$;
commit;

-- U: con el registro automático apagado no se registra nada; y no toca avisos ajenos
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000041","role":"authenticated"}', true);
insert into ajustes_usuario (usuario_id, registro_automatico) values ('7f000000-0000-4000-8000-000000000041', false);
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, cuenta_id, clase, comercio, pagado_en) values
  ('7e600000-0000-4000-8000-000000000031', 'u1', 'gasto', 5, 'Kiosco U', '2026-10-19', '7e900000-0000-4000-8000-0000000000a1', 'consumo', 'Kiosco U', '2026-10-19 09:00:00-05');
do $$ declare r jsonb; begin
  r := registrar_avisos_correo();
  insert into resultados values ('U1 con el registro automático apagado no se registra nada',
    r = '[]'::jsonb and (select estado from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000031') = 'pendiente', r::text);
  insert into resultados values ('U2 los avisos de otra persona siguen pendientes (C3 de S)',
    (select count(*) from transacciones_detectadas where id = '7e600000-0000-4000-8000-000000000003') = 0, 'RLS: U no ve los avisos de S');
end $$;
commit;

-- Seguridad: anon no puede llamar a las funciones nuevas; search_path fijo
do $$ declare n int; begin
  select count(*) into n from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('registrar_avisos_correo', 'confirmar_aviso_como_pago_tarjeta', 'validar_saldo_cuenta', 'validar_transferencia')
    and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  insert into resultados values ('X01 las funciones nuevas fijan search_path', n = 0, n || ' sin fijar');
  insert into resultados values ('X02 anon no puede registrar avisos ni confirmar pagos',
    not has_function_privilege('anon', 'public.registrar_avisos_correo()', 'execute')
      and not has_function_privilege('anon', 'public.confirmar_aviso_como_pago_tarjeta(uuid, uuid, uuid, numeric)', 'execute')
      and has_function_privilege('authenticated', 'public.registrar_avisos_correo()', 'execute'),
    'privilegios');
  insert into resultados values ('X03 ya no existe el rechazo por cupo',
    not exists (select 1 from pg_trigger where tgname in ('trg_03_validar_cupo_gasto', 'trg_validar_cupo_lote_insert', 'trg_validar_cupo_lote_update')),
    'disparadores');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
