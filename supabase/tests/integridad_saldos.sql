-- Pruebas de la migración 20261015120000_integridad_saldos
-- (hallazgos de la revisión de bugs del 14-oct). Base DESECHABLE.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local'),
  ('c0000000-0000-4000-8000-000000000003', 'c@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible) values
  ('91000000-0000-4000-8000-000000000001', 'Ahorro I1', 'ahorro', 2000),
  ('91000000-0000-4000-8000-000000000003', 'Ahorro I3', 'ahorro', 1000);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values
  ('91000000-0000-4000-8000-000000000002', 'Visa I2', 'credito', 1000, 1000),
  ('91000000-0000-4000-8000-000000000004', 'Diners I4', 'credito', 2000, 2000);

-- G1: editar solo la descripción de un gasto ya pagado no toca el cupo
insert into gastos (id, monto, descripcion, cuenta_id) values ('92000000-0000-4000-8000-000000000001', 300, 'Compra', '91000000-0000-4000-8000-000000000002');
insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto) values ('91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 300);
update gastos set descripcion = 'Compra corregida', monto = 300, cuenta_id = '91000000-0000-4000-8000-000000000002' where id = '92000000-0000-4000-8000-000000000001';
do $$ declare t numeric; begin
  select disponible into t from cuentas where id = '91000000-0000-4000-8000-000000000002';
  insert into resultados values ('G1 editar la descripción de un gasto pagado no quita cupo', t = 1000, 'tarjeta ' || t);
end $$;

-- G2: subir el monto en la misma cuenta aplica solo la diferencia
update gastos set monto = 350 where id = '92000000-0000-4000-8000-000000000001';
do $$ declare t numeric; begin
  select disponible into t from cuentas where id = '91000000-0000-4000-8000-000000000002';
  insert into resultados values ('G2 subir el monto 300→350 resta solo 50', t = 950, 'tarjeta ' || t);
end $$;

-- G3: borrar un gasto ya pagado deja saldo a favor (no se pierde dinero)
delete from gastos where id = '92000000-0000-4000-8000-000000000001';
do $$ declare t numeric; begin
  select disponible into t from cuentas where id = '91000000-0000-4000-8000-000000000002';
  insert into resultados values ('G3 borrar un gasto ya pagado deja 300 de saldo a favor', t = 1300, 'tarjeta ' || t || ' (cupo 1000)');
end $$;

-- P1: pagar de más deja saldo a favor y el dinero total se conserva
do $$ declare antes numeric; despues numeric; t numeric; begin
  select sum(disponible) into antes from cuentas where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002');
  insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto) values ('91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 200);
  select sum(disponible) into despues from cuentas where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002');
  select disponible into t from cuentas where id = '91000000-0000-4000-8000-000000000002';
  insert into resultados values ('P1 un pago de más no hace desaparecer dinero', antes = despues and t = 1500,
    format('total antes %s, después %s, tarjeta %s', antes, despues, t));
end $$;

-- D1: un diferido no se carga a una cuenta de ahorro
do $$ begin
  insert into gastos (monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
    values (1200, 'TV', '91000000-0000-4000-8000-000000000001', 'diferido', 12);
  insert into resultados values ('D1 un diferido no se carga a una cuenta de ahorro', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('D1 un diferido no se carga a una cuenta de ahorro', true, sqlerrm);
end $$;

-- D2: un diferido sin plazo se rechaza
do $$ begin
  insert into gastos (monto, descripcion, cuenta_id, metodo_pago) values (100, 'Sin plazo', '91000000-0000-4000-8000-000000000004', 'diferido');
  insert into resultados values ('D2 un diferido sin meses se rechaza', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('D2 un diferido sin meses se rechaza', true, sqlerrm);
end $$;

-- D3: cuota hacia arriba y fecha anclada al día de la compra
insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido, fecha)
  values ('92000000-0000-4000-8000-000000000003', 100, 'Audífonos', '91000000-0000-4000-8000-000000000004', 'diferido', 3, '2026-01-31');
do $$ declare d deudas; p1 date; p2 date; begin
  select * into d from deudas where gasto_id = '92000000-0000-4000-8000-000000000003';
  p1 := d.proximo_pago;
  d := registrar_abono_deuda(d.id, d.cuota_mensual, '91000000-0000-4000-8000-000000000003');
  p2 := d.proximo_pago;
  d := registrar_abono_deuda(d.id, d.cuota_mensual, '91000000-0000-4000-8000-000000000003');
  d := registrar_abono_deuda(d.id, d.cuota_mensual, '91000000-0000-4000-8000-000000000003');
  insert into resultados values ('D3 primera cuota 31-ene, luego 28-feb y la deuda cierra en 0',
    d.cuota_mensual = 33.34 and p1 = '2026-01-31' and p2 = '2026-02-28' and d.saldo_pendiente = 0,
    format('cuota %s, primer pago %s, segundo %s, saldo final %s', d.cuota_mensual, p1, p2, d.saldo_pendiente));
end $$;

-- H1: no se puede borrar un diferido con abonos (ni se infla el cupo)
insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
  values ('92000000-0000-4000-8000-000000000004', 1200, 'Laptop', '91000000-0000-4000-8000-000000000004', 'diferido', 12);
select registrar_abono_deuda((select id from deudas where gasto_id = '92000000-0000-4000-8000-000000000004'), 100, '91000000-0000-4000-8000-000000000003') is not null;
do $$ declare t numeric; n int; begin
  begin
    delete from gastos where id = '92000000-0000-4000-8000-000000000004';
    insert into resultados values ('H1 no se borra un diferido con abonos', false, 'se permitió');
  exception when invalid_parameter_value then
    select disponible into t from cuentas where id = '91000000-0000-4000-8000-000000000004';
    select count(*) into n from abonos_deuda where deuda_id = (select id from deudas where gasto_id = '92000000-0000-4000-8000-000000000004');
    insert into resultados values ('H1 no se borra un diferido con abonos', n = 1, sqlerrm || format(' | abonos %s, tarjeta %s', n, t));
  end;
end $$;

-- H2: la deuda automática no se borra directamente
do $$ begin
  delete from deudas where gasto_id = '92000000-0000-4000-8000-000000000004';
  insert into resultados values ('H2 la deuda de un diferido no se borra sola', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('H2 la deuda de un diferido no se borra sola', true, sqlerrm);
end $$;

-- H3: una deuda manual con abonos no se borra; sin abonos sí
insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual)
  values ('93000000-0000-4000-8000-000000000001', 'Préstamo', 'prestamo', 500, 500, 50),
         ('93000000-0000-4000-8000-000000000002', 'Préstamo sin abonos', 'prestamo', 100, 100, 10);
select registrar_abono_deuda('93000000-0000-4000-8000-000000000001', 50, '91000000-0000-4000-8000-000000000003') is not null;
do $$ declare n int; begin
  begin
    delete from deudas where id = '93000000-0000-4000-8000-000000000001';
    insert into resultados values ('H3 una deuda con abonos no se borra', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('H3 una deuda con abonos no se borra', true, sqlerrm);
  end;
  delete from deudas where id = '93000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  insert into resultados values ('H4 una deuda sin abonos sí se borra', n = 1, n || ' borrada(s)');
end $$;

-- H5: borrar un diferido SIN abonos devuelve todo el cupo
insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
  values ('92000000-0000-4000-8000-000000000005', 400, 'Silla', '91000000-0000-4000-8000-000000000004', 'diferido', 4);
do $$ declare antes numeric; despues numeric; begin
  select disponible into antes from cuentas where id = '91000000-0000-4000-8000-000000000004';
  delete from gastos where id = '92000000-0000-4000-8000-000000000005';
  select disponible into despues from cuentas where id = '91000000-0000-4000-8000-000000000004';
  insert into resultados values ('H5 borrar un diferido sin abonos devuelve su monto', despues = antes + 400, format('%s → %s', antes, despues));
end $$;

-- A1: abono con más de 2 decimales
do $$ begin
  perform registrar_abono_deuda('93000000-0000-4000-8000-000000000001', 0.004, null);
  insert into resultados values ('A1 un abono de 0.004 se rechaza con mensaje claro', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('A1 un abono de 0.004 se rechaza con mensaje claro', true, sqlerrm);
end $$;

-- N1: un aviso confirmado no vuelve a pendiente
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha)
  values ('94000000-0000-4000-8000-000000000001', 'msg-int-1', 'ingreso', 10, 'Transferencia', '2026-10-15');
select confirmar_transaccion_detectada('94000000-0000-4000-8000-000000000001', 10, 'Transferencia', null, null) is not null;
do $$ begin
  update transacciones_detectadas set estado = 'pendiente' where id = '94000000-0000-4000-8000-000000000001';
  insert into resultados values ('N1 un aviso confirmado no vuelve a pendiente', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('N1 un aviso confirmado no vuelve a pendiente', true, sqlerrm);
end $$;

-- K1: borrar una categoría con gastos los pasa a "Otros" con el nombre como detalle
insert into categorias (id, nombre, color, tipo, usuario_id)
  values ('95000000-0000-4000-8000-000000000001', 'Mascotas', '#aa5500', 'gasto', 'a0000000-0000-4000-8000-000000000001');
insert into gastos (id, monto, descripcion, categoria_id) values ('92000000-0000-4000-8000-000000000006', 15, 'Comida del perro', '95000000-0000-4000-8000-000000000001');
do $$ declare g gastos; otros text; begin
  delete from categorias where id = '95000000-0000-4000-8000-000000000001';
  select * into g from gastos where id = '92000000-0000-4000-8000-000000000006';
  select nombre into otros from categorias where id = g.categoria_id;
  insert into resultados values ('K1 borrar una categoría con gastos los pasa a Otros', otros = 'Otros' and g.categoria_detalle = 'Mascotas',
    format('categoría %s, detalle %s', otros, g.categoria_detalle));
exception when foreign_key_violation then
  insert into resultados values ('K1 borrar una categoría con gastos los pasa a Otros', false, sqlerrm);
end $$;
commit;

-- U1: borrar la cuenta completa de un usuario con deudas y abonos sigue funcionando
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, disponible) values ('96000000-0000-4000-8000-000000000001', 'Ahorro C', 'ahorro', 100);
insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual) values ('96000000-0000-4000-8000-000000000002', 'Deuda C', 'prestamo', 50, 50, 10);
select registrar_abono_deuda('96000000-0000-4000-8000-000000000002', 10, '96000000-0000-4000-8000-000000000001') is not null;
commit;
do $$ declare quedan int; begin
  delete from auth.users where id = 'c0000000-0000-4000-8000-000000000003';
  select (select count(*) from deudas where usuario_id = 'c0000000-0000-4000-8000-000000000003')
       + (select count(*) from abonos_deuda where usuario_id = 'c0000000-0000-4000-8000-000000000003') into quedan;
  insert into resultados values ('U1 borrar la cuenta de un usuario con abonos sigue funcionando', quedan = 0, quedan || ' filas restantes');
exception when others then
  insert into resultados values ('U1 borrar la cuenta de un usuario con abonos sigue funcionando', false, sqlerrm);
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
