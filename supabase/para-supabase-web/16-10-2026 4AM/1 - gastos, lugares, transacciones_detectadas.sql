-- =====================================================================
-- gastos-app — Migración de billeteras y ubicación
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261016120000_billeteras_y_ubicacion.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261016120000_billeteras_y_ubicacion.sql
-- Migración de billeteras y ubicación (Fase 1 del plan de billeteras).
--
-- 1) "Pagado con": Apple Pay y Google Wallet no son un método de pago nuevo,
--    pagan con una tarjeta de débito o crédito. Van en una columna aparte
--    (`billetera`) y `metodo_pago` sigue diciendo débito/crédito: los saldos,
--    los cupos y los diferidos no cambian.
-- 2) Ubicación de cada gasto. Las columnas numeric(6,4)/(7,4) la redondean
--    a 4 decimales (unos 11 m): alcanza para agrupar por lugar sin guardar la
--    posición exacta. También se guarda la precisión que dio el GPS.
-- 3) Lugares: un gasto con ubicación se asigna al lugar propio más cercano
--    dentro de su radio, o crea uno nuevo con el nombre del gasto.
-- 4) Bandeja: de dónde vino el aviso (correo, Apple Pay, Google Wallet), el
--    comercio, la ubicación y los últimos dígitos de la tarjeta. Al confirmar,
--    todo pasa al gasto; al resolver el aviso se borra de él (minimización).

-- 1) Lugares ------------------------------------------------------------

create table if not exists public.lugares (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  latitud numeric(6, 4) not null check (latitud between -90 and 90),
  longitud numeric(7, 4) not null check (longitud between -180 and 180),
  radio_m integer not null default 80 check (radio_m between 20 and 500),
  created_at timestamptz not null default now()
);

create index if not exists lugares_usuario_latitud_idx on public.lugares (usuario_id, latitud);

alter table public.lugares enable row level security;
revoke all on public.lugares from anon;

drop policy if exists "lugares: select propio" on public.lugares;
create policy "lugares: select propio" on public.lugares
  for select to authenticated using (auth.uid() = usuario_id);
drop policy if exists "lugares: insert propio" on public.lugares;
create policy "lugares: insert propio" on public.lugares
  for insert to authenticated with check (auth.uid() = usuario_id);
drop policy if exists "lugares: update propio" on public.lugares;
create policy "lugares: update propio" on public.lugares
  for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
drop policy if exists "lugares: delete propio" on public.lugares;
create policy "lugares: delete propio" on public.lugares
  for delete to authenticated using (auth.uid() = usuario_id);

-- Distancia en metros entre dos puntos (fórmula de haversine). Sin PostGIS:
-- cada usuario tiene pocos lugares y la búsqueda se acota antes por latitud.
create or replace function public.distancia_m(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians((lat2 - lat1)::double precision) / 2), 2)
    + cos(radians(lat1::double precision)) * cos(radians(lat2::double precision))
      * power(sin(radians((lon2 - lon1)::double precision) / 2), 2)
  )))
$$;

-- 2) Gastos: pagado con, ubicación y lugar ------------------------------

alter table public.gastos
  add column if not exists billetera text,
  add column if not exists latitud numeric(6, 4),
  add column if not exists longitud numeric(7, 4),
  add column if not exists precision_m integer,
  add column if not exists lugar_id uuid references public.lugares(id) on delete set null;

alter table public.gastos drop constraint if exists gastos_billetera_valida;
alter table public.gastos add constraint gastos_billetera_valida
  check (billetera is null or billetera in ('apple_pay', 'google_wallet', 'otra'));

-- Una billetera paga con tarjeta: no tiene sentido con efectivo o transferencia.
alter table public.gastos drop constraint if exists gastos_billetera_con_tarjeta;
alter table public.gastos add constraint gastos_billetera_con_tarjeta
  check (billetera is null or metodo_pago is null or metodo_pago in ('debito', 'credito', 'diferido'));

alter table public.gastos drop constraint if exists gastos_ubicacion_valida;
alter table public.gastos add constraint gastos_ubicacion_valida
  check (
    (latitud is null) = (longitud is null)
    and (precision_m is null or latitud is not null)
    and (latitud is null or latitud between -90 and 90)
    and (longitud is null or longitud between -180 and 180)
    and (precision_m is null or precision_m between 0 and 50000)
  );

-- Borrar un lugar pone lugar_id en NULL en sus gastos: sin índice, recorre la tabla.
create index if not exists gastos_lugar_idx on public.gastos (lugar_id) where lugar_id is not null;

