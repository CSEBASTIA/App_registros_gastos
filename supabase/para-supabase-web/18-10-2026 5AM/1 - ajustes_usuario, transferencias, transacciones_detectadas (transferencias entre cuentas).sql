-- =====================================================================
-- gastos-app — Migración de transferencias entre cuentas y ajustes · 18-10-2026 5AM
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261018120000_ajustes_y_transferencias.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261018120000_ajustes_y_transferencias.sql
-- Migración de ajustes y transferencias entre cuentas propias.
--
-- 1) Ajustes por usuario (`ajustes_usuario`). Por ahora uno solo:
--    `registro_automatico`, si la base registra sola lo que reconoce con
--    seguridad (transferencias emparejadas aquí y, en la migración
--    siguiente, pagos con billetera cuya tarjeta se reconoce por sus
--    últimos dígitos). Encendido por defecto: quien no tiene fila, lo tiene
--    encendido. Se apaga desde la app.
-- 2) Transferencias entre cuentas propias (`transferencias`): restan de una
--    cuenta y suman a otra en el mismo paso, y NO son gasto ni ingreso (no
--    cuentan en el balance del mes ni en los presupuestos). Como los demás
--    movimientos de dinero, los saldos los mueven triggers. No se editan
--    (salvo descripción y fecha): se borran y se registran de nuevo.
--    A una tarjeta de crédito no se transfiere: eso es «Pagar tarjeta».
-- 3) Avisos del correo: si llega una transferencia «enviada» desde una
--    cuenta tuya y una «recibida» en otra cuenta tuya, por el mismo monto y
--    con hasta 2 días de diferencia, la base las junta y registra UNA
--    transferencia, en vez de un gasto y un ingreso que inflarían los dos.
--    Si hay más de una candidata, no adivina: quedan en la bandeja.
-- 4) Desde la bandeja, un aviso del correo se puede confirmar como
--    transferencia; y una transferencia que se juntó sola se puede separar
--    (vuelven los dos avisos a la bandeja).
-- Sin SQL dinámico; search_path fijo en todas las funciones.

-- 1) Ajustes por usuario ------------------------------------------------

create table if not exists public.ajustes_usuario (
  usuario_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  registro_automatico boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.ajustes_usuario enable row level security;
revoke all on public.ajustes_usuario from anon;

drop policy if exists "ajustes_usuario: select propio" on public.ajustes_usuario;
create policy "ajustes_usuario: select propio" on public.ajustes_usuario
  for select to authenticated using ((select auth.uid()) = usuario_id);
drop policy if exists "ajustes_usuario: insert propio" on public.ajustes_usuario;
create policy "ajustes_usuario: insert propio" on public.ajustes_usuario
  for insert to authenticated with check ((select auth.uid()) = usuario_id);
drop policy if exists "ajustes_usuario: update propio" on public.ajustes_usuario;
create policy "ajustes_usuario: update propio" on public.ajustes_usuario
  for update to authenticated using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);

-- Sin fila = encendido. Solo la usan las funciones de la base.
create or replace function public.registro_automatico_activo(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select registro_automatico from ajustes_usuario where usuario_id = p_usuario), true)
$$;

revoke all on function public.registro_automatico_activo(uuid) from public, anon, authenticated;

-- 2) Transferencias -----------------------------------------------------

create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- SET NULL: borrar una cuenta no borra la transferencia ni cambia el saldo
  -- de la otra (como la cuenta de origen de un pago de tarjeta).
  cuenta_origen_id uuid references public.cuentas(id) on delete set null,
  cuenta_destino_id uuid references public.cuentas(id) on delete set null,
  monto numeric(12, 2) not null check (monto > 0),
  fecha date not null default current_date,
  descripcion text check (descripcion is null or char_length(descripcion) <= 200),
  -- 'correo': la juntó la base a partir de dos avisos, o se confirmó desde la bandeja.
  origen text not null default 'manual' check (origen in ('manual', 'correo')),
  created_at timestamptz not null default now(),
  constraint transferencias_cuentas_distintas
    check (cuenta_origen_id is null or cuenta_destino_id is null or cuenta_origen_id <> cuenta_destino_id)
);

