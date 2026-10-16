-- Pruebas de la migración 20261016180000_captura_google_wallet (fase 4).
-- Base DESECHABLE. N es un usuario propio de este archivo; la app de Android
-- se simula con el rol `anon` (la clave pública de Supabase), como el atajo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;
create temp table claves (nombre text primary key, clave text);
grant all on claves to authenticated, anon;

insert into auth.users (id, email) values ('7f000000-0000-4000-8000-00000000000e', 'n-wallet@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7d200000-0000-4000-8000-000000000001', 'Mastercard Pichincha', 'credito', 'pichincha', '4321', 1000, 1000);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible) values
  ('7d200000-0000-4000-8000-000000000002', 'Débito Guayaquil', 'debito', 'banco_guayaquil', '8765', 500);
insert into claves values ('android', crear_clave_captura('Mi Android'));
commit;

-- G01-G07: la lectura del aviso, con los formatos que usa Google Wallet
begin;
set local role postgres;
do $$ declare a jsonb; begin
  a := leer_aviso_google_wallet('SUPERMAXI', '$12,50 con Mastercard Pichincha •••• 4321');
  insert into resultados values ('G01 título con el comercio y texto con monto y tarjeta',
    a = '{"ignorar": false, "monto": "12,50", "comercio": "SUPERMAXI", "tarjeta": "Pichincha 4321"}'::jsonb, a::text);

  a := leer_aviso_google_wallet('Google Wallet', 'Pagaste $8.75 en Farmacias Fybeca con Débito Guayaquil ••8765');
  insert into resultados values ('G02 título genérico: el comercio sale del texto, entre "en" y "con"',
    a ->> 'monto' = '8.75' and a ->> 'comercio' = 'Farmacias Fybeca' and a ->> 'tarjeta' = 'Guayaquil 8765', a::text);

  a := leer_aviso_google_wallet('Pago realizado', 'US$ 1.250,00 en Almacenes De Prati');
  insert into resultados values ('G03 miles con punto y decimales con coma, sin tarjeta',
    a ->> 'monto' = '1.250,00' and a ->> 'comercio' = 'Almacenes De Prati' and a -> 'tarjeta' = 'null'::jsonb, a::text);

  a := leer_aviso_google_wallet('Tienda Guayaquil Centro', 'USD 3.20 • Visa ending in 1234');
  insert into resultados values ('G04 el banco se busca en el medio de pago, no en el nombre del comercio',
    a ->> 'monto' = '3.20' and a ->> 'comercio' = 'Tienda Guayaquil Centro' and a ->> 'tarjeta' = '1234', a::text);

  a := leer_aviso_google_wallet('Pago rechazado', '$40.00 en KFC con Mastercard Pichincha •••• 4321');
  insert into resultados values ('G05 un pago rechazado se ignora', a = '{"ignorar": true}'::jsonb, a::text);

  a := leer_aviso_google_wallet('Google Wallet', 'Tu tarjeta ya está lista para pagar sin contacto');
  insert into resultados values ('G06 un aviso sin monto se ignora', a = '{"ignorar": true}'::jsonb, a::text);

  a := leer_aviso_google_wallet(E'Café\tdel\nParque', E'Pagaste $2.50 con\tVisa••••9876');
  insert into resultados values ('G07 tabulaciones, saltos y espacios raros se limpian',
    a ->> 'comercio' = 'Café del Parque' and a ->> 'monto' = '2.50' and a ->> 'tarjeta' = '9876', a::text);
end $$;
commit;

-- G08-G10: la app de Android registra el aviso en la bandeja
begin;
set local role anon;
do $$ declare c text; r jsonb; begin
  select clave into c from claves where nombre = 'android';
  r := registrar_aviso_billetera(c, 'SUPERMAXI', '$12,50 con Mastercard Pichincha •••• 4321', 'com.google.android.apps.walletnfcrel', null);
  insert into resultados values ('G08 el aviso de Google Wallet llega y solo responde estado y monto',
    r = '{"estado": "recibido", "monto": 12.50}'::jsonb, r::text);
  r := registrar_aviso_billetera(c, 'SUPERMAXI', '$12,50 con Mastercard Pichincha •••• 4321');
  insert into resultados values ('G09 la misma notificación dos veces deja un solo aviso', r ->> 'estado' = 'repetido', r::text);
  r := registrar_aviso_billetera(c, 'Pago rechazado', '$40.00 en KFC con Mastercard Pichincha •••• 4321');
  insert into resultados values ('G10 un pago rechazado responde ignorado y no llega a la bandeja', r = '{"estado": "ignorado"}'::jsonb, r::text);