-- 3) Bandeja: origen, comercio, ubicación y tarjeta ----------------------

alter table public.transacciones_detectadas
  add column if not exists origen text not null default 'correo',
  add column if not exists comercio text,
  add column if not exists latitud numeric(6, 4),
  add column if not exists longitud numeric(7, 4),
  add column if not exists precision_m integer,
  add column if not exists tarjeta_final text;

alter table public.transacciones_detectadas drop constraint if exists transacciones_detectadas_origen_valido;
alter table public.transacciones_detectadas add constraint transacciones_detectadas_origen_valido
  check (origen in ('correo', 'apple_pay', 'google_wallet') and (origen = 'correo' or tipo = 'gasto'));

alter table public.transacciones_detectadas drop constraint if exists transacciones_detectadas_billetera_valida;
alter table public.transacciones_detectadas add constraint transacciones_detectadas_billetera_valida
  check (
    (comercio is null or char_length(comercio) <= 200)
    and (tarjeta_final is null or tarjeta_final ~ '^[0-9]{3,4}$')
    and (latitud is null) = (longitud is null)
    and (precision_m is null or latitud is not null)
    and (latitud is null or latitud between -90 and 90)
    and (longitud is null or longitud between -180 and 180)
    and (precision_m is null or precision_m between 0 and 50000)
  );

-- 4) Referencias propias: ahora también el lugar ------------------------
-- Igual que la versión de 20261013120000, con la rama de `lugar_id`.

create or replace function public.validar_referencias_propias()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fila jsonb := to_jsonb(new);
  anterior jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  -- Con sesión de usuario manda auth.uid(); con service_role (sin JWT de
  -- usuario) se usa el dueño declarado en la fila.
  dueno uuid := coalesce(auth.uid(), new.usuario_id);
  columna text;
  ref uuid;
begin
  foreach columna in array array['cuenta_id', 'cuenta_origen_id', 'categoria_id', 'deuda_id', 'gasto_id', 'lugar_id'] loop
    continue when not (fila ? columna);
    ref := nullif(fila ->> columna, '')::uuid;
    continue when ref is null;
    -- En un UPDATE solo se valida lo que cambió: no se rompen filas viejas.
    continue when tg_op = 'UPDATE' and (anterior ->> columna) is not distinct from (fila ->> columna);

    if columna in ('cuenta_id', 'cuenta_origen_id') then
      if not exists (select 1 from cuentas where id = ref and usuario_id = dueno) then
        raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'categoria_id' then
      if not exists (select 1 from categorias where id = ref and (usuario_id is null or usuario_id = dueno)) then
        raise exception 'La categoría indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'deuda_id' then
      if not exists (select 1 from deudas where id = ref and usuario_id = dueno) then
        raise exception 'La deuda indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'gasto_id' then
      if not exists (select 1 from gastos where id = ref and usuario_id = dueno) then
        raise exception 'El gasto indicado no existe o no es tuyo.' using errcode = '42501';
      end if;
    elsif columna = 'lugar_id' then
      if not exists (select 1 from lugares where id = ref and usuario_id = dueno) then
        raise exception 'El lugar indicado no existe o no es tuyo.' using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

-- 5) Asignar el lugar de un gasto ---------------------------------------
-- `security invoker`: busca y crea lugares con los permisos de quien guarda
-- el gasto, así RLS impide tocar lugares ajenos aunque la fila diga otro dueño.

create or replace function public.asignar_lugar_gasto()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lugar uuid;
  -- 500 m (el radio máximo) en grados de latitud; en longitud se corrige por
  -- la latitud. No contempla el antimeridiano (±180°), que no cruza Ecuador.
  v_dlat numeric := 0.0046;
  v_dlon numeric;