create index if not exists transferencias_usuario_fecha_idx on public.transferencias (usuario_id, fecha desc);
create index if not exists transferencias_cuenta_origen_idx on public.transferencias (cuenta_origen_id);
create index if not exists transferencias_cuenta_destino_idx on public.transferencias (cuenta_destino_id);

alter table public.transferencias enable row level security;
revoke all on public.transferencias from anon;

drop policy if exists "transferencias: select propio" on public.transferencias;
create policy "transferencias: select propio" on public.transferencias
  for select to authenticated using ((select auth.uid()) = usuario_id);
drop policy if exists "transferencias: insert propio" on public.transferencias;
create policy "transferencias: insert propio" on public.transferencias
  for insert to authenticated with check ((select auth.uid()) = usuario_id);
drop policy if exists "transferencias: update propio" on public.transferencias;
create policy "transferencias: update propio" on public.transferencias
  for update to authenticated using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
drop policy if exists "transferencias: delete propio" on public.transferencias;
create policy "transferencias: delete propio" on public.transferencias
  for delete to authenticated using ((select auth.uid()) = usuario_id);

-- Antes de guardar: las dos cuentas son del usuario, distintas, el destino
-- no es una tarjeta de crédito y, si el origen es una tarjeta (avance de
-- efectivo), alcanza el cupo.
create or replace function public.validar_transferencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Con sesión de usuario manda auth.uid(); desde una función de la base
  -- (sin sesión), el dueño declarado en la fila.
  dueno uuid := coalesce(auth.uid(), new.usuario_id);
  v_origen cuentas;
  v_destino cuentas;
begin
  if new.cuenta_origen_id is null or new.cuenta_destino_id is null then
    raise exception 'Elige la cuenta de origen y la de destino.' using errcode = '22023';
  end if;
  if new.cuenta_origen_id = new.cuenta_destino_id then
    raise exception 'La cuenta de origen y la de destino deben ser distintas.' using errcode = '22023';
  end if;
  -- Las dos cuentas se bloquean siempre en el mismo orden (por id): dos
  -- transferencias simultáneas entre las mismas cuentas no se trancan.
  perform 1 from cuentas
  where id in (new.cuenta_origen_id, new.cuenta_destino_id) and usuario_id = dueno
  order by id
  for update;
  select * into v_origen from cuentas where id = new.cuenta_origen_id and usuario_id = dueno;
  if not found then
    raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
  end if;
  select * into v_destino from cuentas where id = new.cuenta_destino_id and usuario_id = dueno;
  if not found then
    raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
  end if;
  if v_destino.tipo = 'credito' then
    raise exception 'Para pagar una tarjeta de crédito usa «Pagar tarjeta»: así queda registrado como pago de la tarjeta.'
      using errcode = '22023';
  end if;
  if v_origen.tipo = 'credito' and new.monto > v_origen.disponible then
    raise exception 'La transferencia ($%) supera el cupo disponible de la tarjeta ($%).',
      to_char(new.monto, 'FM9999999990.00'), to_char(v_origen.disponible, 'FM9999999990.00')
      using errcode = '22023';
  end if;
  new.descripcion := nullif(btrim(regexp_replace(coalesce(new.descripcion, ''), '[[:cntrl:]]', ' ', 'g')), '');
  return new;
end;
$$;

drop trigger if exists trg_00_validar_transferencia on public.transferencias;
create trigger trg_00_validar_transferencia
  before insert on public.transferencias
  for each row execute function public.validar_transferencia();

