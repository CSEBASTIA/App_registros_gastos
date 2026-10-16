-- Pruebas de la migración 20261016170000_recordatorios_diferidos (fase C).
-- Base DESECHABLE, usuarios L y M propios de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-00000000000c', 'l-recordatorios@prueba.local'),
  ('7f000000-0000-4000-8000-00000000000d', 'm-recordatorios@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, banco, cupo_total, disponible)
  values ('7f600000-0000-4000-8000-000000000001', 'Visa L', 'credito', 'produbanco', 5000, 5000);

-- R01: el ejemplo del plan: $130 a 3 meses el día 10
do $$ declare cat uuid; d uuid; fechas date[]; montos numeric[]; titulos text[]; n int; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido)
    values ('7f610000-0000-4000-8000-000000000001', 130, 'Televisor', cat, '2026-10-10', '7f600000-0000-4000-8000-000000000001', 'diferido', 3);
  select id into d from deudas where gasto_id = '7f610000-0000-4000-8000-000000000001';
  select array_agg(fecha order by fecha), array_agg(monto order by fecha), array_agg(titulo order by fecha),
         count(*) filter (where automatico and not completado and tipo = 'tarjeta' and not recurrente)
    into fechas, montos, titulos, n
  from recordatorios where deuda_id = d;
  insert into resultados values ('R01 $130 a 3 meses el 10: tres recordatorios el 10 de cada mes, con el monto de cada cuota',
    fechas = array['2026-10-10', '2026-11-10', '2026-12-10']::date[]
      and montos = array[43.34, 43.34, 43.32]::numeric[]
      and titulos[1] = 'Cuota 1 de 3 · Televisor' and titulos[3] = 'Cuota 3 de 3 · Televisor' and n = 3,
    format('%s | %s | %s', fechas, montos, titulos[1]));
end $$;

-- R02: una compra del 31 cae el último día en los meses cortos
do $$ declare cat uuid; fechas date[]; montos numeric[]; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido)
    values ('7f610000-0000-4000-8000-000000000002', 90, 'Celular', cat, '2027-01-31', '7f600000-0000-4000-8000-000000000001', 'diferido', 3);
  select array_agg(r.fecha order by r.fecha), array_agg(r.monto order by r.fecha) into fechas, montos
  from recordatorios r join deudas d on d.id = r.deuda_id
  where d.gasto_id = '7f610000-0000-4000-8000-000000000002';
  insert into resultados values ('R02 una compra del 31: 31/01, 28/02 y 31/03',
    fechas = array['2027-01-31', '2027-02-28', '2027-03-31']::date[] and montos = array[30, 30, 30]::numeric[],
    format('%s | %s', fechas, montos));
end $$;

-- R03: con interés, cada recordatorio lleva la cuota fija (capital + interés)
do $$ declare cat uuid; d deudas; n int; distintos int; ultima date; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido, tasa_interes)
    values ('7f610000-0000-4000-8000-000000000003', 1200, 'Laptop', cat, '2026-10-05', '7f600000-0000-4000-8000-000000000001', 'diferido', 12, 16);
  select * into d from deudas where gasto_id = '7f610000-0000-4000-8000-000000000003';
  select count(*), count(*) filter (where monto <> d.cuota_mensual), max(fecha) into n, distintos, ultima
  from recordatorios where deuda_id = d.id;
  insert into resultados values ('R03 con interés: 12 recordatorios con la cuota fija, el último en septiembre',
    n = 12 and distintos = 0 and ultima = '2027-09-05', format('%s recordatorios de %s, último %s', n, d.cuota_mensual, ultima));
end $$;

-- R04-R06: los abonos cierran las cuotas pagadas
do $$ declare d deudas; hechos boolean[]; begin
  select * into d from deudas where gasto_id = '7f610000-0000-4000-8000-000000000001';
  perform registrar_abono_deuda(d.id, 43.34);
  select * into d from deudas where id = d.id;
  select array_agg(completado order by fecha) into hechos from recordatorios where deuda_id = d.id;
  insert into resultados values ('R04 pagar la primera cuota cierra solo su recordatorio',
    hechos = array[true, false, false] and d.proximo_pago = '2026-11-10', format('%s, próximo %s', hechos, d.proximo_pago));

  perform registrar_abono_deuda(d.id, 10);
  select array_agg(completado order by fecha) into hechos from recordatorios where deuda_id = d.id;
  insert into resultados values ('R05 un abono parcial no cierra la cuota siguiente',
    hechos = array[true, false, false], hechos::text);

  perform registrar_abono_deuda(d.id, 999);
  select * into d from deudas where id = d.id;
  select array_agg(completado order by fecha) into hechos from recordatorios where deuda_id = d.id;
  insert into resultados values ('R06 saldar la deuda cierra todos sus recordatorios',
    hechos = array[true, true, true] and d.saldo_pendiente = 0, format('%s, saldo %s', hechos, d.saldo_pendiente));
end $$;

