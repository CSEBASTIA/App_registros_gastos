-- Pruebas de la migración 20261016120000_billeteras_y_ubicacion.
-- Base DESECHABLE, usuarios A, B y C simulados con su JWT.
-- Puntos en Quito: P1 (-0.1807, -78.4678); P1 + ~30 m; P2 a ~1 km de P1.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local'),
  ('b0000000-0000-4000-8000-000000000002', 'b@prueba.local'),
  ('7e000000-0000-4000-8000-000000000003', 'c-ubicacion@prueba.local')
on conflict (id) do nothing;

-- B guarda un gasto con ubicación: tiene su propio lugar.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into gastos (id, monto, descripcion, categoria_id, fecha, latitud, longitud)
  values ('7b000000-0000-4000-8000-0000000000b1', 5, 'Café de B', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', -0.2000, -78.5000);
commit;

-- C también, para probar que eliminar la cuenta borra sus lugares.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7e000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
insert into gastos (monto, descripcion, categoria_id, fecha, latitud, longitud)
  values (3, 'Kiosko de C', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', -0.2100, -78.5100);
commit;

-- El id del lugar de B, leído como administrador para el intento de U11.
create temp table lugar_de_b as select lugar_id from gastos where id = '7b000000-0000-4000-8000-0000000000b1';
grant select on lugar_de_b to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible, cupo_total) values
  ('7a000000-0000-4000-8000-000000000001', 'Visa U', 'credito', 1000, 1000);
insert into cuentas (id, nombre, tipo, disponible) values
  ('7a000000-0000-4000-8000-000000000002', 'Ahorro U', 'ahorro', 500);

-- U1: un gasto con ubicación crea un lugar con el nombre del gasto
do $$ declare cat uuid; g gastos; l lugares; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, latitud, longitud, precision_m)
    values ('7b000000-0000-4000-8000-000000000001', 10, 'Supermaxi El Bosque', cat, '2026-10-16', -0.1807, -78.4678, 15)
    returning * into g;
  select * into l from lugares where id = g.lugar_id;
  insert into resultados values ('U01 un gasto con ubicación crea su lugar con el nombre del gasto',
    l.id is not null and l.nombre = 'Supermaxi El Bosque' and l.usuario_id = 'a0000000-0000-4000-8000-000000000001' and l.radio_m = 80,
    format('lugar %s, nombre %s', coalesce(l.id::text, 'null'), coalesce(l.nombre, 'null')));
end $$;

-- U2: un gasto a ~30 m usa el mismo lugar
do $$ declare cat uuid; g1 uuid; g2 uuid; n int; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select lugar_id into g1 from gastos where id = '7b000000-0000-4000-8000-000000000001';
  insert into gastos (id, monto, descripcion, categoria_id, fecha, latitud, longitud)
    values ('7b000000-0000-4000-8000-000000000002', 20, 'Supermaxi otra vez', cat, '2026-10-16', -0.18097, -78.4678)
    returning lugar_id into g2;
  select count(*) into n from lugares;
  insert into resultados values ('U02 un gasto a unos 30 m reutiliza el mismo lugar', g1 = g2 and n = 1,
    format('mismo lugar %s, lugares de A %s', g1 = g2, n));
end $$;

-- U3: un gasto a ~1 km crea otro lugar
do $$ declare cat uuid; g1 uuid; g3 uuid; n int; d double precision; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select lugar_id into g1 from gastos where id = '7b000000-0000-4000-8000-000000000001';
  insert into gastos (id, monto, descripcion, categoria_id, fecha, latitud, longitud)
    values ('7b000000-0000-4000-8000-000000000003', 7, 'Farmacia', cat, '2026-10-16', -0.1717, -78.4678)
    returning lugar_id into g3;
  select count(*) into n from lugares;
  d := distancia_m(-0.1807, -78.4678, -0.1717, -78.4678);
  insert into resultados values ('U03 un gasto a 1 km crea otro lugar (distancia ≈ 1001 m)',
    g3 is not null and g3 <> g1 and n = 2 and round(d) between 995 and 1005,
    format('lugares %s, distancia %s m', n, round(d)));
end $$;