end $$;
commit;

do $$ declare t transacciones_detectadas; n int; begin
  select count(*) into n from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000e';
  select * into t from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000e' order by created_at limit 1;
  insert into resultados values ('G11 en la bandeja: origen Google Wallet, monto, comercio, tarjeta de Pichincha y fecha de hoy en Ecuador',
    n = 1 and t.origen = 'google_wallet' and t.tipo = 'gasto' and t.monto = 12.50 and t.comercio = 'SUPERMAXI'
      and t.banco = 'pichincha' and t.cuenta_id = '7d200000-0000-4000-8000-000000000001' and t.tarjeta_final = '4321'
      and t.fecha = (now() at time zone 'America/Guayaquil')::date and t.estado = 'pendiente',
    format('%s avisos; origen %s, $%s, %s, %s, cuenta %s, %s', n, t.origen, t.monto, t.comercio, t.banco, t.cuenta_id, t.fecha));
end $$;

-- G12: si el teléfono estaba sin internet, el aviso lleva la fecha del pago
begin;
set local role anon;
do $$ declare c text; r jsonb; begin
  select clave into c from claves where nombre = 'android';
  r := registrar_aviso_billetera(c, 'Panadería', '$1.80 con Débito Guayaquil ••8765',
    'com.google.android.apps.walletnfcrel', (extract(epoch from now() - interval '2 days') * 1000)::bigint::text);
  insert into resultados values ('G12a aviso atrasado recibido', r ->> 'estado' = 'recibido', r::text);
end $$;
commit;
do $$ declare t transacciones_detectadas; begin
  select * into t from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000e' and comercio = 'Panadería';
  insert into resultados values ('G12 una notificación de hace 2 días queda con la fecha del pago',
    t.fecha = ((now() - interval '2 days') at time zone 'America/Guayaquil')::date and t.cuenta_id = '7d200000-0000-4000-8000-000000000002',
    format('fecha %s, cuenta %s', t.fecha, t.cuenta_id));
end $$;

-- G13: una hora de hace más de 3 días (o inventada) se descarta y queda hoy
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  perform registrar_aviso_billetera(c, 'Gasolinera', '$20.00 con Débito Guayaquil ••8765',
    'com.google.android.apps.walletnfcrel', (extract(epoch from now() - interval '20 days') * 1000)::bigint::text);
  perform registrar_aviso_billetera(c, 'Kiosco', '$0.50', 'com.google.android.apps.walletnfcrel', 'ayer');
end $$;
commit;
do $$ declare f1 date; f2 date; begin
  select fecha into f1 from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000e' and comercio = 'Gasolinera';
  select fecha into f2 from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000e' and comercio = 'Kiosco';
  insert into resultados values ('G13 una hora de hace 20 días o ilegible se descarta: queda la fecha de hoy',
    f1 = (now() at time zone 'America/Guayaquil')::date and f2 = f1, format('%s, %s', f1, f2));
end $$;

-- G14-G17: rechazos
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'android';
  begin
    perform registrar_aviso_billetera('ft_' || repeat('0', 64), 'X', '$5');
    insert into resultados values ('G14 una clave inventada se rechaza sin pistas', false, 'se permitió');
  exception when invalid_authorization_specification then
    insert into resultados values ('G14 una clave inventada se rechaza sin pistas', sqlerrm = 'Clave no válida.', sqlerrm);
  end;
  begin
    perform registrar_aviso_billetera(c, 'Banco', 'Compra por $5.00 aprobada', 'com.banco.app');
    insert into resultados values ('G15 una notificación de otra aplicación se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('G15 una notificación de otra aplicación se rechaza', true, sqlerrm);
  end;
  begin
    perform leer_aviso_google_wallet('a', 'b');
    insert into resultados values ('G16 la lectura del aviso no se puede llamar desde afuera', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('G16 la lectura del aviso no se puede llamar desde afuera', true, sqlerrm);
  end;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
do $$ begin
  perform registrar_aviso_billetera('ft_' || repeat('0', 64), 'X', '$5');
  insert into resultados values ('G17 con sesión de usuario no se usa (solo la clave pública)', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('G17 con sesión de usuario no se usa (solo la clave pública)', true, sqlerrm);
end $$;
commit;

-- G18: la función fija search_path y es security definer
do $$ declare n int; begin
  select count(*) into n from pg_proc p
  where p.proname in ('registrar_aviso_billetera', 'leer_aviso_google_wallet')
    and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  insert into resultados values ('G18 las funciones nuevas fijan search_path', n = 0, n || ' sin fijar');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