begin
  if tg_op = 'UPDATE' then
    if new.latitud is not distinct from old.latitud and new.longitud is not distinct from old.longitud then
      return new;
    end if;
    -- Cambió la ubicación y no se eligió otro lugar a mano: se recalcula.
    if new.lugar_id is not distinct from old.lugar_id then
      new.lugar_id := null;
    end if;
  end if;

  if new.lugar_id is not null or new.latitud is null then
    return new;
  end if;
  -- Ubicación incompleta o imposible: los CHECK de gastos corren después de
  -- los triggers BEFORE, así que se deja pasar para que ellos la rechacen.
  if new.longitud is null or abs(new.latitud) > 90 or abs(new.longitud) > 180 then
    return new;
  end if;
  -- GPS impreciso: mejor sin lugar que en el lugar equivocado.
  if new.precision_m is not null and new.precision_m > 200 then
    return new;
  end if;

  v_dlon := v_dlat / greatest(cos(radians(new.latitud::double precision)), 0.01)::numeric;

  select l.id into v_lugar
  from lugares l
  where l.usuario_id = new.usuario_id
    and l.latitud between new.latitud - v_dlat and new.latitud + v_dlat
    and l.longitud between new.longitud - v_dlon and new.longitud + v_dlon
    and distancia_m(l.latitud, l.longitud, new.latitud, new.longitud) <= l.radio_m
  order by distancia_m(l.latitud, l.longitud, new.latitud, new.longitud), l.created_at
  limit 1;

  if v_lugar is null then
    insert into lugares (usuario_id, nombre, latitud, longitud)
    values (
      new.usuario_id,
      coalesce(nullif(left(btrim(new.descripcion), 80), ''), 'Lugar sin nombre'),
      new.latitud,
      new.longitud
    )
    returning id into v_lugar;
  end if;

  new.lugar_id := v_lugar;
  return new;
end;
$$;

-- "trg_05_": corre después de validar referencias (trg_00) y el cupo (trg_03).
drop trigger if exists trg_05_asignar_lugar on public.gastos;
create trigger trg_05_asignar_lugar
  before insert or update of latitud, longitud on public.gastos
  for each row execute function public.asignar_lugar_gasto();

-- 6) Aviso resuelto: no vuelve atrás y se olvidan sus datos sensibles ------
-- Antes cada llamada borraba el asunto por su cuenta; ahora lo hace la base
-- para cualquier camino (confirmar, descartar o un UPDATE directo).

create or replace function public.proteger_estado_aviso()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.estado <> 'pendiente' and new.estado is distinct from old.estado then
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

-- 7) Confirmar un aviso pasa la billetera y la ubicación al gasto ----------
-- Misma firma que antes: la app ya instalada sigue confirmando igual.

create or replace function public.confirmar_transaccion_detectada(
  p_id uuid,
  p_monto numeric,
  p_descripcion text,
  p_categoria_id uuid default null,
  p_cuenta_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_aviso transacciones_detectadas;
  v_id uuid;
  v_billetera text;
  v_metodo text;
begin
  select * into v_aviso from transacciones_detectadas where id = p_id for update;
  if not found then
    raise exception 'El movimiento detectado no existe o no es tuyo.' using errcode = '42501';
  end if;

  -- Idempotente: si ya se confirmó (p. ej. la respuesta anterior se perdió
  -- por la red), no se crea otro gasto. Devuelve null.
  if v_aviso.estado = 'confirmado' then
    return null;
  end if;
  if v_aviso.estado = 'descartado' then
    raise exception 'Este movimiento ya fue descartado.' using errcode = '22023';
  end if;

  if v_aviso.tipo = 'gasto' then
    if p_categoria_id is null then
      raise exception 'Elegí una categoría antes de confirmar.' using errcode = '22023';
    end if;
    -- Pago con billetera: "pagado con" sale del origen y el método, del tipo
    -- de la tarjeta elegida (RLS hace que solo se lean cuentas propias).
    if v_aviso.origen in ('apple_pay', 'google_wallet') then
      v_billetera := v_aviso.origen;
      if p_cuenta_id is not null then
        select case tipo when 'credito' then 'credito' when 'efectivo' then null else 'debito' end
        into v_metodo
        from cuentas where id = p_cuenta_id;
      end if;
    end if;
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha,
                        metodo_pago, billetera, latitud, longitud, precision_m)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha,
            v_metodo, v_billetera, v_aviso.latitud, v_aviso.longitud, v_aviso.precision_m)
    returning id into v_id;
  else
    insert into ingresos (monto, descripcion, categoria_id, cuenta_id, fecha)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha)
    returning id into v_id;
  end if;

  -- El trigger proteger_estado_aviso borra asunto, comercio, ubicación y tarjeta.
  update transacciones_detectadas set estado = 'confirmado' where id = p_id;

  return v_id;
end;
$$;

revoke execute on function public.confirmar_transaccion_detectada(uuid, numeric, text, uuid, uuid) from public, anon;
grant execute on function public.confirmar_transaccion_detectada(uuid, numeric, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261016120000', 'billeteras_y_ubicacion')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261016120000') then 'sí' else 'no' end as aplicada;
