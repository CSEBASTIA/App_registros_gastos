-- Migración de aceptación de términos y privacidad.
--
-- La Ley Orgánica de Protección de Datos Personales de Ecuador pide un
-- consentimiento que se pueda demostrar, y los términos y condiciones solo
-- obligan a quien los aceptó. Esta migración guarda, por persona, qué
-- documento aceptó (términos o privacidad), qué versión y cuándo.
--
-- 1) Tabla `aceptaciones_legales`: la persona solo puede LEER lo suyo. Nadie la
--    escribe directo (ni ella misma): así la fecha la pone el servidor y la
--    prueba no se puede maquillar ni borrar a mano. Se borra en cascada al
--    eliminar la cuenta, igual que el resto de sus datos.
-- 2) `registrar_aceptacion_legal`: lo que llama la app cuando alguien acepta
--    una versión nueva (o la primera, en las cuentas anteriores a esta migración).
-- 3) Disparador en `auth.users`: al registrarse, la app manda en los datos del
--    usuario (`acepta_terminos`, `acepta_privacidad`, `plataforma`) la versión
--    que la persona marcó. Con confirmación por correo, `signUp` no deja sesión
--    hasta que confirma; por eso la aceptación se anota aquí, en el servidor,
--    en el mismo momento de crear la cuenta.
--
-- Las versiones son fechas (`2026-10-16`): la de la última revisión del texto.
-- Deben coincidir con `VERSION_LEGAL` de packages/core y con la etiqueta
-- `version-legal` de apps/mobile/public/{terminos,privacidad}.html.

create table if not exists public.aceptaciones_legales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  documento text not null check (documento in ('terminos', 'privacidad')),
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  plataforma text check (plataforma in ('android', 'ios', 'web')),
  -- 'registro': al crear la cuenta; 'app': después, desde la pantalla de aceptación.
  origen text not null check (origen in ('registro', 'app')),
  aceptado_en timestamptz not null default now(),
  unique (usuario_id, documento, version)
);

alter table public.aceptaciones_legales enable row level security;

-- Solo lectura de lo propio. Sin insert/update/delete para nadie desde la API.
revoke all on public.aceptaciones_legales from anon, authenticated;
grant select on public.aceptaciones_legales to authenticated;

drop policy if exists "aceptaciones_legales: select propio" on public.aceptaciones_legales;
create policy "aceptaciones_legales: select propio" on public.aceptaciones_legales
  for select to authenticated using ((select auth.uid()) = usuario_id);

-- Una versión es creíble si es una fecha entre los primeros documentos
-- (2026-10-01) y mañana. Acota los valores posibles: nadie puede llenar la
-- tabla con versiones inventadas.
create or replace function public.es_version_legal(p_version text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_version ~ '^\d{4}-\d{2}-\d{2}$'
    and p_version >= '2026-10-01'
    and p_version <= to_char(current_date + 1, 'YYYY-MM-DD');
$$;

revoke all on function public.es_version_legal(text) from public, anon, authenticated;

create or replace function public.registrar_aceptacion_legal(
  p_documento text,
  p_version text,
  p_plataforma text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_documento is null or p_documento not in ('terminos', 'privacidad') then
    raise exception 'Documento legal desconocido.' using errcode = '22023';
  end if;
  if not coalesce(public.es_version_legal(p_version), false) then
    raise exception 'Versión del documento no válida.' using errcode = '22023';
  end if;
  if p_plataforma is not null and p_plataforma not in ('android', 'ios', 'web') then
    raise exception 'Plataforma no válida.' using errcode = '22023';
  end if;
  -- Tope por si alguien intenta llenar la tabla con versiones distintas.
  if (select count(*) from public.aceptaciones_legales where usuario_id = v_usuario) >= 50 then
    raise exception 'Demasiadas aceptaciones registradas.' using errcode = '54000';
  end if;

  -- Repetir la misma versión no cambia nada (conserva la primera fecha).
  insert into public.aceptaciones_legales (usuario_id, documento, version, plataforma, origen)
  values (v_usuario, p_documento, p_version, p_plataforma, 'app')
  on conflict (usuario_id, documento, version) do nothing;
end;
$$;

revoke all on function public.registrar_aceptacion_legal(text, text, text) from public, anon;
grant execute on function public.registrar_aceptacion_legal(text, text, text) to authenticated;

-- Aceptación hecha en el registro. Nunca debe impedir crear la cuenta: si algo
-- falla, avisa y sigue; la app volverá a pedir la aceptación al entrar.
create or replace function public.anotar_aceptaciones_del_registro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_documento text;
  v_version text;
  v_plataforma text := new.raw_user_meta_data ->> 'plataforma';
begin
  if v_plataforma is not null and v_plataforma not in ('android', 'ios', 'web') then
    v_plataforma := null;
  end if;
  foreach v_documento in array array['terminos', 'privacidad'] loop
    v_version := new.raw_user_meta_data ->> ('acepta_' || v_documento);
    if coalesce(public.es_version_legal(v_version), false) then
      insert into public.aceptaciones_legales (usuario_id, documento, version, plataforma, origen)
      values (new.id, v_documento, v_version, v_plataforma, 'registro')
      on conflict (usuario_id, documento, version) do nothing;
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'No se pudo anotar la aceptación legal de %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.anotar_aceptaciones_del_registro() from public, anon, authenticated;

drop trigger if exists aceptaciones_del_registro on auth.users;
create trigger aceptaciones_del_registro
  after insert on auth.users
  for each row execute function public.anotar_aceptaciones_del_registro();
