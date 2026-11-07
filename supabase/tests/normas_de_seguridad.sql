-- Pruebas de la migración 20261107130000_normas_de_seguridad.
-- Base DESECHABLE. W es un usuario propio de este archivo.

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

do $$ declare n int; cuales text; begin
  select count(*), string_agg(p.proname, ', ') into n, cuales
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  insert into resultados values ('N01 ninguna función de disparador se puede llamar por la API', n = 0, coalesce(cuales, 'ninguna'));
end $$;

do $$ begin
  insert into resultados values ('N02 el atajo de Apple Pay y Google Wallet sigue pudiendo llamar sin sesión',
    has_function_privilege('anon', 'public.registrar_pago_billetera(text, text, text, text, text, text, text, text)', 'execute')
      and has_function_privilege('anon', 'public.registrar_aviso_billetera(text, text, text, text, text)', 'execute'),
    'ok');
end $$;

do $$ declare sin_fijar int; begin
  select count(*) into sin_fijar from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'distancia_m'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  insert into resultados values ('N03 distancia_m fija su search_path', sin_fijar = 0, sin_fijar || ' sin fijar');
end $$;

-- Los disparadores siguen funcionando sin ese permiso: un gasto baja el saldo.
insert into auth.users (id, email) values ('7c000000-0000-4000-8000-000000000001', 'w-seguridad@prueba.local') on conflict (id) do nothing;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7c000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, banco, disponible) values ('7c900000-0000-4000-8000-000000000001', 'Ahorro W', 'ahorro', 'pichincha', 100);
do $$ declare d numeric; begin
  insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha)
    values (30, 'Compra', (select id from categorias where nombre = 'Comida' and usuario_id is null), '7c900000-0000-4000-8000-000000000001', '2026-11-07');
  select disponible into d from cuentas where id = '7c900000-0000-4000-8000-000000000001';
  insert into resultados values ('N04 los disparadores siguen moviendo el saldo', d = 70, 'saldo ' || d);
end $$;
do $$ begin
  perform aplicar_gasto_a_cuenta();
  insert into resultados values ('N05 la app no puede llamar una función de disparador', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('N05 la app no puede llamar una función de disparador', true, sqlerrm);
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
