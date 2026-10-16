-- Pruebas de la migración 20261016210000_aceptaciones_legales.
-- Base DESECHABLE. Usuarios G, H, I y J simulados con su JWT (propios de este archivo).

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

-- ---------------------------------------------------------------------
-- Registro: la aceptación viaja en los datos del usuario y el disparador
-- la anota con la hora del servidor.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('8a000000-0000-4000-8000-000000000001', 'g-legal@prueba.local',
   '{"acepta_terminos":"2026-10-16","acepta_privacidad":"2026-10-16","plataforma":"android"}'),
  ('8a000000-0000-4000-8000-000000000002', 'h-legal@prueba.local', '{}'),
  ('8a000000-0000-4000-8000-000000000003', 'i-legal@prueba.local',
   '{"acepta_terminos":"hoy","acepta_privacidad":"2099-01-01","plataforma":"nave"}'),
  ('8a000000-0000-4000-8000-000000000004', 'j-legal@prueba.local',
   '{"acepta_terminos":"2026-10-16"}');

do $$ declare n int; o text; p text; ahora boolean; begin
  select count(*), min(origen), min(plataforma), bool_and(aceptado_en > now() - interval '1 minute')
    into n, o, p, ahora
  from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000001';
  insert into resultados values ('L01 el registro anota términos y privacidad con la hora del servidor',
    n = 2 and o = 'registro' and p = 'android' and ahora, format('%s filas, origen %s, plataforma %s', n, o, p));
end $$;

do $$ declare n int; begin
  select count(*) into n from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000002';
  insert into resultados values ('L02 sin aceptación en el registro no se anota nada (y la cuenta se crea)',
    n = 0 and exists (select 1 from auth.users where id = '8a000000-0000-4000-8000-000000000002'), n || ' filas');
end $$;

do $$ declare n int; plat text; begin
  select count(*), min(plataforma) into n, plat from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000003';
  insert into resultados values ('L03 versiones inventadas (texto, futuro) se ignoran sin romper el registro',
    n = 0 and exists (select 1 from auth.users where id = '8a000000-0000-4000-8000-000000000003'), n || ' filas');
end $$;

do $$ declare n int; docs text; begin
  select count(*), min(documento) into n, docs from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000004';
  insert into resultados values ('L04 si solo marcó un documento, solo se anota ese', n = 1 and docs = 'terminos', n || ' filas, ' || coalesce(docs, '-'));
end $$;

-- ---------------------------------------------------------------------
-- Lectura: cada persona ve solo lo suyo.
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ declare n int; ajenas int; begin
  select count(*), count(*) filter (where usuario_id <> '8a000000-0000-4000-8000-000000000001') into n, ajenas from aceptaciones_legales;
  insert into resultados values ('L05 G ve sus 2 aceptaciones y ninguna ajena', n = 2 and ajenas = 0, format('%s propias, %s ajenas', n, ajenas));
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from aceptaciones_legales;
  insert into resultados values ('L06 H no ve las aceptaciones de G, I ni J', n = 0, n || ' filas visibles');
end $$;
commit;