create or replace function public.aplicar_transferencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update cuentas set disponible = disponible - new.monto
  where id = new.cuenta_origen_id and usuario_id = new.usuario_id;
  update cuentas set disponible = disponible + new.monto
  where id = new.cuenta_destino_id and usuario_id = new.usuario_id;
  return new;
end;
$$;

drop trigger if exists trg_aplicar_transferencia on public.transferencias;
create trigger trg_aplicar_transferencia
  after insert on public.transferencias
  for each row execute function public.aplicar_transferencia();

-- Borrarla devuelve el dinero a la cuenta de origen y lo saca del destino.
-- Si una de las cuentas ya no existe (SET NULL), solo se ajusta la otra.
create or replace function public.revertir_transferencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cuenta_origen_id is not null then
    update cuentas set disponible = disponible + old.monto
    where id = old.cuenta_origen_id and usuario_id = old.usuario_id;
  end if;
  if old.cuenta_destino_id is not null then
    update cuentas set disponible = disponible - old.monto
    where id = old.cuenta_destino_id and usuario_id = old.usuario_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_revertir_transferencia on public.transferencias;
create trigger trg_revertir_transferencia
  after delete on public.transferencias
  for each row execute function public.revertir_transferencia();

-- Editar: solo la descripción y la fecha (no mueven saldos). Que una cuenta
-- pase a NULL lo hace la clave foránea al borrar esa cuenta.
create or replace function public.proteger_transferencia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.usuario_id is distinct from old.usuario_id
     or new.monto is distinct from old.monto
     or new.origen is distinct from old.origen
     or (new.cuenta_origen_id is distinct from old.cuenta_origen_id and new.cuenta_origen_id is not null)
     or (new.cuenta_destino_id is distinct from old.cuenta_destino_id and new.cuenta_destino_id is not null) then
    raise exception 'Una transferencia no se edita: elimínala y regístrala de nuevo, así los saldos quedan bien.'
      using errcode = '22023';
  end if;
  new.descripcion := nullif(btrim(regexp_replace(coalesce(new.descripcion, ''), '[[:cntrl:]]', ' ', 'g')), '');
  return new;
end;
$$;

drop trigger if exists trg_proteger_transferencia on public.transferencias;
create trigger trg_proteger_transferencia
  before update on public.transferencias
  for each row execute function public.proteger_transferencia();

-- 3) Avisos de transferencia en la bandeja ------------------------------

alter table public.transacciones_detectadas
  add column if not exists es_transferencia boolean not null default false,
  add column if not exists transferencia_id uuid references public.transferencias(id) on delete set null;

create index if not exists transacciones_detectadas_transferencia_idx
  on public.transacciones_detectadas (transferencia_id) where transferencia_id is not null;
create index if not exists transacciones_detectadas_pendientes_transferencia_idx
  on public.transacciones_detectadas (usuario_id, monto) where estado = 'pendiente' and es_transferencia;

-- Un aviso resuelto no vuelve a "pendiente"... salvo al separar una
-- transferencia que la base juntó sola (`separar_transferencia`), que
-- devuelve sus dos avisos a la bandeja. Igual que en
-- 20261016120000_billeteras_y_ubicacion, más esa excepción.
create or replace function public.proteger_estado_aviso()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.estado <> 'pendiente' and new.estado is distinct from old.estado
     and not (old.estado = 'confirmado' and new.estado = 'pendiente'
              and old.transferencia_id is not null and new.transferencia_id is null
              and current_setting('fintrack.separar_transferencia', true) = 'si') then
    raise exception 'Este aviso ya fue %: no se puede cambiar.', old.estado using errcode = '22023';
  end if;
  if new.estado <> 'pendiente' then
    new.correo_asunto := null;
    new.comercio := null;
    new.latitud := null;
    new.longitud := null;
    new.precision_m := null;
    new.tarjeta_final := null;
  end if;
  return new;
end;
$$;

