-- Pruebas de la migración 20261016140000_captura_apple_pay.
-- Base DESECHABLE. F y G son usuarios propios de este archivo; el atajo
-- del iPhone se simula con el rol `anon` (la clave pública de Supabase).

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;
create temp table claves (nombre text primary key, clave text);
grant all on claves to authenticated, anon;

insert into auth.users (id, email) values
  ('7f000000-0000-4000-8000-000000000006', 'f-captura@prueba.local'),
  ('7f000000-0000-4000-8000-000000000007', 'g-captura@prueba.local')
on conflict (id) do nothing;

-- F crea su clave y sus cuentas.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7d100000-0000-4000-8000-000000000001', 'Visa Produbanco', 'credito', 'produbanco', '1234', 1000, 1000);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible) values
  ('7d100000-0000-4000-8000-000000000002', 'Débito Guayaquil A', 'debito', 'banco_guayaquil', '5678', 500),
  ('7d100000-0000-4000-8000-000000000003', 'Débito Guayaquil B', 'debito', 'banco_guayaquil', '9999', 500);
insert into claves values ('iphone', crear_clave_captura('  Mi iPhone  '));

-- W01: la clave tiene el formato esperado y la base guarda solo su huella
do $$ declare c text; ok boolean; begin
  select clave into c from claves where nombre = 'iphone';
  reset role;
  select exists (
    select 1 from claves_captura
    where usuario_id = '7f000000-0000-4000-8000-000000000006' and nombre = 'Mi iPhone'
      and huella = encode(sha256(convert_to(c, 'UTF8')), 'hex') and huella <> c and prefijo = substr(c, 4, 6)
  ) into ok;
  set local role authenticated;
  insert into resultados values ('W01 la clave es ft_ + 64 hex y la base guarda solo su huella',
    c ~ '^ft_[0-9a-f]{64}$' and ok, left(c, 9) || '…');
end $$;

