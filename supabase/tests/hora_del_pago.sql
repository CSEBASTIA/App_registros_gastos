-- Pruebas de la migración 20261016220000_hora_del_pago.
-- Base DESECHABLE. P es un usuario propio de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;
create temp table claves (nombre text primary key, clave text);
grant all on claves to authenticated, anon;

insert into auth.users (id, email) values ('7f000000-0000-4000-8000-00000000000f', 'p-hora@prueba.local')
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000f","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, identificador, disponible, cupo_total) values
  ('7d300000-0000-4000-8000-000000000001', 'Visa Produbanco P', 'credito', 'produbanco', '1234', 1000, 1000);
insert into claves values ('telefono', crear_clave_captura('Teléfono de P'));
-- Un aviso del correo, para comparar.
insert into transacciones_detectadas (id, mensaje_id, tipo, monto, descripcion, fecha, correo_asunto)
  values ('7d310000-0000-4000-8000-000000000001', 'msg-p-1', 'gasto', 9, 'Compra por correo', '2026-10-15', 'Consumo');
commit;

-- Apple Pay y Google Wallet llegan en transacciones aparte (como por la red).
begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'telefono';
  perform registrar_pago_billetera(c, '15.00', 'Farmacia', 'Produbanco Visa 1234');
end $$;
commit;

begin;
set local role anon;
do $$ declare c text; begin
  select clave into c from claves where nombre = 'telefono';
  -- La notificación de hace 2 días llegó recién (el teléfono estaba sin internet).
  perform registrar_aviso_billetera(c, 'Panadería', '$2.40 con Visa •••• 1234',
    'com.google.android.apps.walletnfcrel', (extract(epoch from now() - interval '2 days') * 1000)::bigint::text);
  -- Sin hora de la notificación (por ejemplo, desde MacroDroid).
  perform registrar_aviso_billetera(c, 'Kiosco', '$0.75 con Visa •••• 1234');
end $$;
commit;

-- H01: el aviso de Google Wallet guarda la hora de la notificación; el de Apple Pay no la necesita
do $$ declare gw transacciones_detectadas; ap transacciones_detectadas; begin
  select * into gw from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000f' and comercio = 'Panadería';
  select * into ap from transacciones_detectadas where usuario_id = '7f000000-0000-4000-8000-00000000000f' and comercio = 'Farmacia';
  insert into resultados values ('H01 el aviso de Google Wallet guarda la hora de la notificación (hace 2 días)',
    gw.pagado_en between now() - interval '2 days 1 minute' and now() - interval '2 days' + interval '1 minute'
      and gw.fecha = ((now() - interval '2 days') at time zone 'America/Guayaquil')::date
      and ap.pagado_en is null,
    format('Google Wallet %s (fecha %s), Apple Pay %s', gw.pagado_en, gw.fecha, coalesce(ap.pagado_en::text, 'null')));
end $$;

-- H02-H05: al confirmar, el gasto lleva la hora del pago
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7f000000-0000-4000-8000-00000000000f","role":"authenticated"}', true);
do $$
declare
  cat uuid;
  ap transacciones_detectadas;
  gw transacciones_detectadas;
  ki transacciones_detectadas;
  g_ap gastos;
  g_gw gastos;
  g_ki gastos;
  g_correo gastos;
  g_mano gastos;
  gid uuid;
begin
  select id into cat from categorias where nombre = 'Comida' and usuario_id is null;
  select * into ap from transacciones_detectadas where comercio = 'Farmacia';
  select * into gw from transacciones_detectadas where comercio = 'Panadería';
  select * into ki from transacciones_detectadas where comercio = 'Kiosco';

  gid := confirmar_transaccion_detectada(ap.id, 15, 'Farmacia', cat, '7d300000-0000-4000-8000-000000000001');
  select * into g_ap from gastos where id = gid;
  insert into resultados values ('H02 Apple Pay: el gasto guarda la hora en que llegó el aviso, no la de confirmación',
    g_ap.id is not null and g_ap.pagado_en = ap.created_at and g_ap.created_at > ap.created_at,
    format('pagado %s, registrado %s', g_ap.pagado_en, g_ap.created_at));

  gid := confirmar_transaccion_detectada(gw.id, 2.40, 'Panadería', cat, '7d300000-0000-4000-8000-000000000001');
  select * into g_gw from gastos where id = gid;
  insert into resultados values ('H03 Google Wallet atrasado: el gasto guarda la hora de la notificación y su fecha',
    g_gw.id is not null and g_gw.pagado_en = gw.pagado_en and g_gw.fecha = gw.fecha,
    format('pagado %s, fecha %s', g_gw.pagado_en, g_gw.fecha));

  gid := confirmar_transaccion_detectada(ki.id, 0.75, 'Kiosco', cat, null);
  select * into g_ki from gastos where id = gid;
  insert into resultados values ('H04 Google Wallet sin hora de la notificación: usa la hora en que llegó el aviso',
    g_ki.id is not null and g_ki.pagado_en = ki.created_at, format('pagado %s', g_ki.pagado_en));

  gid := confirmar_transaccion_detectada('7d310000-0000-4000-8000-000000000001', 9, 'Compra por correo', cat, null);
  select * into g_correo from gastos where id = gid;
  insert into gastos (monto, descripcion, categoria_id, fecha) values (3, 'Café', cat, '2026-10-16') returning * into g_mano;
  insert into resultados values ('H05 un aviso del correo o un gasto a mano no tienen hora del pago',
    g_correo.id is not null and g_correo.pagado_en is null and g_mano.pagado_en is null,
    format('correo %s, a mano %s', coalesce(g_correo.pagado_en::text, 'null'), coalesce(g_mano.pagado_en::text, 'null')));

  begin
    insert into gastos (monto, descripcion, categoria_id, fecha, pagado_en) values (1, 'Viejo', cat, '2026-10-16', '1990-01-01');
    insert into resultados values ('H06 una hora del pago absurda se rechaza', false, 'se permitió');
  exception when check_violation then
    insert into resultados values ('H06 una hora del pago absurda se rechaza', true, sqlerrm);
  end;
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