-- R07: el usuario puede marcar uno como hecho, pero no cambiar si es automático
do $$ declare r recordatorios; begin
  update recordatorios set completado = true
  where id = (select r2.id from recordatorios r2 join deudas d on d.id = r2.deuda_id
              where d.gasto_id = '7f610000-0000-4000-8000-000000000003' order by r2.fecha limit 1)
  returning * into r;
  begin
    update recordatorios set automatico = false where id = r.id;
    insert into resultados values ('R07 marcar como hecho sí; volverlo manual no', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('R07 marcar como hecho sí; volverlo manual no', r.completado, sqlerrm);
  end;
  begin
    insert into recordatorios (titulo, tipo, fecha, automatico) values ('Falso automático', 'otro', '2026-11-01', true);
    insert into resultados values ('R08 un automático sin deuda se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('R08 un automático sin deuda se rechaza', true, sqlerrm);
  end;
end $$;

-- R09: borrar el diferido borra sus recordatorios automáticos; los manuales se quedan, sin deuda
do $$ declare cat uuid; d uuid; manual uuid; quedan int; m recordatorios; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido)
    values ('7f610000-0000-4000-8000-000000000004', 200, 'Licuadora', cat, '2026-10-12', '7f600000-0000-4000-8000-000000000001', 'diferido', 2);
  select id into d from deudas where gasto_id = '7f610000-0000-4000-8000-000000000004';
  insert into recordatorios (titulo, tipo, fecha, deuda_id) values ('Llamar al banco por la licuadora', 'otro', '2026-10-20', d)
    returning id into manual;
  delete from gastos where id = '7f610000-0000-4000-8000-000000000004';
  select count(*) into quedan from recordatorios where automatico and titulo like '% · Licuadora';
  select * into m from recordatorios where id = manual;
  insert into resultados values ('R09 borrar el diferido borra sus recordatorios; el manual se queda sin deuda',
    quedan = 0 and m.id is not null and m.deuda_id is null and not exists (select 1 from deudas where id = d),
    format('automáticos que quedan %s, manual %s', quedan, coalesce(m.deuda_id::text, 'sin deuda')));
end $$;

-- R10: un diferido con abonos no se puede borrar, y sus recordatorios siguen
do $$ declare n int; begin
  begin
    delete from gastos where id = '7f610000-0000-4000-8000-000000000001';
    insert into resultados values ('R10 un diferido con abonos no se borra y conserva sus recordatorios', false, 'se permitió');
  exception when invalid_parameter_value then
    select count(*) into n from recordatorios r join deudas d on d.id = r.deuda_id
    where d.gasto_id = '7f610000-0000-4000-8000-000000000001';
    insert into resultados values ('R10 un diferido con abonos no se borra y conserva sus recordatorios', n = 3, n || ' recordatorios; ' || sqlerrm);
  end;
end $$;

-- R11: un gasto normal o una deuda manual no crean recordatorios automáticos
do $$ declare cat uuid; antes int; despues int; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select count(*) into antes from recordatorios where automatico;
  insert into gastos (monto, descripcion, categoria_id, fecha, metodo_pago) values (12, 'Almuerzo', cat, '2026-10-16', 'efectivo');
  insert into gastos (monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago)
    values (40, 'Zapatos', cat, '2026-10-16', '7f600000-0000-4000-8000-000000000001', 'credito');
  insert into deudas (nombre, tipo, monto_total, saldo_pendiente, cuota_mensual, proximo_pago)
    values ('Préstamo de mi tío', 'prestamo', 300, 300, 100, '2026-11-01');
  select count(*) into despues from recordatorios where automatico;
  insert into resultados values ('R11 un gasto normal o una deuda manual no crean recordatorios', despues = antes, format('%s → %s', antes, despues));
end $$;

-- R12: tope de 60 recordatorios aunque la API reciba un plazo enorme
do $$ declare cat uuid; n int; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido)
    values ('7f610000-0000-4000-8000-000000000005', 100, 'Plazo enorme', cat, '2026-10-01', '7f600000-0000-4000-8000-000000000001', 'diferido', 100);
  select count(*) into n from recordatorios r join deudas d on d.id = r.deuda_id
  where d.gasto_id = '7f610000-0000-4000-8000-000000000005';
  insert into resultados values ('R12 un plazo de 100 meses crea como máximo 60 recordatorios', n = 60, n || ' recordatorios');
end $$;

-- R13: la función de mantenimiento no se puede llamar desde la app
do $$ begin
  perform crear_recordatorios_faltantes_de_diferidos();
  insert into resultados values ('R13 la app no puede correr la función de mantenimiento', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('R13 la app no puede correr la función de mantenimiento', true, sqlerrm);
end $$;

-- Diferido para R15: se simula uno de antes de la migración (primera cuota pagada).
do $$ declare cat uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, cuenta_id, metodo_pago, meses_diferido)
    values ('7f610000-0000-4000-8000-000000000006', 300, 'Colchón', cat, '2026-08-05', '7f600000-0000-4000-8000-000000000001', 'diferido', 3);
  perform registrar_abono_deuda((select id from deudas where gasto_id = '7f610000-0000-4000-8000-000000000006'), 100);
end $$;
commit;

-- R14: otro usuario no ve ni toca los recordatorios de L
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
do $$ declare vistos int; cambiados int; begin
  select count(*) into vistos from recordatorios;
  update recordatorios set completado = true where usuario_id = '7f000000-0000-4000-8000-00000000000c';
  get diagnostics cambiados = row_count;
  insert into resultados values ('R14 otro usuario no ve ni cambia los recordatorios de L', vistos = 0 and cambiados = 0,
    format('ve %s, cambia %s', vistos, cambiados));
end $$;
commit;

-- R15: los diferidos de antes reciben sus recordatorios, con las cuotas pagadas ya hechas
do $$ declare d uuid; creados int; otra_vez int; hechos boolean[]; begin
  select id into d from deudas where gasto_id = '7f610000-0000-4000-8000-000000000006';
  delete from recordatorios where deuda_id = d and automatico;
  creados := crear_recordatorios_faltantes_de_diferidos();
  otra_vez := crear_recordatorios_faltantes_de_diferidos();
  select array_agg(completado order by fecha) into hechos from recordatorios where deuda_id = d and automatico;
  insert into resultados values ('R15 un diferido de antes recibe sus recordatorios, sin duplicar al repetir',
    creados = 3 and otra_vez = 0 and hechos = array[true, false, false],
    format('creados %s, al repetir %s, hechos %s', creados, otra_vez, hechos));
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
