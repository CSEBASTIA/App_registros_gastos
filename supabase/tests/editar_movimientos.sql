-- Pruebas de la edición de gastos e ingresos desde el teléfono (migración
-- 20261016230000_diferido_fecha_fija). Base DESECHABLE, usuario Q propio.
-- Usa los mismos UPDATE que envían actualizarGasto y actualizarIngreso.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values ('7f000000-0000-4000-8000-000000000010', 'q-editar@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000010","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible) values
  ('7d400000-0000-4000-8000-000000000001', 'Débito Q', 'debito', 100),
  ('7d400000-0000-4000-8000-000000000002', 'Efectivo Q', 'efectivo', 20);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values
  ('7d400000-0000-4000-8000-000000000003', 'Visa Q', 'credito', 300, 300);

-- E01: corregir un almuerzo de $5,20 a $5,70 y pasarlo a efectivo mueve los dos saldos
do $$ declare cat uuid; g uuid; deb numeric; efe numeric; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, metodo_pago, fecha)
    values (5.20, 'Almuerzo', cat, '7d400000-0000-4000-8000-000000000001', 'debito', '2026-10-16') returning id into g;
  update gastos set monto = 5.70, cuenta_id = '7d400000-0000-4000-8000-000000000002', fecha = '2026-10-15' where id = g;
  select disponible into deb from cuentas where id = '7d400000-0000-4000-8000-000000000001';
  select disponible into efe from cuentas where id = '7d400000-0000-4000-8000-000000000002';
  insert into resultados values ('E01 editar monto, cuenta y fecha devuelve el saldo a la cuenta vieja y cobra en la nueva',
    deb = 100 and efe = 14.30, format('débito %s, efectivo %s', deb, efe));
end $$;

-- E02-E04: un diferido conserva su deuda: solo cambian descripción y categoría
do $$ declare cat uuid; otra uuid; g uuid; r gastos; n int; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select id into otra from categorias where nombre <> 'Comida' and tipo = 'gasto' and usuario_id is null limit 1;
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, metodo_pago, meses_diferido, fecha)
    values (36, 'Audífonos', cat, '7d400000-0000-4000-8000-000000000003', 'diferido', 3, '2026-10-16') returning id into g;

  update gastos set descripcion = 'Audífonos inalámbricos', categoria_id = otra where id = g returning * into r;
  insert into resultados values ('E02 un diferido sí cambia descripción y categoría',
    r.descripcion = 'Audífonos inalámbricos' and r.categoria_id = otra, r.descripcion);

  begin
    update gastos set fecha = '2026-10-20' where id = g;
    insert into resultados values ('E03 un diferido no cambia de fecha (su deuda y recordatorios dependen de ella)', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('E03 un diferido no cambia de fecha (su deuda y recordatorios dependen de ella)', true, sqlerrm);
  end;

  begin
    update gastos set monto = 40 where id = g;
    insert into resultados values ('E04 un diferido tampoco cambia de monto', false, 'se permitió');
  exception when invalid_parameter_value then
    select count(*) into n from recordatorios r2 join deudas d on d.id = r2.deuda_id
    where d.gasto_id = g and r2.automatico and r2.fecha = any (array['2026-10-16', '2026-11-16', '2026-12-16']::date[]);
    insert into resultados values ('E04 un diferido tampoco cambia de monto, y sus 3 recordatorios siguen en su fecha', n = 3, n || ' recordatorios; ' || sqlerrm);
  end;
end $$;

-- E05: subir un gasto con tarjeta por encima del cupo se rechaza
do $$ declare cat uuid; g uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, metodo_pago, fecha)
    values (10, 'Cena', cat, '7d400000-0000-4000-8000-000000000003', 'credito', '2026-10-16') returning id into g;
  begin
    update gastos set monto = 1000 where id = g;
    insert into resultados values ('E05 editar por encima del cupo de la tarjeta se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('E05 editar por encima del cupo de la tarjeta se rechaza', true, sqlerrm);
  end;
end $$;

-- E06: editar un ingreso (monto, cuenta y fecha) reajusta los saldos
do $$ declare i uuid; deb numeric; efe numeric; begin
  insert into ingresos (monto, descripcion, cuenta_id, fecha)
    values (50, 'Venta', '7d400000-0000-4000-8000-000000000001', '2026-10-16') returning id into i;
  update ingresos set monto = 60, cuenta_id = '7d400000-0000-4000-8000-000000000002', fecha = '2026-10-14' where id = i;
  select disponible into deb from cuentas where id = '7d400000-0000-4000-8000-000000000001';
  select disponible into efe from cuentas where id = '7d400000-0000-4000-8000-000000000002';
  insert into resultados values ('E06 editar un ingreso devuelve el saldo y lo suma en la cuenta nueva',
    deb = 100 and efe = 74.30, format('débito %s, efectivo %s', deb, efe));
end $$;
commit;

-- E07: otro usuario no puede editar los gastos de Q
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
do $$ declare n int; begin
  update gastos set monto = 1 where usuario_id = '7f000000-0000-4000-8000-000000000010';
  get diagnostics n = row_count;
  insert into resultados values ('E07 otro usuario no edita los gastos de Q', n = 0, n || ' filas');
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
