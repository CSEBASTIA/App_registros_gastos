-- Pruebas de la migración 20261016211000_exportar_datos_persona.
-- Base DESECHABLE. Usuarias M y N simuladas con su JWT (propias de este archivo).

\set ON_ERROR_STOP 1
create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('8b000000-0000-4000-8000-000000000001', 'Maria-Export@Prueba.Local',
   '{"acepta_terminos":"2026-10-16","acepta_privacidad":"2026-10-16","plataforma":"web"}'),
  ('8b000000-0000-4000-8000-000000000002', 'nora-export@prueba.local', '{}');

-- Datos de M, creados con su sesión (así pasan por RLS y por los disparadores reales).
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8b000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, disponible) values ('8b100000-0000-4000-8000-000000000001', 'Ahorro de M', 'ahorro', 500);
insert into gastos (monto, descripcion, categoria_id, fecha, cuenta_id, latitud, longitud)
  values (12.5, 'Gasto de M', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', '8b100000-0000-4000-8000-000000000001', -0.1500, -78.4800);
insert into ingresos (monto, descripcion, cuenta_id) values (100, 'Sueldo de M', '8b100000-0000-4000-8000-000000000001');
insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual)
  values ('8b300000-0000-4000-8000-000000000001', 'Préstamo de M', 'prestamo', 300, 300, 30);
select crear_clave_captura('iPhone de M');
commit;

-- Datos de N: no deben aparecer en la copia de M.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, disponible) values ('8b100000-0000-4000-8000-000000000002', 'Ahorro de N', 'ahorro', 900);
insert into gastos (monto, descripcion, categoria_id, fecha, cuenta_id)
  values (7, 'Gasto de N', (select id from categorias where nombre = 'Comida' and usuario_id is null), '2026-10-16', '8b100000-0000-4000-8000-000000000002');
commit;

insert into storage.objects (bucket_id, name) values
  ('facturas', '8b000000-0000-4000-8000-000000000001/factura-de-m.pdf'),
  ('facturas', '8b000000-0000-4000-8000-000000000002/factura-de-n.pdf');

-- La copia, tal como la sacaría quien administra (con el correo en otras mayúsculas y con espacios).
create temp table copia as select public.exportar_datos_persona('  MARIA-export@prueba.local ') as j;

