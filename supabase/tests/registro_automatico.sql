-- Pruebas de la migración 20261018130000_registro_automatico_billetera.
-- Base DESECHABLE. R y S son usuarios propios de este archivo; el teléfono
-- (la app de Android o el atajo del iPhone) se simula con el rol `anon`.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;
create temp table claves (nombre text primary key, clave text);
grant all on claves to authenticated, anon;
create temp table respuestas (nombre text primary key, r jsonb);
grant all on respuestas to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-000000000022', 'r-automatico@prueba.local'),
  ('7f000000-0000-4000-8000-000000000023', 's-automatico@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7e400000-0000-4000-8000-000000000001', 'Mastercard Pichincha', 'credito', 'pichincha', '4321', 100, 100);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible) values
  ('7e400000-0000-4000-8000-000000000002', 'Débito Guayaquil', 'debito', 'banco_guayaquil', '8765', 500),
  ('7e400000-0000-4000-8000-000000000003', 'Ahorro Produbanco', 'ahorro', 'produbanco', '1111', 300),
  ('7e400000-0000-4000-8000-000000000004', 'Ahorro Austro', 'ahorro', 'banco_austro', '1111', 300);
-- Un lugar donde R ya pagó antes con ubicación.
insert into lugares (id, nombre, latitud, longitud) values
  ('7e410000-0000-4000-8000-000000000001', 'Supermaxi', -0.1807, -78.4678);
insert into presupuestos (categoria_id, monto_limite, mes)
  select id, 20, to_char(now() at time zone 'America/Guayaquil', 'YYYY-MM')
  from categorias where nombre = 'Comida' and usuario_id is null and tipo = 'gasto';
-- Lo que R anotó a mano: la próxima vez, la misma categoría.
insert into gastos (monto, descripcion, categoria_id, fecha)
  select 3, 'Cafetería Luna', id, current_date - 5 from categorias where nombre = 'Ocio' and usuario_id is null;
insert into claves values ('android', crear_clave_captura('Android de R'));
insert into claves values ('iphone', crear_clave_captura('iPhone de R'));
commit;

-- R01-R04: tarjeta reconocida por sus dígitos = gasto registrado solo
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r01', registrar_aviso_billetera(c, 'SUPERMAXI', '$12,50 con Mastercard Pichincha •••• 4321'));
end $$;
commit;
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r04', registrar_aviso_billetera(c, 'SUPERMAXI', '$12,50 con Mastercard Pichincha •••• 4321'));
end $$;
commit;

do $$ declare r jsonb; g gastos; t transacciones_detectadas; n int; begin
  select respuestas.r into r from respuestas where nombre = 'r01';
  insert into resultados values ('R01 responde registrado, con el gasto, la tarjeta y la categoría',
    r ->> 'estado' = 'registrado' and (r ->> 'monto')::numeric = 12.50 and r ->> 'tarjeta' = '4321'
      and r ->> 'categoria' = 'Comida' and r ? 'gasto_id' and not r ? 'presupuesto',
    r::text);
  select * into g from gastos where id = (r ->> 'gasto_id')::uuid;
  insert into resultados values ('R02 el gasto descuenta del cupo, con billetera, método, lugar por comercio y hora del pago',
    g.monto = 12.50 and g.cuenta_id = '7e400000-0000-4000-8000-000000000001' and g.metodo_pago = 'credito'
      and g.billetera = 'google_wallet' and g.descripcion = 'SUPERMAXI' and g.lugar_id = '7e410000-0000-4000-8000-000000000001'
      and g.latitud is null and g.fecha = (now() at time zone 'America/Guayaquil')::date
      and g.pagado_en between now() - interval '1 minute' and now() + interval '1 minute'
      and (select disponible from cuentas where id = '7e400000-0000-4000-8000-000000000001') = 87.50,
    format('$%s, cuenta %s, %s, %s, lugar %s, cupo %s', g.monto, g.cuenta_id, g.metodo_pago, g.billetera, g.lugar_id,
      (select disponible from cuentas where id = '7e400000-0000-4000-8000-000000000001')));
  select * into t from transacciones_detectadas where gasto_id = g.id;
  insert into resultados values ('R03 el aviso queda confirmado, apunta al gasto y sin comercio ni tarjeta',
    t.estado = 'confirmado' and t.comercio is null and t.tarjeta_final is null and t.origen = 'google_wallet',
    format('%s, comercio %s', t.estado, t.comercio));
  select respuestas.r into r from respuestas where nombre = 'r04';
  select count(*) into n from gastos where usuario_id = '7f000000-0000-4000-8000-000000000022' and billetera = 'google_wallet';
  insert into resultados values ('R04 la misma notificación otra vez no registra otro gasto', r ->> 'estado' = 'repetido' and n = 1, r::text || ', ' || n || ' gastos');
