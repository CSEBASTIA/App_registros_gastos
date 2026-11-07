-- Pruebas de la migración 20261025120000_planes_usuario.
-- Base DESECHABLE. Usuarios P y Q simulados con su JWT (propios de este archivo).

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email) values
  ('9b000000-0000-4000-8000-000000000001', 'p-planes@prueba.local'),
  ('9b000000-0000-4000-8000-000000000002', 'q-planes@prueba.local');

-- Avisos de RevenueCat (solo los campos que se usan).
create temp table avisos (nombre text primary key, evento jsonb);
insert into avisos values
  ('compra', '{"id":"e1","type":"INITIAL_PURCHASE","app_user_id":"9b000000-0000-4000-8000-000000000001","entitlement_ids":["plus"],"product_id":"fintrack_plus_mensual","environment":"PRODUCTION","event_timestamp_ms":1793000000000,"expiration_at_ms":1795600000000}'),
  ('cancela', '{"id":"e2","type":"CANCELLATION","app_user_id":"9b000000-0000-4000-8000-000000000001","entitlement_ids":null,"environment":"PRODUCTION","event_timestamp_ms":1793100000000,"expiration_at_ms":1795600000000}'),
  ('viejo', '{"id":"e3","type":"RENEWAL","app_user_id":"9b000000-0000-4000-8000-000000000001","entitlement_ids":["plus"],"environment":"PRODUCTION","event_timestamp_ms":1792000000000,"expiration_at_ms":1794000000000}'),
  ('vence', '{"id":"e4","type":"EXPIRATION","app_user_id":"9b000000-0000-4000-8000-000000000001","environment":"PRODUCTION","event_timestamp_ms":1795700000000,"expiration_at_ms":1795600000000}'),
  ('alias_pro', '{"id":"e5","type":"INITIAL_PURCHASE","app_user_id":"$RCAnonymousID:abc","aliases":["$RCAnonymousID:abc","9b000000-0000-4000-8000-000000000002"],"entitlement_ids":["pro"],"product_id":"fintrack_pro_mensual","environment":"SANDBOX","event_timestamp_ms":1793000000000,"expiration_at_ms":1793300000000}'),
  ('desconocido', '{"id":"e6","type":"INITIAL_PURCHASE","app_user_id":"9b000000-0000-4000-8000-0000000000ff","entitlement_ids":["pro"],"event_timestamp_ms":1793000000000}'),
  ('prueba', '{"id":"e7","type":"TEST","app_user_id":"cualquiera"}'),
  ('problema_cobro', '{"id":"e8","type":"BILLING_ISSUE","app_user_id":"9b000000-0000-4000-8000-000000000002","event_timestamp_ms":1793200000000}');

create or replace function pg_temp.aplicar(p_nombre text) returns text language sql as $$
  select registrar_evento_revenuecat((select evento from avisos where nombre = p_nombre)) $$;

do $$ declare r text; f planes_usuario%rowtype; begin
  r := pg_temp.aplicar('compra');
  select * into f from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000001';
  insert into resultados values ('P01 una compra deja el plan activo con su vencimiento',
    r = 'aplicado' and f.plan = 'plus' and f.estado = 'activa' and f.vence_en = to_timestamp(1795600000) and f.entorno = 'PRODUCTION',
    format('%s · %s %s %s', r, f.plan, f.estado, f.vence_en));
end $$;

do $$ declare r text; n int; begin
  r := pg_temp.aplicar('compra');
  select count(*) into n from eventos_pago where id = 'e1';
  insert into resultados values ('P02 un aviso repetido no se aplica dos veces', r = 'repetido' and n = 1, r);
end $$;

do $$ declare r text; f planes_usuario%rowtype; begin
  r := pg_temp.aplicar('cancela');
  select * into f from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000001';
  insert into resultados values ('P03 cancelar conserva el plan y su fecha de vencimiento',
    r = 'aplicado' and f.plan = 'plus' and f.estado = 'cancelada' and f.vence_en = to_timestamp(1795600000), format('%s · %s %s', r, f.plan, f.estado));
end $$;

do $$ declare r text; f planes_usuario%rowtype; begin
  r := pg_temp.aplicar('viejo');
  select * into f from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000001';
  insert into resultados values ('P04 un aviso más viejo que el último no pisa el estado',
    r = 'antiguo' and f.estado = 'cancelada' and f.vence_en = to_timestamp(1795600000), format('%s · %s', r, f.estado));
