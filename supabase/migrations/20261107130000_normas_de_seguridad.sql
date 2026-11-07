-- Migración de normas de seguridad (lo que marcó el asesor de Supabase).
--
-- 1) Las funciones de los disparadores (aplicar_gasto_a_cuenta,
--    revertir_transferencia, validar_referencias_propias…) se podían llamar
--    por la API (/rest/v1/rpc/…), incluso sin iniciar sesión, y varias son
--    `security definer`. Hoy fallan si se llaman así (solo corren como
--    disparador), pero no tienen por qué estar expuestas: se les quita el
--    permiso a public, anon y authenticated. Un disparador no necesita ese
--    permiso para dispararse. Se revisan TODAS las funciones de disparador de
--    `public`, incluidas las que se agreguen antes de esta migración.
--    Siguen abiertas a propósito: `registrar_pago_billetera` y
--    `registrar_aviso_billetera` (las llama el atajo de Apple Pay y Google
--    Wallet con su clave de captura, sin sesión).
-- 2) `distancia_m` fija su search_path, como las demás funciones.
-- 3) Las reglas de `lugares` y `claves_captura` calculan auth.uid() una vez
--    por consulta y no una por fila, como el resto (prueba R1).

-- 1) Funciones de disparador fuera de la API -------------------------------

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- Y las que se creen después en public no nacen expuestas a anon.
alter default privileges in schema public revoke execute on functions from anon;

-- 2) search_path fijo -----------------------------------------------------

alter function public.distancia_m(numeric, numeric, numeric, numeric) set search_path = pg_catalog, pg_temp;

-- 3) auth.uid() una vez por consulta ---------------------------------------

drop policy if exists "lugares: select propio" on public.lugares;
create policy "lugares: select propio" on public.lugares
  for select to authenticated using ((select auth.uid()) = usuario_id);
drop policy if exists "lugares: insert propio" on public.lugares;
create policy "lugares: insert propio" on public.lugares
  for insert to authenticated with check ((select auth.uid()) = usuario_id);
drop policy if exists "lugares: update propio" on public.lugares;
create policy "lugares: update propio" on public.lugares
  for update to authenticated using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
drop policy if exists "lugares: delete propio" on public.lugares;
create policy "lugares: delete propio" on public.lugares
  for delete to authenticated using ((select auth.uid()) = usuario_id);

drop policy if exists "claves_captura: select propio" on public.claves_captura;
create policy "claves_captura: select propio" on public.claves_captura
  for select to authenticated using ((select auth.uid()) = usuario_id);
drop policy if exists "claves_captura: delete propio" on public.claves_captura;
create policy "claves_captura: delete propio" on public.claves_captura
  for delete to authenticated using ((select auth.uid()) = usuario_id);