-- Al llegar un aviso de transferencia con su cuenta, busca la otra mitad:
-- un aviso pendiente del tipo contrario, por el mismo monto, en OTRA cuenta
-- tuya y con hasta 2 días de diferencia. Si hay exactamente una, registra
-- la transferencia y resuelve los dos avisos. `security definer` para leer
-- el ajuste del usuario; todo filtra por el dueño del aviso.
create or replace function public.emparejar_transferencia_detectada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado text;
  v_candidatos int;
  v_otro transacciones_detectadas;
  v_transferencia uuid;
begin
  -- Si en la misma sentencia llegaron las dos mitades, la primera ya las
  -- resolvió: NEW es la fila tal como se insertó, por eso se vuelve a leer.
  select estado into v_estado from transacciones_detectadas where id = new.id;
  if v_estado is distinct from 'pendiente' then
    return null;
  end if;
  if not registro_automatico_activo(new.usuario_id) then
    return null;
  end if;

  select count(*) into v_candidatos
  from transacciones_detectadas
  where usuario_id = new.usuario_id and id <> new.id and estado = 'pendiente' and es_transferencia
    and tipo <> new.tipo and monto = new.monto
    and cuenta_id is not null and cuenta_id <> new.cuenta_id
    and fecha between new.fecha - 2 and new.fecha + 2;
  if v_candidatos <> 1 then
    return null; -- ninguna, o ambiguo: se decide en la bandeja
  end if;

  select * into v_otro
  from transacciones_detectadas
  where usuario_id = new.usuario_id and id <> new.id and estado = 'pendiente' and es_transferencia
    and tipo <> new.tipo and monto = new.monto
    and cuenta_id is not null and cuenta_id <> new.cuenta_id
    and fecha between new.fecha - 2 and new.fecha + 2
  for update;

  begin
    insert into transferencias (usuario_id, cuenta_origen_id, cuenta_destino_id, monto, fecha, descripcion, origen)
    values (
      new.usuario_id,
      case when new.tipo = 'gasto' then new.cuenta_id else v_otro.cuenta_id end,
      case when new.tipo = 'gasto' then v_otro.cuenta_id else new.cuenta_id end,
      new.monto,
      least(new.fecha, v_otro.fecha),
      'Transferencia entre mis cuentas',
      'correo'
    )
    returning id into v_transferencia;
  exception when others then
    -- Por ejemplo, el destino es una tarjeta de crédito: quedan en la bandeja.
    return null;
  end;

  update transacciones_detectadas
  set estado = 'confirmado', transferencia_id = v_transferencia
  where id in (new.id, v_otro.id) and usuario_id = new.usuario_id;
  return null;
end;
$$;

drop trigger if exists trg_emparejar_transferencia on public.transacciones_detectadas;
create trigger trg_emparejar_transferencia
  after insert on public.transacciones_detectadas
  for each row
  when (new.es_transferencia and new.estado = 'pendiente' and new.cuenta_id is not null)
  execute function public.emparejar_transferencia_detectada();

-- 4) Confirmar un aviso como transferencia, y separar una juntada sola ----