-- U4: GPS impreciso (500 m) o sin ubicación: sin lugar y sin crear ninguno
do $$ declare cat uuid; l1 uuid; l2 uuid; n int; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (monto, descripcion, categoria_id, fecha, latitud, longitud, precision_m)
    values (4, 'Impreciso', cat, '2026-10-16', -0.1500, -78.4000, 500) returning lugar_id into l1;
  insert into gastos (monto, descripcion, categoria_id, fecha)
    values (4, 'Sin ubicación', cat, '2026-10-16') returning lugar_id into l2;
  select count(*) into n from lugares;
  insert into resultados values ('U04 con GPS impreciso o sin ubicación no se asigna ni se crea lugar',
    l1 is null and l2 is null and n = 2, format('lugares %s', n));
end $$;

-- U5: la ubicación se redondea a 4 decimales
do $$ declare cat uuid; g gastos; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (monto, descripcion, categoria_id, fecha, latitud, longitud, precision_m)
    values (1, 'Redondeo', cat, '2026-10-16', -0.18076, -78.467849, 900) returning * into g;
  insert into resultados values ('U05 la ubicación se guarda redondeada a 4 decimales (~11 m)',
    g.latitud = -0.1808 and g.longitud = -78.4678, format('%s, %s', g.latitud, g.longitud));
end $$;