end $$;

-- R05: avisos de presupuesto (Comida, límite $20): 62,5 % → nada; 82,5 % → 75; 132,5 % → te pasaste
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r05a', registrar_aviso_billetera(c, 'Megamaxi', 'US$4,00 con Mastercard Pichincha •••• 4321'));
end $$;
commit;
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r05b', registrar_aviso_billetera(c, 'Supermaxi Norte', '$10.00 con Mastercard Pichincha •••• 4321'));
end $$;
commit;
do $$ declare a jsonb; b jsonb; niveles int[]; begin
  select r into a from respuestas where nombre = 'r05a';
  select r into b from respuestas where nombre = 'r05b';
  select array_agg(nivel order by nivel) into niveles from avisos_presupuesto where usuario_id = '7f000000-0000-4000-8000-000000000022';
  insert into resultados values ('R05 presupuesto: avisa al 75 % y, si salta del 82 % al 132 %, solo «te pasaste»',
    (a -> 'presupuesto' ->> 'nivel')::int = 75 and (a -> 'presupuesto' ->> 'porcentaje')::numeric = 82.50
      and a -> 'presupuesto' ->> 'categoria' = 'Comida'
      and (b -> 'presupuesto' ->> 'nivel')::int = 101 and (b -> 'presupuesto' ->> 'gastado')::numeric = 26.50
      and niveles = array[75, 100, 101],
    format('%s | %s | niveles %s', a -> 'presupuesto', b -> 'presupuesto', niveles));
end $$;