end $$;

do $$ declare r text; f planes_usuario%rowtype; begin
  r := pg_temp.aplicar('vence');
  select * into f from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000001';
  insert into resultados values ('P05 el vencimiento deja el plan vencido', r = 'aplicado' and f.estado = 'vencida', format('%s · %s', r, f.estado));
end $$;

do $$ declare r text; f planes_usuario%rowtype; begin
  r := pg_temp.aplicar('alias_pro');
  select * into f from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000002';
  insert into resultados values ('P06 la persona se reconoce por un alias de RevenueCat',
    r = 'aplicado' and f.plan = 'pro' and f.entorno = 'SANDBOX', format('%s · %s', r, f.plan));
end $$;

do $$ declare r text; n int; begin
  r := pg_temp.aplicar('desconocido');
  select count(*) into n from planes_usuario where usuario_id = '9b000000-0000-4000-8000-0000000000ff';
  insert into resultados values ('P07 un usuario que no existe se anota pero no recibe plan', r = 'usuario_desconocido' and n = 0, r);
end $$;

do $$ declare r1 text; r2 text; f planes_usuario%rowtype; begin
  r1 := pg_temp.aplicar('prueba');
  r2 := pg_temp.aplicar('problema_cobro');
  select * into f from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000002';
  insert into resultados values ('P08 el aviso de prueba y un problema de cobro no cambian el plan',
    r1 = 'prueba' and r2 = 'ignorado' and f.estado = 'activa', format('%s, %s · %s', r1, r2, f.estado));
end $$;

do $$ declare r text; begin
  begin
    r := registrar_evento_revenuecat('{"type":"RENEWAL"}');
    insert into resultados values ('P09 un aviso sin id se rechaza', false, r);
  exception when invalid_parameter_value then
    insert into resultados values ('P09 un aviso sin id se rechaza', true, sqlerrm);
  end;
end $$;

-- Desde la app: cada quien ve solo su plan y no puede escribirlo ni llamarse Pro.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ declare n int; total int; begin
  select count(*) into total from planes_usuario;
  select count(*) into n from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000001';
  insert into resultados values ('P10 la persona ve solo su plan', total = 1 and n = 1, total || ' filas visibles');
end $$;
do $$ begin
  update planes_usuario set plan = 'pro', estado = 'activa';
  insert into resultados values ('P11 la persona no puede cambiar su plan', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('P11 la persona no puede cambiar su plan', true, sqlerrm);
end $$;
do $$ begin
  insert into planes_usuario (usuario_id, plan, estado, ultimo_evento_en)
    values ('9b000000-0000-4000-8000-000000000001', 'pro', 'activa', now() + interval '1 day');
  insert into resultados values ('P12 la persona no puede darse un plan', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('P12 la persona no puede darse un plan', true, sqlerrm);
end $$;
do $$ begin
  perform registrar_evento_revenuecat('{"id":"x1","type":"INITIAL_PURCHASE","app_user_id":"9b000000-0000-4000-8000-000000000001","entitlement_ids":["pro"]}');
  insert into resultados values ('P13 la app no puede llamar a la función de pagos', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('P13 la app no puede llamar a la función de pagos', true, sqlerrm);
end $$;
do $$ declare n int; begin
  select count(*) into n from eventos_pago;
  insert into resultados values ('P14 la app no ve los avisos de pago', false, n || ' visibles');
exception when insufficient_privilege then
  insert into resultados values ('P14 la app no ve los avisos de pago', true, sqlerrm);
end $$;
commit;

do $$ declare n int; begin
  delete from auth.users where id = '9b000000-0000-4000-8000-000000000002';
  select (select count(*) from planes_usuario where usuario_id = '9b000000-0000-4000-8000-000000000002')
       + (select count(*) from eventos_pago where usuario_id = '9b000000-0000-4000-8000-000000000002') into n;
  insert into resultados values ('P15 eliminar la cuenta borra su plan y sus avisos de pago', n = 0, n || ' filas quedan');
end $$;

do $$ declare sin_fijar int; begin
  select count(*) into sin_fijar from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'registrar_evento_revenuecat'
    and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  insert into resultados values ('P16 la función con permisos elevados fija el search_path', sin_fijar = 0, sin_fijar || ' sin fijar');
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