-- U6: latitud sin longitud, o fuera de rango, se rechaza
do $$ declare cat uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  begin
    insert into gastos (monto, descripcion, categoria_id, fecha, latitud) values (1, 'x', cat, '2026-10-16', -0.18);
    insert into resultados values ('U06 latitud sin longitud se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('U06 latitud sin longitud se rechaza', true, sqlerrm);
  end;
  begin
    insert into gastos (monto, descripcion, categoria_id, fecha, latitud, longitud) values (1, 'x', cat, '2026-10-16', 95, -78);
    insert into resultados values ('U07 latitud fuera de rango se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('U07 latitud fuera de rango se rechaza', true, sqlerrm);
  end;
end $$;

-- U8: billetera con efectivo no; con crédito o sin método, sí
do $$ declare cat uuid; ok_credito boolean := false; ok_sin_metodo boolean := false; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  begin
    insert into gastos (monto, descripcion, categoria_id, fecha, metodo_pago, billetera) values (1, 'x', cat, '2026-10-16', 'efectivo', 'apple_pay');
    insert into resultados values ('U08 Apple Pay con efectivo se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('U08 Apple Pay con efectivo se rechaza', true, sqlerrm);
  end;
  insert into gastos (monto, descripcion, categoria_id, fecha, metodo_pago, billetera, cuenta_id)
    values (2, 'Con tarjeta', cat, '2026-10-16', 'credito', 'apple_pay', '7a000000-0000-4000-8000-000000000001');
  ok_credito := true;
  insert into gastos (monto, descripcion, categoria_id, fecha, billetera) values (2, 'Sin método', cat, '2026-10-16', 'google_wallet');
  ok_sin_metodo := true;
  begin
    insert into gastos (monto, descripcion, categoria_id, fecha, billetera) values (1, 'x', cat, '2026-10-16', 'paypal');
    insert into resultados values ('U09 una billetera desconocida se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('U09 una billetera desconocida se rechaza', true, sqlerrm);
  end;
  insert into resultados values ('U10 Apple Pay con crédito y Google Wallet sin método se aceptan', ok_credito and ok_sin_metodo, 'ok');
end $$;

-- U11: no se puede usar el lugar de otra persona
do $$ declare cat uuid; ajeno uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select lugar_id into ajeno from lugar_de_b;
  if ajeno is null then
    insert into resultados values ('U11 no se puede asignar el lugar de otra persona', false, 'B no tiene lugar');
    return;
  end if;
  insert into gastos (monto, descripcion, categoria_id, fecha, lugar_id) values (1, 'x', cat, '2026-10-16', ajeno);
  insert into resultados values ('U11 no se puede asignar el lugar de otra persona', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('U11 no se puede asignar el lugar de otra persona', true, sqlerrm);
end $$;

-- U12: A no ve ni cambia los lugares de B
do $$ declare vistos int; cambiados int; begin
  select count(*) into vistos from lugares where usuario_id = 'b0000000-0000-4000-8000-000000000002';
  update lugares set nombre = 'hackeado' where usuario_id = 'b0000000-0000-4000-8000-000000000002';
  get diagnostics cambiados = row_count;
  insert into resultados values ('U12 A no ve ni cambia los lugares de B', vistos = 0 and cambiados = 0,
    format('vistos %s, cambiados %s', vistos, cambiados));
end $$;

-- U13: cambiar la ubicación recalcula el lugar; quitarla quita el lugar
do $$ declare l1 uuid; despues uuid; sin uuid; begin
  select lugar_id into l1 from gastos where id = '7b000000-0000-4000-8000-000000000001';
  update gastos set latitud = -0.1806, longitud = -78.4678 where id = '7b000000-0000-4000-8000-000000000003'
    returning lugar_id into despues;
  update gastos set latitud = null, longitud = null where id = '7b000000-0000-4000-8000-000000000003'
    returning lugar_id into sin;
  insert into resultados values ('U13 mover un gasto lo pasa al lugar cercano y quitar la ubicación quita el lugar',
    despues = l1 and sin is null, format('después %s, sin ubicación %s', despues = l1, coalesce(sin::text, 'null')));
end $$;

-- U14: elegir el lugar a mano se respeta aunque no haya ubicación
do $$ declare cat uuid; l1 uuid; g uuid; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select lugar_id into l1 from gastos where id = '7b000000-0000-4000-8000-000000000001';
  insert into gastos (monto, descripcion, categoria_id, fecha, lugar_id) values (6, 'Elegido a mano', cat, '2026-10-16', l1)
    returning lugar_id into g;
  insert into resultados values ('U14 un lugar elegido a mano se respeta', g = l1, coalesce(g::text, 'null'));
end $$;

-- U15: un nombre largo se recorta a 80 caracteres en el lugar
do $$ declare cat uuid; l lugares; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  insert into gastos (id, monto, descripcion, categoria_id, fecha, latitud, longitud)
    values ('7b000000-0000-4000-8000-000000000015', 1, repeat('Restaurante muy largo ', 8), cat, '2026-10-16', -2.1700, -79.9000);
  select * into l from lugares where id = (select lugar_id from gastos where id = '7b000000-0000-4000-8000-000000000015');
  insert into resultados values ('U15 el nombre del lugar nuevo se recorta a 80 caracteres', char_length(l.nombre) <= 80 and l.nombre like 'Restaurante muy largo%',
    char_length(l.nombre) || ' caracteres');
end $$;

-- Avisos de billetera y de correo
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, origen, comercio, latitud, longitud, precision_m, tarjeta_final) values
  ('7c000000-0000-4000-8000-000000000001', 'applepay:1', 'gasto', 25, 'Supermaxi', '2026-10-16', 'apple_pay', 'SUPERMAXI EL BOSQUE', -0.18072, -78.46781, 12, '1234'),
  ('7c000000-0000-4000-8000-000000000003', 'googlewallet:1', 'gasto', 8, 'Kiosko', '2026-10-16', 'google_wallet', 'KIOSKO', -0.1900, -78.4800, 20, '987');
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, correo_asunto) values
  ('7c000000-0000-4000-8000-000000000002', 'msg-ubicacion-1', 'gasto', 9, 'Consumo por correo', '2026-10-16', 'Consumo con tu tarjeta');

-- U16: los avisos viejos y los del correo quedan con origen "correo"
do $$ declare o text; begin
  select origen into o from transacciones_detectadas where id = '7c000000-0000-4000-8000-000000000002';
  insert into resultados values ('U16 un aviso sin origen queda como "correo"', o = 'correo', o);
end $$;

-- U17: confirmar un aviso de Apple Pay pasa billetera, método, ubicación y lugar al gasto
do $$ declare cat uuid; gid uuid; g gastos; t transacciones_detectadas; l1 uuid; saldo numeric; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select lugar_id into l1 from gastos where id = '7b000000-0000-4000-8000-000000000001';
  select disponible into saldo from cuentas where id = '7a000000-0000-4000-8000-000000000001';
  gid := confirmar_transaccion_detectada('7c000000-0000-4000-8000-000000000001', 25, 'Supermaxi', cat, '7a000000-0000-4000-8000-000000000001');
  select * into g from gastos where id = gid;
  select * into t from transacciones_detectadas where id = '7c000000-0000-4000-8000-000000000001';
  insert into resultados values ('U17 confirmar Apple Pay crea el gasto con billetera, crédito, ubicación y lugar',
    g.billetera = 'apple_pay' and g.metodo_pago = 'credito' and g.latitud = -0.1807 and g.precision_m = 12
      and g.lugar_id = l1 and (select disponible from cuentas where id = '7a000000-0000-4000-8000-000000000001') = saldo - 25,
    format('billetera %s, método %s, lugar igual %s', g.billetera, g.metodo_pago, g.lugar_id = l1));
  insert into resultados values ('U18 al confirmar, el aviso olvida comercio, ubicación y tarjeta',
    t.estado = 'confirmado' and t.comercio is null and t.latitud is null and t.longitud is null and t.precision_m is null and t.tarjeta_final is null,
    format('estado %s, latitud %s, tarjeta %s', t.estado, coalesce(t.latitud::text, 'null'), coalesce(t.tarjeta_final, 'null')));
end $$;

-- U19: confirmar un aviso del correo sigue igual que antes (sin billetera ni método)
do $$ declare cat uuid; gid uuid; g gastos; t transacciones_detectadas; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  -- Primero la llamada y después la consulta: dentro de un WHERE correría una vez por fila.
  gid := confirmar_transaccion_detectada('7c000000-0000-4000-8000-000000000002', 9, 'Consumo por correo', cat, '7a000000-0000-4000-8000-000000000002');
  select * into g from gastos where id = gid;
  select * into t from transacciones_detectadas where id = '7c000000-0000-4000-8000-000000000002';
  insert into resultados values ('U19 confirmar un aviso del correo no inventa billetera ni método',
    g.id is not null and g.billetera is null and g.metodo_pago is null and g.latitud is null and t.correo_asunto is null,
    format('billetera %s, método %s', coalesce(g.billetera, 'null'), coalesce(g.metodo_pago, 'null')));
end $$;

-- U20: descartar un aviso también borra su ubicación
do $$ declare t transacciones_detectadas; begin
  update transacciones_detectadas set estado = 'descartado' where id = '7c000000-0000-4000-8000-000000000003';
  select * into t from transacciones_detectadas where id = '7c000000-0000-4000-8000-000000000003';
  insert into resultados values ('U20 descartar un aviso borra su ubicación, comercio y tarjeta',
    t.latitud is null and t.comercio is null and t.tarjeta_final is null, format('latitud %s', coalesce(t.latitud::text, 'null')));
end $$;

-- U21-U22: datos imposibles en la bandeja
do $$ begin
  begin
    insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, origen)
      values ('applepay:ingreso', 'ingreso', 5, 'x', '2026-10-16', 'apple_pay');
    insert into resultados values ('U21 un aviso de billetera no puede ser ingreso', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('U21 un aviso de billetera no puede ser ingreso', true, sqlerrm);
  end;
  begin
    insert into transacciones_detectadas (mensaje_id, tipo, monto, descripcion, fecha, origen, tarjeta_final)
      values ('applepay:tarjeta', 'gasto', 5, 'x', '2026-10-16', 'apple_pay', '12ab');
    insert into resultados values ('U22 los últimos dígitos deben ser 3 o 4 números', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('U22 los últimos dígitos deben ser 3 o 4 números', true, sqlerrm);
  end;
end $$;

-- U23: borrar un lugar deja sus gastos, sin lugar
do $$ declare l uuid; quedan int; con_lugar int; begin
  select lugar_id into l from gastos where id = '7b000000-0000-4000-8000-000000000015';
  delete from lugares where id = l;
  select count(*), count(lugar_id) into quedan, con_lugar from gastos where id = '7b000000-0000-4000-8000-000000000015';
  insert into resultados values ('U23 borrar un lugar conserva sus gastos sin lugar', quedan = 1 and con_lugar = 0,
    format('gastos %s, con lugar %s', quedan, con_lugar));
end $$;
commit;

-- U24: sin sesión no se leen lugares
begin;
set local role anon;
do $$ begin
  perform count(*) from lugares;
  insert into resultados values ('U24 sin sesión no se pueden leer lugares', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('U24 sin sesión no se pueden leer lugares', true, sqlerrm);
end $$;
commit;

-- U25: eliminar la cuenta de C borra sus lugares (ON DELETE CASCADE)
do $$ declare antes int; despues int; begin
  select count(*) into antes from lugares where usuario_id = '7e000000-0000-4000-8000-000000000003';
  delete from auth.users where id = '7e000000-0000-4000-8000-000000000003';
  select count(*) into despues from lugares where usuario_id = '7e000000-0000-4000-8000-000000000003';
  insert into resultados values ('U25 eliminar la cuenta borra los lugares del usuario', antes = 1 and despues = 0,
    format('antes %s, después %s', antes, despues));
end $$;

-- U26: el lugar de B sigue intacto
do $$ declare n text; begin
  select nombre into n from lugares where usuario_id = 'b0000000-0000-4000-8000-000000000002';
  insert into resultados values ('U26 los lugares de B no se tocaron', n = 'Café de B', coalesce(n, 'null'));
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