-- W02: ni el dueño puede leer la huella
do $$ begin
  perform huella from claves_captura;
  insert into resultados values ('W02 nadie puede leer la huella de una clave', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('W02 nadie puede leer la huella de una clave', true, sqlerrm);
end $$;

-- W03: ni crear ni cambiar claves a mano
do $$ begin
  begin
    insert into claves_captura (nombre, huella, prefijo) values ('x', repeat('a', 64), 'aaaaaa');
    insert into resultados values ('W03 no se pueden crear claves a mano', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('W03 no se pueden crear claves a mano', true, sqlerrm);
  end;
  begin
    update claves_captura set nombre = 'otro';
    insert into resultados values ('W04 no se pueden cambiar claves a mano', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('W04 no se pueden cambiar claves a mano', true, sqlerrm);
  end;
end $$;
commit;

-- W05: el atajo (anon) registra un pago con monto, comercio, tarjeta y ubicación
begin;
set local role anon;
do $$ declare c text; r jsonb; begin
  select clave into c from claves where nombre = 'iphone';
  r := registrar_pago_billetera(c, '$12,50', 'SUPERMAXI EL BOSQUE', 'Produbanco Visa Signature', '-0.18072', '-78.46781', '12');
  insert into resultados values ('W05 el atajo registra el pago y solo responde estado y monto',
    r = '{"estado": "recibido", "monto": 12.50}'::jsonb, r::text);
  -- W06: el mismo pago otra vez (el atajo se repitió) no duplica
  r := registrar_pago_billetera(c, '12.50', 'SUPERMAXI EL BOSQUE', 'Produbanco Visa Signature', '-0.18072', '-78.46781', '12');
  insert into resultados values ('W06 el mismo pago dos veces deja un solo aviso', r ->> 'estado' = 'repetido', r::text);
end $$;
commit;

do $$ declare t transacciones_detectadas; n int; begin
  select count(*) into n from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000006';
  select * into t from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-000000000006' limit 1;
  insert into resultados values ('W07 el aviso queda pendiente, de Apple Pay, con cuenta, ubicación y fecha de Ecuador',
    n = 1 and t.estado = 'pendiente' and t.tipo = 'gasto' and t.origen = 'apple_pay' and t.monto = 12.50
      and t.comercio = 'SUPERMAXI EL BOSQUE' and t.descripcion = 'SUPERMAXI EL BOSQUE' and t.banco = 'produbanco'
      and t.cuenta_id = '7d100000-0000-4000-8000-000000000001' and t.latitud = -0.1807 and t.precision_m = 12
      and t.fecha = (now() at time zone 'America/Guayaquil')::date and t.clave_captura_id is not null,
    format('avisos %s, cuenta %s, banco %s, latitud %s', n, t.cuenta_id, t.banco, t.latitud));
end $$;

-- W08: montos en los formatos del iPhone (mismas reglas que core)
do $$ declare casos text[][] := array[
    ['12,50', '12.50'], ['12.50', '12.50'], ['$12.50', '12.50'], ['US$ 1.234,56', '1234.56'], ['1,234.56', '1234.56'],
    ['$ 1 234,5', '1234.50'], ['12 USD', '12.00'], ['0,005', '0.01'], ['12.500', '12500.00'], ['12.5', '12.50'],
    ['US$' || chr(160) || '12,50', '12.50'], ['-5', null], ['abc', null], ['12,,5', null], ['12,', null], ['€12,50', null], ['', null]
  ];
  i int; malos text := '';
begin
  for i in 1 .. array_length(casos, 1) loop
    if interpretar_monto_texto(casos[i][1]) is distinct from casos[i][2]::numeric then
      malos := malos || format('[%s → %s] ', casos[i][1], coalesce(interpretar_monto_texto(casos[i][1])::text, 'null'));
    end if;
  end loop;
  insert into resultados values ('W08 lee los montos en todos los formatos del iPhone', malos = '', coalesce(nullif(malos, ''), '17 casos bien'));
end $$;

-- W09-W11: errores que el atajo debe ver
begin;
set local role anon;
do $$ declare c text; m1 text; m2 text; begin
  select clave into c from claves where nombre = 'iphone';
  begin
    perform registrar_pago_billetera(c, 'gratis');
    insert into resultados values ('W09 un monto ilegible se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('W09 un monto ilegible se rechaza', true, sqlerrm);
  end;
  begin
    perform registrar_pago_billetera(c, '0,004');
    insert into resultados values ('W10 un monto de menos de un centavo se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('W10 un monto de menos de un centavo se rechaza', true, sqlerrm);
  end;
  begin
    perform registrar_pago_billetera('ft_corta', '5');
  exception when invalid_authorization_specification then
    m1 := sqlerrm;
  end;
  begin
    perform registrar_pago_billetera('ft_' || repeat('0', 64), '5');
  exception when invalid_authorization_specification then
    m2 := sqlerrm;
  end;
  insert into resultados values ('W11 una clave mal escrita o inventada da el mismo error, sin pistas',
    m1 = 'Clave no válida.' and m2 = m1, coalesce(m1, 'null') || ' / ' || coalesce(m2, 'null'));
  begin
    perform registrar_pago_billetera(c, '5', null, null, null, null, null, 'paypal');
    insert into resultados values ('W12 una billetera desconocida se rechaza', false, 'se permitió');
  exception when invalid_parameter_value then
    insert into resultados values ('W12 una billetera desconocida se rechaza', true, sqlerrm);
  end;
end $$;

-- W13: reconocer la tarjeta (banco único, varias del banco por dígitos, solo dígitos, ambiguo)
do $$ declare c text; begin
  select clave into c from claves where nombre = 'iphone';
  perform registrar_pago_billetera(c, '1', 'T13-a', 'Banco Guayaquil Débito ••9999');
  perform registrar_pago_billetera(c, '2', 'T13-b', 'Banco Guayaquil Débito');
  perform registrar_pago_billetera(c, '3', 'T13-c', 'Tarjeta 1234');
  perform registrar_pago_billetera(c, '4', 'T13-d', 'Diners Titanium');
  -- W14: ubicación con coma, ilegible o con precisión imposible; textos sucios
  perform registrar_pago_billetera(c, '5', 'T14-a', null, '-0,1807', '-78,4678', '20');
  perform registrar_pago_billetera(c, '6', 'T14-b', null, 'abc', '-78.4678', '20');
  perform registrar_pago_billetera(c, '7', 'T14-c', null, '-0.1807', '-78.4678', '99999');
  perform registrar_pago_billetera(c, '8', 'T14-d' || chr(10) || chr(7) || '   CAFÉ   ' || repeat('x', 300));
  -- Google Wallet (para MacroDroid o Tasker en Android) usa la misma función
  perform registrar_pago_billetera(c, '9', 'T15', null, null, null, null, 'google_wallet');
end $$;
commit;

do $$ declare
  a uuid; b uuid; cc uuid; d uuid; bb text; dd text;
  la numeric; lb numeric; lc numeric; pc int; com text; org text;
begin
  select cuenta_id into a from transacciones_detectadas where comercio = 'T13-a';
  select cuenta_id, banco into b, bb from transacciones_detectadas where comercio = 'T13-b';
  select cuenta_id into cc from transacciones_detectadas where comercio = 'T13-c';
  select cuenta_id, banco into d, dd from transacciones_detectadas where comercio = 'T13-d';
  insert into resultados values ('W13 reconoce la tarjeta por banco y dígitos, y deja elegir si es ambiguo',
    a = '7d100000-0000-4000-8000-000000000003' and b is null and bb = 'banco_guayaquil'
      and cc = '7d100000-0000-4000-8000-000000000001' and d is null and dd = 'diners_club',
    format('a %s, b %s/%s, c %s, d %s/%s', a, b, bb, cc, d, dd));
  select latitud into la from transacciones_detectadas where comercio = 'T14-a';
  select latitud into lb from transacciones_detectadas where comercio = 'T14-b';
  select latitud, precision_m into lc, pc from transacciones_detectadas where comercio = 'T14-c';
  insert into resultados values ('W14 coordenadas con coma sirven; ilegibles o imprecisas se descartan sin perder el aviso',
    la = -0.1807 and lb is null and lc is null and pc is null, format('coma %s, ilegible %s, imprecisa %s', la, lb, lc));
  select comercio into com from transacciones_detectadas where monto = 8 and usuario_id = '7f000000-0000-4000-8000-000000000006';
  insert into resultados values ('W15 el comercio llega sin caracteres de control y recortado a 200',
    com !~ '[[:cntrl:]]' and char_length(com) = 200 and com like 'T14-d CAFÉ x%', char_length(com) || ' caracteres');
  select origen into org from transacciones_detectadas where comercio = 'T15';
  insert into resultados values ('W16 la misma función sirve para Google Wallet', org = 'google_wallet', org);
end $$;

-- W17: límite de 30 avisos por hora por clave
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
insert into claves values ('limite', crear_clave_captura('Para el límite'));
commit;
insert into transacciones_detectadas (usuario_id, mensaje_id, tipo, monto, descripcion, fecha, origen, clave_captura_id)
select '7f000000-0000-4000-8000-000000000006', 'apple_pay:relleno-' || g, 'gasto', 1, 'Relleno', current_date, 'apple_pay',
  (select id from claves_captura where nombre = 'Para el límite')
from generate_series(1, 30) g;
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'limite';
  perform registrar_pago_billetera(c, '1', 'Uno más');
  insert into resultados values ('W17 con 30 avisos en la última hora, la clave espera', false, 'se permitió');
exception when sqlstate 'PT429' then
  insert into resultados values ('W17 con 30 avisos en la última hora, la clave espera', true, sqlerrm);
end $$;
-- W18: la otra clave del mismo usuario sigue funcionando
do $$ declare c text; r jsonb; begin
  select clave into c from claves where nombre = 'iphone';
  r := registrar_pago_billetera(c, '10', 'Otra clave');
  insert into resultados values ('W18 el límite es por clave', r ->> 'estado' = 'recibido', r::text);
end $$;
commit;

-- W19-W22: permisos y tope de claves
begin;
set local role anon;
do $$ begin
  perform crear_clave_captura('x');
  insert into resultados values ('W19 sin sesión no se crean claves', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('W19 sin sesión no se crean claves', true, sqlerrm);
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
do $$ declare c text; vistas int; borradas int; begin
  select clave into c from claves where nombre = 'iphone';
  begin
    perform registrar_pago_billetera(c, '5');
    insert into resultados values ('W20 con sesión de usuario no se puede usar la función del atajo', false, 'se permitió');
  exception when insufficient_privilege then
    insert into resultados values ('W20 con sesión de usuario no se puede usar la función del atajo', true, sqlerrm);
  end;
  select count(*) into vistas from claves_captura;
  delete from claves_captura;
  get diagnostics borradas = row_count;
  insert into resultados values ('W21 G no ve ni revoca las claves de F', vistas = 0 and borradas = 0, format('vistas %s, borradas %s', vistas, borradas));
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
-- (En un bloque aparte: si el error de la sexta deshiciera también estas, W27 no cuadraría.)
do $$ declare i int; begin
  for i in 1 .. 3 loop perform crear_clave_captura('Extra ' || i); end loop; -- con iphone y limite: 5
end $$;
do $$ begin
  perform crear_clave_captura('La sexta');
  insert into resultados values ('W22 máximo 5 claves por usuario', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('W22 máximo 5 claves por usuario', true, sqlerrm);
end $$;
do $$ begin
  perform crear_clave_captura('   ');
  insert into resultados values ('W23 una clave necesita nombre', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('W23 una clave necesita nombre', true, sqlerrm);
end $$;

-- W24: confirmar el aviso captado crea el gasto con Apple Pay y crédito
do $$ declare cat uuid; aviso uuid; gid uuid; g gastos; antes numeric; despues numeric; begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select id into aviso from transacciones_detectadas where comercio = 'SUPERMAXI EL BOSQUE';
  select disponible into antes from cuentas where id = '7d100000-0000-4000-8000-000000000001';
  -- Primero la llamada y después la consulta: dentro de un WHERE correría una vez por fila.
  gid := confirmar_transaccion_detectada(aviso, 12.50, 'Supermaxi', cat, '7d100000-0000-4000-8000-000000000001');
  select * into g from gastos where id = gid;
  select disponible into despues from cuentas where id = '7d100000-0000-4000-8000-000000000001';
  insert into resultados values ('W24 confirmar el pago captado crea el gasto con Apple Pay, crédito y su lugar',
    g.billetera = 'apple_pay' and g.metodo_pago = 'credito' and g.lugar_id is not null and despues = antes - 12.50,
    format('billetera %s, método %s, cupo %s → %s', g.billetera, g.metodo_pago, antes, despues));
end $$;

-- W25: revocar (borrar) la clave la deja sin efecto y conserva los avisos
do $$ declare n int; begin
  delete from claves_captura where nombre = 'Mi iPhone';
  select count(*) into n from transacciones_detectadas where comercio like 'T13-%';
  insert into resultados values ('W25 revocar una clave conserva los avisos que ya llegaron', n = 4, n || ' avisos');
end $$;
commit;

begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'iphone';
  perform registrar_pago_billetera(c, '5', 'Después de revocar');
  insert into resultados values ('W26 una clave revocada ya no funciona', false, 'se permitió');
exception when invalid_authorization_specification then
  insert into resultados values ('W26 una clave revocada ya no funciona', true, sqlerrm);
end $$;
commit;

-- W27: eliminar la cuenta borra sus claves
do $$ declare antes int; despues int; begin
  select count(*) into antes from claves_captura where usuario_id = '7f000000-0000-4000-8000-000000000006';
  delete from auth.users where id = '7f000000-0000-4000-8000-000000000006';
  select count(*) into despues from claves_captura where usuario_id = '7f000000-0000-4000-8000-000000000006';
  insert into resultados values ('W27 eliminar la cuenta borra sus claves', antes = 4 and despues = 0, format('antes %s, después %s', antes, despues));
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