-- p_cuenta: la cuenta del aviso (la que se ve en la bandeja); p_otra_cuenta:
-- de dónde vino o a dónde fue el dinero. Si la otra mitad también está en la
-- bandeja, se resuelve junto. Idempotente: si ya se confirmó como
-- transferencia, devuelve esa misma.
create or replace function public.confirmar_aviso_como_transferencia(
  p_id uuid,
  p_cuenta uuid,
  p_otra_cuenta uuid,
  p_monto numeric default null,
  p_descripcion text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_aviso transacciones_detectadas;
  v_monto numeric(12, 2);
  v_transferencia uuid;
  v_otro uuid;
begin
  select * into v_aviso from transacciones_detectadas where id = p_id for update;
  if not found then
    raise exception 'El movimiento detectado no existe o no es tuyo.' using errcode = '42501';
  end if;
  if v_aviso.estado = 'confirmado' then
    if v_aviso.transferencia_id is not null then
      return v_aviso.transferencia_id;
    end if;
    raise exception 'Este movimiento ya se confirmó como gasto o ingreso.' using errcode = '22023';
  end if;
  if v_aviso.estado = 'descartado' then
    raise exception 'Este movimiento ya fue descartado.' using errcode = '22023';
  end if;
  if v_aviso.origen <> 'correo' then
    raise exception 'Un pago con billetera es un gasto con tarjeta, no una transferencia.' using errcode = '22023';
  end if;
  if p_cuenta is null or p_otra_cuenta is null then
    raise exception 'Elige las dos cuentas de la transferencia.' using errcode = '22023';
  end if;
  v_monto := round(coalesce(p_monto, v_aviso.monto), 2);
  if v_monto is null or v_monto < 0.01 or v_monto > 9999999999.99 then
    raise exception 'Escribe un monto válido, por ejemplo 12,50.' using errcode = '22023';
  end if;

  insert into transferencias (cuenta_origen_id, cuenta_destino_id, monto, fecha, descripcion, origen)
  values (
    case when v_aviso.tipo = 'gasto' then p_cuenta else p_otra_cuenta end,
    case when v_aviso.tipo = 'gasto' then p_otra_cuenta else p_cuenta end,
    v_monto, v_aviso.fecha,
    coalesce(nullif(btrim(left(coalesce(p_descripcion, ''), 200)), ''), 'Transferencia entre mis cuentas'),
    'correo'
  )
  returning id into v_transferencia;

  -- La otra mitad, si está en la bandeja (la más cercana en fecha).
  select id into v_otro from transacciones_detectadas
  where id <> p_id and estado = 'pendiente' and origen = 'correo' and tipo <> v_aviso.tipo
    and monto = v_monto and cuenta_id = p_otra_cuenta
    and fecha between v_aviso.fecha - 2 and v_aviso.fecha + 2
  order by abs(fecha - v_aviso.fecha), created_at
  limit 1
  for update;

  update transacciones_detectadas
  set estado = 'confirmado', transferencia_id = v_transferencia,
      cuenta_id = case when id = p_id then p_cuenta else cuenta_id end
  where id in (p_id, v_otro);

  return v_transferencia;
end;
$$;

revoke all on function public.confirmar_aviso_como_transferencia(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.confirmar_aviso_como_transferencia(uuid, uuid, uuid, numeric, text) to authenticated;

-- «No era una transferencia entre mis cuentas»: borra la transferencia (los
-- saldos vuelven solos) y devuelve sus avisos a la bandeja, ya sin la marca
-- de transferencia para que no se vuelvan a juntar. Devuelve cuántos avisos
-- volvieron. Solo para las que vinieron del correo: una registrada a mano
-- simplemente se elimina.
create or replace function public.separar_transferencia(p_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_transferencia transferencias;
  v_avisos integer;
begin
  select * into v_transferencia from transferencias where id = p_id for update;
  if not found then
    raise exception 'La transferencia no existe o no es tuya.' using errcode = '42501';
  end if;
  if v_transferencia.origen <> 'correo' then
    raise exception 'Esta transferencia la registraste a mano: si no corresponde, elimínala.' using errcode = '22023';
  end if;

  perform set_config('fintrack.separar_transferencia', 'si', true);
  update transacciones_detectadas
  set estado = 'pendiente', transferencia_id = null, es_transferencia = false
  where transferencia_id = p_id;
  get diagnostics v_avisos = row_count;
  perform set_config('fintrack.separar_transferencia', '', true);

  delete from transferencias where id = p_id;
  return v_avisos;
end;
$$;

revoke all on function public.separar_transferencia(uuid) from public, anon;
grant execute on function public.separar_transferencia(uuid) to authenticated;

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261018120000', 'ajustes_y_transferencias')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261018120000') then 'sí' else 'no' end as aplicada;