begin;
set local role anon;
do $$ begin
  perform count(*) from aceptaciones_legales;
  insert into resultados values ('L07 sin sesión no se puede leer', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L07 sin sesión no se puede leer', true, sqlerrm);
end $$;
commit;

-- ---------------------------------------------------------------------
-- Escritura: solo por la función; nada directo, ni siquiera lo propio.
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  insert into aceptaciones_legales (usuario_id, documento, version, origen)
    values ('8a000000-0000-4000-8000-000000000002', 'terminos', '2026-10-16', 'app');
  insert into resultados values ('L08 no se puede insertar directo (ni lo propio)', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L08 no se puede insertar directo (ni lo propio)', true, sqlerrm);
end $$;
do $$ begin
  update aceptaciones_legales set version = '2026-10-17' where usuario_id = '8a000000-0000-4000-8000-000000000002';
  insert into resultados values ('L09 no se puede modificar una aceptación', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L09 no se puede modificar una aceptación', true, sqlerrm);
end $$;
do $$ begin
  delete from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000002';
  insert into resultados values ('L10 no se puede borrar una aceptación a mano', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L10 no se puede borrar una aceptación a mano', true, sqlerrm);
end $$;
commit;

-- ---------------------------------------------------------------------
-- La función registrar_aceptacion_legal.
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select registrar_aceptacion_legal('terminos', '2026-10-16', 'web');
select registrar_aceptacion_legal('privacidad', '2026-10-16', 'web');
do $$ declare n int; o text; begin
  select count(*), min(origen) into n, o from aceptaciones_legales;
  insert into resultados values ('L11 H acepta desde la app: se anotan los dos con origen "app"', n = 2 and o = 'app', format('%s filas, origen %s', n, o));
end $$;
-- Repetir la misma versión no duplica ni cambia la primera fecha.
do $$ declare antes timestamptz; despues timestamptz; n int; begin
  select aceptado_en into antes from aceptaciones_legales where documento = 'terminos';
  perform pg_sleep(1);
  perform registrar_aceptacion_legal('terminos', '2026-10-16', 'android');
  select aceptado_en, (select count(*) from aceptaciones_legales) into despues, n from aceptaciones_legales where documento = 'terminos';
  insert into resultados values ('L12 repetir la misma versión es idempotente y conserva la primera fecha', n = 2 and antes = despues, format('%s filas', n));
end $$;
-- Una versión nueva se suma, no reemplaza: queda el historial.
select registrar_aceptacion_legal('terminos', '2026-10-17', 'web');
do $$ declare n int; begin
  select count(*) into n from aceptaciones_legales where documento = 'terminos';
  insert into resultados values ('L13 una versión nueva se suma al historial (no reemplaza la anterior)', n = 2, n || ' de términos');
end $$;
commit;

-- Entradas inválidas.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform registrar_aceptacion_legal('cookies', '2026-10-16');
  insert into resultados values ('L14 documento desconocido rechazado', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('L14 documento desconocido rechazado', true, sqlerrm);
end $$;
do $$ begin
  perform registrar_aceptacion_legal('terminos', 'hoy');
  insert into resultados values ('L15 versión que no es fecha rechazada', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('L15 versión que no es fecha rechazada', true, sqlerrm);
end $$;
do $$ begin
  perform registrar_aceptacion_legal('terminos', '2099-01-01');
  insert into resultados values ('L16 versión del futuro rechazada', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('L16 versión del futuro rechazada', true, sqlerrm);
end $$;
do $$ begin
  perform registrar_aceptacion_legal('terminos', '2020-01-01');
  insert into resultados values ('L17 versión anterior a los primeros documentos rechazada', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('L17 versión anterior a los primeros documentos rechazada', true, sqlerrm);
end $$;
do $$ begin
  perform registrar_aceptacion_legal('terminos', '2026-10-16', 'nave');
  insert into resultados values ('L18 plataforma desconocida rechazada', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('L18 plataforma desconocida rechazada', true, sqlerrm);
end $$;
do $$ begin
  perform registrar_aceptacion_legal('terminos'' or ''1''=''1', '2026-10-16');
  insert into resultados values ('L19 texto con comillas (inyección) rechazado como documento', false, 'se permitió');
exception when invalid_parameter_value then
  insert into resultados values ('L19 texto con comillas (inyección) rechazado como documento', true, sqlerrm);
end $$;
commit;

-- Sin sesión, ni la función.
begin;
set local role anon;
do $$ begin
  perform registrar_aceptacion_legal('terminos', '2026-10-16');
  insert into resultados values ('L20 sin sesión no se puede aceptar', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L20 sin sesión no se puede aceptar', true, sqlerrm);
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$ begin
  perform registrar_aceptacion_legal('terminos', '2026-10-16');
  insert into resultados values ('L21 con rol pero sin usuario identificado tampoco', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L21 con rol pero sin usuario identificado tampoco', true, sqlerrm);
end $$;
commit;

-- Una persona no puede aceptar a nombre de otra: la función usa su propia identidad.
do $$ declare n int; begin
  select count(*) into n from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000003';
  insert into resultados values ('L22 no se puede aceptar a nombre de otra persona (I sigue sin aceptaciones)', n = 0, n || ' filas de I');
end $$;

-- Tope de filas por persona (defensa contra llenar la tabla).
insert into auth.users (id, email) values ('8a000000-0000-4000-8000-000000000005', 'k-legal@prueba.local');
insert into aceptaciones_legales (usuario_id, documento, version, origen)
  select '8a000000-0000-4000-8000-000000000005', 'terminos', to_char(date '2026-10-01' + g, 'YYYY-MM-DD'), 'app'
  from generate_series(0, 49) g;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$ begin
  perform registrar_aceptacion_legal('privacidad', '2026-10-16');
  insert into resultados values ('L23 tope de 50 aceptaciones por persona', false, 'se permitió');
exception when program_limit_exceeded then
  insert into resultados values ('L23 tope de 50 aceptaciones por persona', true, sqlerrm);
end $$;
commit;

-- ---------------------------------------------------------------------
-- Eliminar la cuenta borra también sus aceptaciones (cascada).
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select eliminar_mi_cuenta('ELIMINAR');
commit;
do $$ declare n int; otras int; begin
  select count(*) into n from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000001';
  select count(*) into otras from aceptaciones_legales where usuario_id = '8a000000-0000-4000-8000-000000000002';
  insert into resultados values ('L24 eliminar la cuenta borra sus aceptaciones y deja las de otros', n = 0 and otras = 3, format('G: %s, H: %s', n, otras));
end $$;

-- ---------------------------------------------------------------------
-- Seguridad de las funciones internas.
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform es_version_legal('2026-10-16');
  insert into resultados values ('L25 es_version_legal no es llamable desde la API', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('L25 es_version_legal no es llamable desde la API', true, sqlerrm);
end $$;
commit;

do $$ declare sin_fijar int; begin
  -- Toda función security definer de esta migración fija el search_path.
  select count(*) into sin_fijar from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('registrar_aceptacion_legal', 'anotar_aceptaciones_del_registro')
    and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  insert into resultados values ('L26 las funciones con permisos elevados fijan el search_path', sin_fijar = 0, sin_fijar || ' sin fijar');
end $$;

-- ---------------------------------------------------------------------
-- La promesa de la política de privacidad: eliminar la cuenta borra TODO.
-- Toda tabla de public con `usuario_id` debe borrarse en cascada con el usuario.
-- Si alguien agrega una tabla de datos personales sin cascada, esto falla.
-- ---------------------------------------------------------------------
do $$ declare sin_cascada text; n int; begin
  select count(*), string_agg(c.table_name, ', ') into n, sin_cascada
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.column_name = 'usuario_id'
    and not exists (
      select 1 from pg_constraint k
      where k.contype = 'f' and k.conrelid = format('public.%I', c.table_name)::regclass
        and k.confrelid = 'auth.users'::regclass and k.confdeltype = 'c'
        and k.conkey = array[(select attnum from pg_attribute where attrelid = k.conrelid and attname = 'usuario_id')]
    );
  insert into resultados values ('L27 toda tabla con usuario_id se borra en cascada al eliminar la cuenta', n = 0, coalesce(sin_cascada, 'todas con cascada'));
end $$;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