do $$ declare j jsonb := (select j from copia); begin
  insert into resultados values ('X01 encuentra la cuenta sin importar mayúsculas ni espacios en el correo',
    j #>> '{cuenta,correo}' = 'Maria-Export@Prueba.Local' and j #>> '{cuenta,id}' = '8b000000-0000-4000-8000-000000000001', j #>> '{cuenta,correo}');
end $$;

do $$ declare j jsonb := (select j from copia); begin
  insert into resultados values ('X02 trae todo lo de M: cuenta, gasto, ingreso, deuda, lugar, clave, 2 aceptaciones y 1 factura',
    jsonb_array_length(j -> 'cuentas') = 1 and jsonb_array_length(j -> 'gastos') = 1 and jsonb_array_length(j -> 'ingresos') = 1
    and jsonb_array_length(j -> 'deudas') = 1 and jsonb_array_length(j -> 'lugares') = 1 and jsonb_array_length(j -> 'claves_captura') = 1
    and jsonb_array_length(j -> 'aceptaciones_legales') = 2 and jsonb_array_length(j -> 'facturas_guardadas') = 1,
    format('cuentas %s, gastos %s, ingresos %s, deudas %s, lugares %s, claves %s, aceptaciones %s, facturas %s',
      jsonb_array_length(j -> 'cuentas'), jsonb_array_length(j -> 'gastos'), jsonb_array_length(j -> 'ingresos'), jsonb_array_length(j -> 'deudas'),
      jsonb_array_length(j -> 'lugares'), jsonb_array_length(j -> 'claves_captura'), jsonb_array_length(j -> 'aceptaciones_legales'), jsonb_array_length(j -> 'facturas_guardadas')));
end $$;

do $$ declare t text := (select j::text from copia); begin
  insert into resultados values ('X03 no se mezcla nada de otra persona (ni gasto, ni cuenta, ni factura de N)',
    t not like '%Gasto de N%' and t not like '%Ahorro de N%' and t not like '%factura-de-n%' and t like '%Gasto de M%' and t like '%factura-de-m%',
    'sin datos de N');
end $$;

do $$ declare j jsonb := (select j from copia); begin
  insert into resultados values ('X04 la clave de captura sale sin la huella (solo nombre y prefijo)',
    not ((j -> 'claves_captura' -> 0) ? 'huella') and (j -> 'claves_captura' -> 0) ? 'prefijo' and j #>> '{claves_captura,0,nombre}' = 'iPhone de M',
    (j -> 'claves_captura' -> 0)::text);
end $$;

do $$ declare j jsonb := (select j from copia); begin
  insert into resultados values ('X05 las filas no repiten el id de usuario (ya está en "cuenta")',
    not ((j -> 'gastos' -> 0) ? 'usuario_id') and not ((j -> 'cuentas' -> 0) ? 'usuario_id'), 'sin usuario_id');
end $$;

do $$ declare faltan text; n int; j jsonb := (select j from copia); begin
  select count(*), string_agg(c.table_name, ', ') into n, faltan
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.column_name = 'usuario_id' and not (j ? c.table_name);
  insert into resultados values ('X06 TODA tabla con usuario_id aparece en la copia (si agregas una, hay que añadirla)',
    n = 0, coalesce('faltan: ' || faltan, 'ninguna falta'));
end $$;

do $$ begin
  perform public.exportar_datos_persona('nadie@prueba.local');
  insert into resultados values ('X07 un correo sin cuenta da error claro', false, 'se permitió');
exception when no_data_found then
  insert into resultados values ('X07 un correo sin cuenta da error claro', true, sqlerrm);
end $$;

-- Solo administración: ni sin sesión ni con sesión de usuario.
begin;
set local role anon;
do $$ begin
  perform public.exportar_datos_persona('maria-export@prueba.local');
  insert into resultados values ('X08 sin sesión no se puede exportar', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('X08 sin sesión no se puede exportar', true, sqlerrm);
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform public.exportar_datos_persona('maria-export@prueba.local');
  insert into resultados values ('X09 una persona con sesión no puede exportar los datos de otra', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('X09 una persona con sesión no puede exportar los datos de otra', true, sqlerrm);
end $$;
commit;

-- Segunda barrera: aunque alguien le diera permiso por error, la función se niega.
-- (Con `commit`, no `rollback`: un rollback descartaría también el resultado de la prueba.)
begin;
grant execute on function public.exportar_datos_persona(text) to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform public.exportar_datos_persona('maria-export@prueba.local');
  insert into resultados values ('X10 aunque se concediera el permiso por error, la función se niega a un usuario de la API', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('X10 aunque se concediera el permiso por error, la función se niega a un usuario de la API', true, sqlerrm);
end $$;
commit;
revoke all on function public.exportar_datos_persona(text) from public, anon, authenticated;

-- Quien administra la corre desde el SQL Editor de Supabase, que usa el rol `postgres`
-- (no un superusuario). Con ese rol RLS no debe estorbar: la copia sale completa.
grant all on resultados to postgres;
begin;
set local role postgres;
do $$ declare j jsonb; begin
  j := public.exportar_datos_persona('maria-export@prueba.local');
  insert into resultados values ('X11 con el rol postgres (el del SQL Editor) la copia sale completa a pesar de RLS',
    jsonb_array_length(j -> 'cuentas') = 1 and jsonb_array_length(j -> 'gastos') = 1 and jsonb_array_length(j -> 'ingresos') = 1
    and jsonb_array_length(j -> 'aceptaciones_legales') = 2 and jsonb_array_length(j -> 'facturas_guardadas') = 1
    and not (j::text like '%Gasto de N%'),
    format('cuentas %s, gastos %s, aceptaciones %s, facturas %s', jsonb_array_length(j -> 'cuentas'), jsonb_array_length(j -> 'gastos'),
      jsonb_array_length(j -> 'aceptaciones_legales'), jsonb_array_length(j -> 'facturas_guardadas')));
end $$;
commit;

select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