-- R06: la app pregunta después y no hay nada nuevo (ya se avisó)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
do $$ declare r jsonb; begin
  r := revisar_mis_presupuestos(to_char(now() at time zone 'America/Guayaquil', 'YYYY-MM'));
  insert into resultados values ('R06 lo ya avisado no se vuelve a avisar', r = '[]'::jsonb, r::text);
  begin
    insert into avisos_presupuesto (presupuesto_id, nivel) select id, 75 from presupuestos limit 1;
    insert into resultados values ('R06b los avisos de presupuesto no se escriben a mano', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('R06b los avisos de presupuesto no se escriben a mano', true, sqlerrm);
  end;
  begin
    perform revisar_mis_presupuestos('octubre');
    insert into resultados values ('R06c un mes mal escrito se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('R06c un mes mal escrito se rechaza', true, sqlerrm);
  end;
  -- R21: subir el límite vuelve a habilitar los avisos (a $30: 88 % → avisa 75 de nuevo)
  update presupuestos set monto_limite = 30;
  r := revisar_mis_presupuestos(to_char(now() at time zone 'America/Guayaquil', 'YYYY-MM'));
  insert into resultados values ('R21 cambiar el límite reinicia los avisos de ese presupuesto',
    jsonb_array_length(r) = 1 and (r -> 0 ->> 'nivel')::int = 75, r::text);
end $$;
commit;

-- R07-R08: categoría aprendida y «Otros» con el comercio como detalle
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r07', registrar_aviso_billetera(c, 'Cafetería  Luna', '$2.75 con Débito Guayaquil ••8765'));
end $$;
commit;
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r08', registrar_aviso_billetera(c, 'Ferretería Kywi', '$8.00 con Débito Guayaquil ••8765'));
end $$;
commit;
do $$ declare a jsonb; b jsonb; g gastos; begin
  select r into a from respuestas where nombre = 'r07';
  select r into b from respuestas where nombre = 'r08';
  select * into g from gastos where id = (b ->> 'gasto_id')::uuid;
  insert into resultados values ('R07 usa la categoría de tu último gasto en ese comercio', a ->> 'categoria' = 'Ocio', a::text);
  insert into resultados values ('R08 sin pistas, «Otros» con el comercio como detalle; débito descuenta del saldo',
    b ->> 'categoria' = 'Otros' and g.categoria_detalle = 'Ferretería Kywi' and g.metodo_pago = 'debito'
      and (select disponible from cuentas where id = '7e400000-0000-4000-8000-000000000002') = 489.25,
    format('%s, detalle %s, %s, saldo %s', b ->> 'categoria', g.categoria_detalle, g.metodo_pago,
      (select disponible from cuentas where id = '7e400000-0000-4000-8000-000000000002')));
end $$;

-- R09-R13: lo que va a la bandeja
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  -- R09: supera el cupo de la tarjeta
  insert into respuestas values ('r09', registrar_aviso_billetera(c, 'Electrónica Total', '$500.00 con Mastercard Pichincha •••• 4321'));
  -- R10: solo el banco, sin dígitos
  insert into respuestas values ('r10', registrar_aviso_billetera(c, 'Farmacias Fybeca', '$6.10 con Débito Guayaquil'));
  -- R11: dos cuentas con los mismos dígitos
  insert into respuestas values ('r11', registrar_aviso_billetera(c, 'Panadería Centro', '$1.20 con Visa •••• 1111'));
  -- R12: una tarjeta del banco que NO registraste (otros dígitos)
  insert into respuestas values ('r12', registrar_aviso_billetera(c, 'Kiosco', '$0.80 con Mastercard Pichincha •••• 9999'));
end $$;
commit;
do $$
declare
  r9 jsonb; r10 jsonb; r11 jsonb; r12 jsonb;
  t9 transacciones_detectadas; t10 transacciones_detectadas; t11 transacciones_detectadas; t12 transacciones_detectadas;
begin
  select r into r9 from respuestas where nombre = 'r09';
  select r into r10 from respuestas where nombre = 'r10';
  select r into r11 from respuestas where nombre = 'r11';
  select r into r12 from respuestas where nombre = 'r12';
  select * into t9 from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'Electrónica Total';
  select * into t10 from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'Farmacias Fybeca';
  select * into t11 from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'Panadería Centro';
  select * into t12 from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'Kiosco';
  insert into resultados values ('R09 si supera el cupo, queda en la bandeja con la tarjeta puesta (y la respuesta de siempre)',
    r9 = '{"estado": "recibido", "monto": 500.00}'::jsonb and t9.estado = 'pendiente' and t9.cuenta_id = '7e400000-0000-4000-8000-000000000001'
      and t9.gasto_id is null,
    r9::text || ' ' || t9.estado);
  insert into resultados values ('R10 sin dígitos (solo el banco): a la bandeja, con la cuenta y la categoría sugeridas',
    r10 ->> 'estado' = 'recibido' and t10.estado = 'pendiente' and t10.cuenta_id = '7e400000-0000-4000-8000-000000000002'
      and t10.categoria_id = (select id from categorias where nombre = 'Salud' and usuario_id is null),
    format('%s, cuenta %s, categoría %s', t10.estado, t10.cuenta_id, t10.categoria_id));
  insert into resultados values ('R11 dos cuentas con los mismos dígitos: a la bandeja sin cuenta',
    r11 ->> 'estado' = 'recibido' and t11.estado = 'pendiente' and t11.cuenta_id is null,
    format('%s, cuenta %s', t11.estado, t11.cuenta_id));
  insert into resultados values ('R12 una tarjeta del banco con otros dígitos no se carga a la que registraste',
    r12 ->> 'estado' = 'recibido' and t12.cuenta_id is null and t12.banco = 'pichincha',
    format('%s, cuenta %s, banco %s', t12.estado, t12.cuenta_id, t12.banco));
end $$;

-- R13: con el registro automático apagado, todo va a la bandeja
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
insert into ajustes_usuario (registro_automatico) values (false);
commit;
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r13', registrar_aviso_billetera(c, 'supermaxi', '$3.30 con Mastercard Pichincha •••• 4321'));
end $$;
commit;
do $$ declare r jsonb; t transacciones_detectadas; begin
  select respuestas.r into r from respuestas where nombre = 'r13';
  select * into t from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'supermaxi';
  insert into resultados values ('R13 con el registro automático apagado, a la bandeja aunque reconozca la tarjeta',
    r ->> 'estado' = 'recibido' and t.estado = 'pendiente' and t.cuenta_id = '7e400000-0000-4000-8000-000000000001',
    r::text);
end $$;

-- R17: al confirmar en la bandeja, el pago de Google Wallet sin ubicación toma el lugar del comercio
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
do $$ declare t transacciones_detectadas; gid uuid; g gastos; t2 transacciones_detectadas; begin
  select * into t from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'supermaxi';
  gid := confirmar_transaccion_detectada(t.id, 3.30, 'supermaxi', t.categoria_id, t.cuenta_id);
  select * into g from gastos where id = gid;
  select * into t2 from transacciones_detectadas where id = t.id;
  insert into resultados values ('R17 confirmar en la bandeja: lugar por el nombre del comercio y el aviso apunta al gasto',
    g.lugar_id = '7e410000-0000-4000-8000-000000000001' and t2.gasto_id = gid and t2.estado = 'confirmado'
      and g.categoria_id = (select id from categorias where nombre = 'Comida' and usuario_id is null),
    format('lugar %s, gasto %s', g.lugar_id, t2.gasto_id));
end $$;
update ajustes_usuario set registro_automatico = true;
commit;

-- R14-R15: Apple Pay (el atajo) también: con dígitos se registra; solo con el banco, a la bandeja
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'iphone';
  insert into respuestas values ('r14', registrar_pago_billetera(c, '7,40', 'Juan Valdez', 'Débito Guayaquil 8765', '-0.1700', '-78.4800', '15'));
  insert into respuestas values ('r15', registrar_pago_billetera(c, '9,90', 'Librería Española', 'Produbanco Débito'));
end $$;
commit;
do $$ declare a jsonb; b jsonb; g gastos; t transacciones_detectadas; begin
  select r into a from respuestas where nombre = 'r14';
  select r into b from respuestas where nombre = 'r15';
  select * into g from gastos where id = (a ->> 'gasto_id')::uuid;
  select * into t from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000022' and comercio = 'Librería Española';
  insert into resultados values ('R14 Apple Pay con dígitos: registrado, con la ubicación del atajo y su lugar',
    a ->> 'estado' = 'registrado' and g.billetera = 'apple_pay' and g.latitud = -0.1700 and g.lugar_id is not null
      and g.lugar_id <> '7e410000-0000-4000-8000-000000000001' and g.pagado_en is not null,
    format('%s, %s, lat %s, lugar %s', a ->> 'estado', g.billetera, g.latitud, g.lugar_id));
  insert into resultados values ('R15 Apple Pay solo con el banco: a la bandeja con la cuenta',
    b ->> 'estado' = 'recibido' and t.estado = 'pendiente' and t.cuenta_id = '7e400000-0000-4000-8000-000000000003',
    format('%s, cuenta %s', b ->> 'estado', t.cuenta_id));
end $$;

-- R16: notificación atrasada (sin internet): el gasto lleva la fecha y la hora del pago
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  insert into respuestas values ('r16', registrar_aviso_billetera(c, 'Panadería Sol', '$1.80 con Débito Guayaquil ••8765',
    'com.google.android.apps.walletnfcrel', (extract(epoch from now() - interval '2 days') * 1000)::bigint::text));
end $$;
commit;
do $$ declare r jsonb; g gastos; begin
  select respuestas.r into r from respuestas where nombre = 'r16';
  select * into g from gastos where id = (r ->> 'gasto_id')::uuid;
  insert into resultados values ('R16 notificación de hace 2 días: el gasto queda con esa fecha y hora',
    g.fecha = ((now() - interval '2 days') at time zone 'America/Guayaquil')::date
      and g.pagado_en between now() - interval '2 days 1 minute' and now() - interval '2 days' + interval '1 minute',
    format('fecha %s, hora %s', g.fecha, g.pagado_en));
end $$;

-- R18: S no puede ver lugares de R a través de lugar_por_comercio
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000023","role":"authenticated"}', true);
do $$ declare l uuid; begin
  l := lugar_por_comercio('7f000000-0000-4000-8000-000000000022', 'Supermaxi');
  insert into resultados values ('R18 lugar_por_comercio no muestra lugares ajenos', l is null, coalesce(l::text, 'null'));
end $$;
commit;

-- R19: las funciones internas no se pueden llamar desde afuera
begin;
set local role anon;
do $$ begin
  begin
    perform registrar_pago_con_clave(gen_random_uuid(), '1', null, null, null, null, null, 'google_wallet', null);
    insert into resultados values ('R19 registrar_pago_con_clave no se llama desde afuera', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('R19 registrar_pago_con_clave no se llama desde afuera', true, sqlerrm);
  end;
  begin
    perform revisar_mis_presupuestos('2026-10');
    insert into resultados values ('R19b sin sesión no se revisan presupuestos', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('R19b sin sesión no se revisan presupuestos', true, sqlerrm);
  end;
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
do $$ begin
  begin
    perform revisar_presupuestos('7f000000-0000-4000-8000-000000000023', '2026-10', null);
    insert into resultados values ('R19c revisar_presupuestos (interna) no se llama con sesión', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('R19c revisar_presupuestos (interna) no se llama con sesión', true, sqlerrm);
  end;
  begin
    perform categoria_sugerida('7f000000-0000-4000-8000-000000000023', 'x');
    insert into resultados values ('R19d categoria_sugerida (interna) no se llama con sesión', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('R19d categoria_sugerida (interna) no se llama con sesión', true, sqlerrm);
  end;
end $$;
commit;

-- R20: search_path fijo
do $$ declare n int; begin
  select count(*) into n from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('categoria_sugerida', 'lugar_por_comercio', 'reiniciar_avisos_presupuesto', 'revisar_presupuestos',
                      'revisar_mis_presupuestos', 'registrar_pago_con_clave', 'registrar_pago_billetera',
                      'registrar_aviso_billetera', 'confirmar_transaccion_detectada', 'exportar_datos_persona')
    and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  insert into resultados values ('R20 las funciones nuevas fijan search_path', n = 0, n || ' sin fijar');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
