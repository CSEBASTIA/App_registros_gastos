-- Pruebas de la migración 20261014130000_saldos_confiables.
-- Base DESECHABLE, usuario A simulado con su JWT (igual que PostgREST).

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local'),
  ('b0000000-0000-4000-8000-000000000002', 'b@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible) values
  ('e1000000-0000-4000-8000-000000000001', 'Ahorro E1', 'ahorro', 1000),
  ('e1000000-0000-4000-8000-000000000002', 'Débito E2', 'debito', 500);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values
  ('e1000000-0000-4000-8000-000000000003', 'Visa E3', 'credito', 1000, 1000);

-- Ingresos ---------------------------------------------------------------
insert into ingresos (id, monto, descripcion, cuenta_id)
  values ('e5000000-0000-4000-8000-000000000001', 200, 'Sueldo', 'e1000000-0000-4000-8000-000000000001');
update ingresos set monto = 250 where id = 'e5000000-0000-4000-8000-000000000001';
do $$ declare e1 numeric; begin
  select disponible into e1 from cuentas where id = 'e1000000-0000-4000-8000-000000000001';
  insert into resultados values ('I1 editar el monto de un ingreso reajusta la cuenta (1000+250)', e1 = 1250, 'ahorro ' || e1);
end $$;

update ingresos set cuenta_id = 'e1000000-0000-4000-8000-000000000002' where id = 'e5000000-0000-4000-8000-000000000001';
do $$ declare e1 numeric; e2 numeric; begin
  select disponible into e1 from cuentas where id = 'e1000000-0000-4000-8000-000000000001';
  select disponible into e2 from cuentas where id = 'e1000000-0000-4000-8000-000000000002';
  insert into resultados values ('I2 mover un ingreso de cuenta: sale de una, entra en otra',
    e1 = 1000 and e2 = 750, format('ahorro %s, débito %s', e1, e2));
end $$;

update ingresos set cuenta_id = 'e1000000-0000-4000-8000-000000000003' where id = 'e5000000-0000-4000-8000-000000000001';
do $$ declare e2 numeric; e3 numeric; begin
  select disponible into e2 from cuentas where id = 'e1000000-0000-4000-8000-000000000002';
  select disponible into e3 from cuentas where id = 'e1000000-0000-4000-8000-000000000003';
  insert into resultados values ('I3 un ingreso no suma cupo a una tarjeta de crédito',
    e2 = 500 and e3 = 1000, format('débito %s, tarjeta %s', e2, e3));
end $$;

update ingresos set descripcion = 'Sueldo octubre' where id = 'e5000000-0000-4000-8000-000000000001';
do $$ declare total numeric; begin
  select sum(disponible) into total from cuentas where id::text like 'e1000000-%';
  insert into resultados values ('I4 editar solo la descripción no mueve saldos', total = 2500, 'suma ' || total);
end $$;

-- Pagos de tarjeta ---------------------------------------------------------
insert into gastos (id, monto, descripcion, cuenta_id)
  values ('e4000000-0000-4000-8000-000000000001', 300, 'Compra', 'e1000000-0000-4000-8000-000000000003');
insert into pagos_tarjeta (id, cuenta_id, cuenta_origen_id, monto)
  values ('e6000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 200);

do $$ declare n int; e1 numeric; e3 numeric; begin
  delete from pagos_tarjeta where id = 'e6000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  select disponible into e1 from cuentas where id = 'e1000000-0000-4000-8000-000000000001';
  select disponible into e3 from cuentas where id = 'e1000000-0000-4000-8000-000000000003';
  insert into resultados values ('P1 un pago de tarjeta no se puede borrar y los saldos quedan',
    n = 0 and e1 = 800 and e3 = 900, format('%s filas borradas, ahorro %s, tarjeta %s', n, e1, e3));
end $$;

do $$ declare origen uuid; e3 numeric; begin
  delete from cuentas where id = 'e1000000-0000-4000-8000-000000000001';
  select cuenta_origen_id into origen from pagos_tarjeta where id = 'e6000000-0000-4000-8000-000000000001';
  select disponible into e3 from cuentas where id = 'e1000000-0000-4000-8000-000000000003';
  insert into resultados values ('P2 se puede borrar la cuenta de origen de un pago (antes fallaba)',
    origen is null and e3 = 900, format('origen %s, tarjeta %s', coalesce(origen::text, 'null'), e3));
exception when foreign_key_violation then
  insert into resultados values ('P2 se puede borrar la cuenta de origen de un pago (antes fallaba)', false, sqlerrm);
end $$;

do $$ declare n int; begin
  delete from cuentas where id = 'e1000000-0000-4000-8000-000000000003';
  select count(*) into n from pagos_tarjeta where id = 'e6000000-0000-4000-8000-000000000001';
  insert into resultados values ('P3 borrar una tarjeta arrastra sus pagos sin error', n = 0, n || ' pagos restantes');
end $$;

-- Gastos diferidos ----------------------------------------------------------
insert into cuentas (id, nombre, tipo, cupo_total, disponible)
  values ('e1000000-0000-4000-8000-000000000004', 'Diners E4', 'credito', 1000, 1000);
insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
  values ('e4000000-0000-4000-8000-000000000002', 600, 'Laptop', 'e1000000-0000-4000-8000-000000000004', 'diferido', 6);

do $$ begin
  update gastos set monto = 500 where id = 'e4000000-0000-4000-8000-000000000002';
  insert into resultados values ('D1 no se edita el monto de un diferido', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('D1 no se edita el monto de un diferido', true, sqlerrm);
end $$;

do $$ declare d text; begin
  update gastos set descripcion = 'Laptop nueva', fecha = '2026-10-10' where id = 'e4000000-0000-4000-8000-000000000002';
  select descripcion into d from gastos where id = 'e4000000-0000-4000-8000-000000000002';
  insert into resultados values ('D2 sí se edita la descripción y la fecha de un diferido', d = 'Laptop nueva', d);
end $$;

do $$ begin
  update gastos set cuenta_id = 'e1000000-0000-4000-8000-000000000002' where id = 'e4000000-0000-4000-8000-000000000002';
  insert into resultados values ('D3 no se cambia la cuenta de un diferido', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('D3 no se cambia la cuenta de un diferido', true, sqlerrm);
end $$;

insert into gastos (id, monto, descripcion, cuenta_id)
  values ('e4000000-0000-4000-8000-000000000003', 100, 'Almuerzo', 'e1000000-0000-4000-8000-000000000002');
do $$ begin
  update gastos set metodo_pago = 'diferido', meses_diferido = 3 where id = 'e4000000-0000-4000-8000-000000000003';
  insert into resultados values ('D4 un gasto no se convierte en diferido al editarlo', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('D4 un gasto no se convierte en diferido al editarlo', true, sqlerrm);
end $$;

update gastos set monto = 150 where id = 'e4000000-0000-4000-8000-000000000003';
do $$ declare e2 numeric; begin
  select disponible into e2 from cuentas where id = 'e1000000-0000-4000-8000-000000000002';
  insert into resultados values ('D5 editar un gasto normal sigue reajustando (500-150)', e2 = 350, 'débito ' || e2);
end $$;

do $$ declare g uuid; d int; begin
  delete from cuentas where id = 'e1000000-0000-4000-8000-000000000004';
  select cuenta_id into g from gastos where id = 'e4000000-0000-4000-8000-000000000002';
  select count(*) into d from deudas where gasto_id = 'e4000000-0000-4000-8000-000000000002';
  insert into resultados values ('D6 se puede borrar la tarjeta de un diferido; gasto y deuda quedan',
    g is null and d = 1, format('cuenta del gasto %s, deudas %s', coalesce(g::text, 'null'), d));
exception when invalid_parameter_value then
  insert into resultados values ('D6 se puede borrar la tarjeta de un diferido; gasto y deuda quedan', false, sqlerrm);
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
