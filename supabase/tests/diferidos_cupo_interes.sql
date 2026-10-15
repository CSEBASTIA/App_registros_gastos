\set ON_ERROR_STOP 1
create temp table resultados_diferido (prueba text, ok boolean, detalle text);
grant all on resultados_diferido to authenticated;
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local') on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values
  ('a7100000-0000-4000-8000-000000000001', 'Tarjeta 130', 'credito', 130, 130);
insert into cuentas (id, nombre, tipo, disponible) values
  ('a7100000-0000-4000-8000-000000000002', 'Ahorro', 'ahorro', 200);

do $$ begin
  insert into gastos (monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
    values (131, 'Excede', 'a7100000-0000-4000-8000-000000000001', 'diferido', 3);
  insert into resultados_diferido values ('Cupo insuficiente bloquea la compra', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados_diferido values ('Cupo insuficiente bloquea la compra', true, sqlerrm);
end $$;

insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido, tasa_interes, fecha)
  values ('a7200000-0000-4000-8000-000000000001', 100, 'Compra 3 cuotas',
    'a7100000-0000-4000-8000-000000000001', 'diferido', 3, 12, '2026-10-15');
do $$ begin
  update gastos set tasa_interes = 20 where id = 'a7200000-0000-4000-8000-000000000001';
  insert into resultados_diferido values ('Tasa de diferido registrado no se altera', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados_diferido values ('Tasa de diferido registrado no se altera', true, sqlerrm);
end $$;
do $$ declare d deudas; disponible numeric; begin
  select * into d from deudas where gasto_id = 'a7200000-0000-4000-8000-000000000001';
  select c.disponible into disponible from cuentas c where c.id = 'a7100000-0000-4000-8000-000000000001';
  insert into resultados_diferido values ('Capital completo reservado, primera cuota pendiente hoy',
    disponible = 30 and d.proximo_pago = '2026-10-15' and d.saldo_pendiente = 100
      and d.interes_cuota_pendiente = 1 and d.cuota_mensual = 34.01,
    format('cupo %s, fecha %s, cuota %s, interés %s', disponible, d.proximo_pago, d.cuota_mensual, d.interes_cuota_pendiente));
end $$;

do $$ begin
  insert into gastos (monto, descripcion, cuenta_id)
    values (30.01, 'Otro consumo', 'a7100000-0000-4000-8000-000000000001');
  insert into resultados_diferido values ('Cupo posterior bloqueado', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados_diferido values ('Cupo posterior bloqueado', true, sqlerrm);
end $$;

select registrar_abono_deuda((select id from deudas where gasto_id = 'a7200000-0000-4000-8000-000000000001'),
  34.01, 'a7100000-0000-4000-8000-000000000002') is not null;
do $$ declare d deudas; tarjeta numeric; ahorro numeric; begin
  select * into d from deudas where gasto_id = 'a7200000-0000-4000-8000-000000000001';
  select disponible into tarjeta from cuentas where id = 'a7100000-0000-4000-8000-000000000001';
  select disponible into ahorro from cuentas where id = 'a7100000-0000-4000-8000-000000000002';
  insert into resultados_diferido values ('Abono libera solo capital, cobra interés y avanza fecha',
    tarjeta = 63.01 and ahorro = 165.99 and d.saldo_pendiente = 66.99
      and d.proximo_pago = '2026-11-15',
    format('tarjeta %s, ahorro %s, capital %s, fecha %s', tarjeta, ahorro, d.saldo_pendiente, d.proximo_pago));
end $$;

select prueba, case when ok then 'PASS' else 'FAIL' end as resultado, detalle from resultados_diferido;
rollback;
