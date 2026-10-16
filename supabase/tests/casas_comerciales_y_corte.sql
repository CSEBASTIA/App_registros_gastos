-- Pruebas de la migración 20261016160000_casas_comerciales_y_corte.
-- Base DESECHABLE, usuario K propio de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values ('7f000000-0000-4000-8000-00000000000b', 'k-casas@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

-- Y01: un crédito directo de Comandato se guarda como tarjeta, con corte y pago
do $$ declare c cuentas; begin
  insert into cuentas (id, nombre, tipo, banco, cupo_total, disponible, dia_corte, dia_pago)
    values ('7f500000-0000-4000-8000-000000000001', 'Crédito Comandato', 'credito', 'comandato', 1500, 1500, 15, 30)
    returning * into c;
  insert into resultados values ('Y01 un crédito directo de Comandato se guarda con su corte y pago',
    c.banco = 'comandato' and c.dia_corte = 15 and c.dia_pago = 30, format('%s, corte %s, pago %s', c.banco, c.dia_corte, c.dia_pago));
end $$;

-- Y02: todas las casas comerciales se aceptan como crédito
do $$ declare casa text; n int := 0; begin
  foreach casa in array array['artefacta', 'marcimex', 'la_ganga', 'japon', 'de_prati', 'creditos_economicos', 'otra_casa_comercial'] loop
    insert into cuentas (nombre, tipo, banco, cupo_total, disponible) values ('Crédito ' || casa, 'credito', casa, 500, 500);
    n := n + 1;
  end loop;
  insert into resultados values ('Y02 las 8 casas comerciales se aceptan como crédito', n = 7, (n + 1) || ' casas');
end $$;

-- Y03-Y06: reglas
do $$ begin
  begin
    insert into cuentas (nombre, tipo, banco, disponible) values ('Ahorro Comandato', 'ahorro', 'comandato', 10);
    insert into resultados values ('Y03 una casa comercial no puede ser cuenta de ahorros', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('Y03 una casa comercial no puede ser cuenta de ahorros', true, sqlerrm);
  end;
  begin
    insert into cuentas (nombre, tipo, banco, disponible, dia_corte) values ('Ahorro con corte', 'ahorro', 'pichincha', 10, 15);
    insert into resultados values ('Y04 la fecha de corte solo aplica a crédito', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('Y04 la fecha de corte solo aplica a crédito', true, sqlerrm);
  end;
  begin
    update cuentas set dia_corte = 32 where id = '7f500000-0000-4000-8000-000000000001';
    insert into resultados values ('Y05 el día de corte va de 1 a 31', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('Y05 el día de corte va de 1 a 31', true, sqlerrm);
  end;
  begin
    insert into cuentas (nombre, tipo, banco, cupo_total, disponible) values ('Tienda inventada', 'credito', 'tienda_x', 10, 10);
    insert into resultados values ('Y06 una entidad desconocida se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('Y06 una entidad desconocida se rechaza', true, sqlerrm);
  end;
end $$;

-- Y07: cambiar o quitar las fechas de una tarjeta existente
do $$ declare c cuentas; begin
  update cuentas set dia_corte = 5, dia_pago = null where id = '7f500000-0000-4000-8000-000000000001' returning * into c;
  insert into resultados values ('Y07 se pueden cambiar y quitar las fechas', c.dia_corte = 5 and c.dia_pago is null, format('corte %s', c.dia_corte));
end $$;

-- Y08: comprar a cuotas en la casa comercial usa el diferido de siempre
do $$ declare cat uuid; g uuid; d deudas; disp numeric; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido)
    values (600, 'Refrigeradora', cat, '2026-10-10', '7f500000-0000-4000-8000-000000000001', 'diferido', 12)
    returning id into g;
  select * into d from deudas where gasto_id = g;
  select disponible into disp from cuentas where id = '7f500000-0000-4000-8000-000000000001';
  insert into resultados values ('Y08 comprar a 12 cuotas en Comandato crea la deuda y reserva el cupo',
    d.id is not null and d.saldo_pendiente = 600 and disp = 900, format('deuda %s, cupo %s', d.saldo_pendiente, disp));
end $$;

-- Y09: las cuentas de bancos de antes siguen funcionando sin fechas
do $$ declare n int; begin
  insert into cuentas (nombre, tipo, banco, disponible) values ('Ahorro Pichincha', 'ahorro', 'pichincha', 100);
  insert into cuentas (nombre, tipo, banco, cupo_total, disponible) values ('Visa sin corte', 'credito', 'produbanco', 100, 100);
  select count(*) into n from cuentas where nombre in ('Ahorro Pichincha', 'Visa sin corte') and dia_corte is null;
  insert into resultados values ('Y09 las cuentas de banco sin fechas siguen funcionando', n = 2, n || ' cuentas');
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
