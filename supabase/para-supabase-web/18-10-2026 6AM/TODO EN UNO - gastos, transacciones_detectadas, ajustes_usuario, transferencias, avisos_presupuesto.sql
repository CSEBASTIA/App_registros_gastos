-- =====================================================================
-- gastos-app — Todo lo que falta: hora del pago, diferido con fecha fija, transferencias, registro automático y avisos de presupuesto · 18-10-2026 6AM
-- Para un proyecto que ya tiene la base anterior. Incluye 4 archivo(s):
--   - 20261016220000_hora_del_pago.sql
--   - 20261016230000_diferido_fecha_fija.sql
--   - 20261018120000_ajustes_y_transferencias.sql
--   - 20261018130000_registro_automatico_billetera.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> Comprobación previa: va encima de las actualizaciones hasta la de
-- «exportar datos de una persona» (16-oct). Si falta alguna, se detiene aquí
-- sin cambiar nada. Las dos primeras partes (hora del pago y diferido con
-- fecha fija) se pueden repetir sin problema si ya estaban aplicadas.
do $$
begin
  if to_regclass('public.claves_captura') is null
     or to_regclass('public.aceptaciones_legales') is null
     or to_regprocedure('public.registrar_aviso_billetera(text, text, text, text, text)') is null
     or to_regprocedure('public.exportar_datos_persona(text)') is null then
    raise exception 'Falta aplicar antes las actualizaciones del 16-oct (carpetas 16-10-2026 4AM y 5AM de supabase/para-supabase-web, en orden). No se cambió nada.';
  end if;
end $$;

-- >>> 20261016220000_hora_del_pago.sql
-- Migración de hora del pago.
--
-- Al confirmar en la bandeja un aviso de Apple Pay o Google Wallet, el gasto
-- guarda la hora real del pago (`gastos.pagado_en`), no la de confirmación.
-- La isla de detalle la muestra como «Hora del pago».
--
-- - Apple Pay: el atajo corre en el momento de pagar, así que la hora del
--   pago es cuando llegó el aviso (`created_at`).
-- - Google Wallet: la hora de la notificación (`p_cuando`) se guarda en el
--   aviso (`transacciones_detectadas.pagado_en`), así sirve aunque el
--   teléfono la haya enviado tarde, sin internet.
-- - Correo y gastos anotados a mano: sin hora del pago (null). La app
--   muestra entonces la hora en que se registró.
--
-- Los gastos ya confirmados antes de esta migración no se pueden completar:
-- el aviso no guarda a qué gasto dio origen.
-- Sin SQL dinámico.

alter table public.gastos add column if not exists pagado_en timestamptz;
alter table public.transacciones_detectadas add column if not exists pagado_en timestamptz;

alter table public.gastos drop constraint if exists gastos_pagado_en_valido;
alter table public.gastos
  add constraint gastos_pagado_en_valido
  check (pagado_en is null or pagado_en between '2000-01-01'::timestamptz and '2100-01-01'::timestamptz) not valid;
alter table public.transacciones_detectadas drop constraint if exists transacciones_pagado_en_valido;
alter table public.transacciones_detectadas
  add constraint transacciones_pagado_en_valido
  check (pagado_en is null or pagado_en between '2000-01-01'::timestamptz and '2100-01-01'::timestamptz) not valid;

-- 1) Confirmar: el gasto lleva la hora del pago ---------------------------
-- Igual que en 20261016120000_billeteras_y_ubicacion, más `pagado_en`.

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
  v_pagado_en timestamptz;
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
      v_pagado_en := coalesce(v_aviso.pagado_en, v_aviso.created_at);
      if p_cuenta_id is not null then
        select case tipo when 'credito' then 'credito' when 'efectivo' then null else 'debito' end
        into v_metodo
        from cuentas where id = p_cuenta_id;
      end if;
    end if;
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha,
                        metodo_pago, billetera, latitud, longitud, precision_m, pagado_en)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha,
            v_metodo, v_billetera, v_aviso.latitud, v_aviso.longitud, v_aviso.precision_m, v_pagado_en)
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

-- 2) Google Wallet: el aviso guarda la hora de la notificación ------------
-- Igual que en 20261016180000_captura_google_wallet, más `pagado_en`.

create or replace function public.registrar_aviso_billetera(
  p_clave text,
  p_titulo text default null,
  p_texto text default null,
  p_paquete text default 'com.google.android.apps.walletnfcrel',
  p_cuando text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clave claves_captura;
  v_aviso jsonb;
  v_resultado jsonb;
  v_cuando timestamptz;
begin
  -- La clave primero, con el mismo error que el atajo de Apple Pay.
  if p_clave is null or p_clave !~ '^ft_[0-9a-f]{64}$' then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;
  select * into v_clave from claves_captura
  where huella = encode(sha256(convert_to(p_clave, 'UTF8')), 'hex');
  if not found then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;

  -- Solo Google Wallet, por ahora.
  if p_paquete is distinct from 'com.google.android.apps.walletnfcrel' then
    raise exception 'Aplicación no admitida.' using errcode = '22023';
  end if;

  v_aviso := leer_aviso_google_wallet(p_titulo, p_texto);
  if (v_aviso ->> 'ignorar')::boolean then
    return jsonb_build_object('estado', 'ignorado');
  end if;

  v_resultado := registrar_pago_billetera(
    p_clave, v_aviso ->> 'monto', v_aviso ->> 'comercio', v_aviso ->> 'tarjeta',
    null, null, null, 'google_wallet'
  );

  -- Hora y fecha del pago según la notificación (sirve si llegó tarde). La
  -- fila recién creada es la de esta transacción: su created_at es now().
  if v_resultado ->> 'estado' = 'recibido' and btrim(coalesce(p_cuando, '')) ~ '^[0-9]{13}$' then
    v_cuando := to_timestamp(btrim(p_cuando)::numeric / 1000);
    if v_cuando between now() - interval '3 days' and now() + interval '10 minutes' then
      update transacciones_detectadas
      set fecha = (v_cuando at time zone 'America/Guayaquil')::date,
          pagado_en = v_cuando
      where clave_captura_id = v_clave.id and usuario_id = v_clave.usuario_id
        and origen = 'google_wallet' and created_at = now();
    end if;
  end if;

  return v_resultado;
end;
$$;

revoke all on function public.registrar_aviso_billetera(text, text, text, text, text) from public, authenticated;
grant execute on function public.registrar_aviso_billetera(text, text, text, text, text) to anon;

notify pgrst, 'reload schema';


-- >>> 20261016230000_diferido_fecha_fija.sql
-- Migración de fecha fija en diferidos.
--
-- Al editar gastos desde el teléfono: un diferido ya no puede cambiar de
-- fecha. Su deuda empieza ese día y sus recordatorios de cuotas caen ese día
-- de cada mes; moverlo dejaría la deuda y los recordatorios con otra fecha.
-- Igual que con el monto, la tarjeta, el método y el plazo: se elimina y se
-- registra de nuevo. Descripción y categoría se siguen pudiendo cambiar.
--
-- Igual que en 20261014130000_saldos_confiables, más la fecha.
-- Sin SQL dinámico.

create or replace function public.proteger_gasto_diferido()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.metodo_pago = 'diferido' and (
       new.monto is distinct from old.monto
    or new.metodo_pago is distinct from old.metodo_pago
    or new.meses_diferido is distinct from old.meses_diferido
    or new.fecha is distinct from old.fecha
    -- Soltar la cuenta (null) sí se permite: es lo que hace la base cuando
    -- se borra la tarjeta (ON DELETE SET NULL). Cambiarla por otra, no.
    or (new.cuenta_id is not null and new.cuenta_id is distinct from old.cuenta_id)
  ) then
    raise exception 'Un gasto diferido no se puede editar en monto, cuenta, método de pago, plazo o fecha: elimínalo y regístralo de nuevo.'
      using errcode = '22023';
  end if;

  if new.metodo_pago = 'diferido' and old.metodo_pago is distinct from 'diferido' then
    raise exception 'Un gasto no se puede convertir en diferido al editarlo: regístralo de nuevo como diferido.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';


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


-- >>> 20261018130000_registro_automatico_billetera.sql
-- Migración de registro automático de pagos con billetera.
--
-- 1) Tarjeta reconocida = gasto registrado solo. Si la base reconoce la
--    tarjeta del pago por sus últimos dígitos (exactamente una cuenta tuya
--    con ese identificador, y del mismo banco si el aviso lo nombra) y el
--    registro automático está encendido (`ajustes_usuario`, migración
--    anterior), el pago de Google Wallet o Apple Pay se guarda como gasto:
--    descuenta del cupo o del saldo de esa tarjeta, con la hora real del
--    pago. El aviso queda confirmado y apunta al gasto (`gasto_id`), y la
--    respuesta le dice al teléfono que avise «Registré $12,50…».
--    Si la tarjeta no se reconoce por sus dígitos, o el gasto no se puede
--    guardar (p. ej. supera el cupo), el aviso queda en la bandeja como
--    hasta ahora.
-- 2) Reconocer la tarjeta: los dígitos mandan. Antes, si había una sola
--    tarjeta del banco nombrado, se elegía aunque el aviso trajera otros
--    dígitos (una tarjeta no registrada quedaba cargada a la que sí).
-- 3) Categoría sugerida: la de tu último gasto con ese mismo nombre de
--    comercio; si no hay, por palabras clave (las mismas de la app); si no,
--    «Otros». También preselecciona la categoría en la bandeja.
-- 4) Lugar por comercio: los pagos de Google Wallet llegan sin ubicación
--    (con la app cerrada, el teléfono no puede leerla). Si ya tienes un lugar
--    con el nombre del comercio, el gasto se asigna a ese lugar (si hay
--    varias sucursales con ese nombre, a la más usada). Vale al registrarse
--    solo y al confirmar en la bandeja.
-- 5) Avisos de presupuesto: al 75 %, al 100 % y al pasarte de un
--    presupuesto, una sola vez por nivel (cada presupuesto es de un mes). Se
--    anotan en `avisos_presupuesto`, así el teléfono no avisa dos veces lo
--    mismo, venga el gasto de la app o de un pago registrado solo.
-- 6) La exportación de datos personales incluye las tablas nuevas.
-- Sin SQL dinámico; search_path fijo en todas las funciones.

-- 1) El aviso recuerda el gasto que creó --------------------------------

alter table public.transacciones_detectadas
  add column if not exists gasto_id uuid references public.gastos(id) on delete set null;
create index if not exists transacciones_detectadas_gasto_idx
  on public.transacciones_detectadas (gasto_id) where gasto_id is not null;

-- 2) Categoría sugerida y lugar por comercio ---------------------------

create or replace function public.categoria_sugerida(p_usuario uuid, p_texto text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_texto text := lower(btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')));
  v_sin_acentos text;
  v_nombre text;
  v_id uuid;
begin
  if v_texto <> '' then
    -- La categoría que usaste la última vez en ese mismo comercio.
    select g.categoria_id into v_id
    from gastos g
    where g.usuario_id = p_usuario and g.categoria_id is not null
      and lower(btrim(regexp_replace(g.descripcion, '\s+', ' ', 'g'))) = v_texto
    order by g.fecha desc, g.created_at desc
    limit 1;
    if v_id is not null then
      return v_id;
    end if;

    -- Palabras clave: las mismas (y en el mismo orden) que
    -- PALABRAS_POR_CATEGORIA en packages/core/src/lib/textoFinanciero.ts.
    v_sin_acentos := translate(v_texto, 'áéíóúüñ', 'aeiouun');
    v_nombre := case
      when v_sin_acentos ~ '(supermaxi|megamaxi|mi comisariato|coral|restaurante|market|food)' then 'Comida'
      when v_sin_acentos ~ '(uber|cabify|indriver|taxi|gasolina|combustible|peaje)' then 'Transporte'
      when v_sin_acentos ~ '(netflix|spotify|cine|cinemark|supercines|steam|teatro|discoteca|casino|concierto)' then 'Ocio'
      when v_sin_acentos ~ '(farmacia|fybeca|sana sana|cruz azul|medico|medica|clinica|hospital|laboratorio clinico|consultorio|odontologo|dentista|medicamento)' then 'Salud'
      when v_sin_acentos ~ '(cnel|cnt|movistar|claro|agua potable|electricidad)' then 'Servicios'
    end;
    if v_nombre is not null then
      -- Una categoría propia con ese nombre gana a la global.
      select c.id into v_id
      from categorias c
      where c.tipo = 'gasto' and lower(c.nombre) = lower(v_nombre)
        and (c.usuario_id = p_usuario or c.usuario_id is null)
      order by (c.usuario_id is null), c.id
      limit 1;
      if v_id is not null then
        return v_id;
      end if;
    end if;
  end if;

  select c.id into v_id
  from categorias c
  where c.tipo = 'gasto' and c.nombre = 'Otros' and c.usuario_id is null
  limit 1;
  return v_id;
end;
$$;

revoke all on function public.categoria_sugerida(uuid, text) from public, anon, authenticated;

-- `security invoker`: con sesión de usuario, RLS solo le deja ver sus propios
-- lugares (aunque pase otro p_usuario); desde las funciones de la base, que
-- son security definer, corre con sus permisos y filtra por p_usuario.
create or replace function public.lugar_por_comercio(p_usuario uuid, p_comercio text)
returns uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select l.id
  from lugares l
  where l.usuario_id = p_usuario
    and nullif(btrim(coalesce(p_comercio, '')), '') is not null
    and lower(btrim(regexp_replace(l.nombre, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_comercio, '\s+', ' ', 'g')))
  order by (select count(*) from gastos g where g.lugar_id = l.id) desc, l.created_at, l.id
  limit 1
$$;

revoke all on function public.lugar_por_comercio(uuid, text) from public, anon, authenticated;

-- 3) Avisos de presupuesto ----------------------------------------------

create table if not exists public.avisos_presupuesto (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  -- 75 = llegaste al 75 %; 100 = llegaste al límite; 101 = te pasaste.
  nivel smallint not null check (nivel in (75, 100, 101)),
  created_at timestamptz not null default now(),
  unique (presupuesto_id, nivel)
);

create index if not exists avisos_presupuesto_usuario_idx on public.avisos_presupuesto (usuario_id);

alter table public.avisos_presupuesto enable row level security;
-- Solo lectura desde la app: los anota `revisar_presupuestos`.
revoke all on public.avisos_presupuesto from anon, authenticated;
grant select on public.avisos_presupuesto to authenticated;

drop policy if exists "avisos_presupuesto: select propio" on public.avisos_presupuesto;
create policy "avisos_presupuesto: select propio" on public.avisos_presupuesto
  for select to authenticated using ((select auth.uid()) = usuario_id);

-- Cambiar el límite de un presupuesto vuelve a habilitar sus avisos.
create or replace function public.reiniciar_avisos_presupuesto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.monto_limite is distinct from old.monto_limite or new.categoria_id is distinct from old.categoria_id then
    delete from avisos_presupuesto where presupuesto_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reiniciar_avisos_presupuesto on public.presupuestos;
create trigger trg_reiniciar_avisos_presupuesto
  after update on public.presupuestos
  for each row execute function public.reiniciar_avisos_presupuesto();

-- Presupuestos del mes (de una categoría, o todos) que cruzaron un nivel
-- nuevo. Anota todos los niveles alcanzados y devuelve, por presupuesto, el
-- más alto que no se había avisado: si un gasto lleva de 70 % a 120 %, se
-- avisa solo «te pasaste». Interna: la usan el registro automático y
-- `revisar_mis_presupuestos`.
create or replace function public.revisar_presupuestos(p_usuario uuid, p_mes text, p_categoria uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date;
  r record;
  v_porcentaje numeric;
  v_nivel smallint;
  v_nuevo smallint;
  v_avisos jsonb := '[]'::jsonb;
begin
  if p_usuario is null or p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    return v_avisos;
  end if;
  v_desde := to_date(p_mes || '-01', 'YYYY-MM-DD');

  for r in
    select p.id, p.monto_limite, coalesce(c.nombre, 'Sin categoría') as categoria,
      coalesce((
        select sum(g.monto) from gastos g
        where g.usuario_id = p_usuario and g.categoria_id = p.categoria_id
          and g.fecha >= v_desde and g.fecha < (v_desde + interval '1 month')::date
      ), 0) as gastado
    from presupuestos p
    left join categorias c on c.id = p.categoria_id
    where p.usuario_id = p_usuario and p.mes = p_mes and p.monto_limite > 0
      and (p_categoria is null or p.categoria_id = p_categoria)
    order by p.id
  loop
    v_porcentaje := round(r.gastado * 100 / r.monto_limite, 2);
    v_nivel := case
      when r.gastado > r.monto_limite then 101
      when r.gastado >= r.monto_limite then 100
      when v_porcentaje >= 75 then 75
      else 0
    end;
    continue when v_nivel = 0;

    with nuevos as (
      insert into avisos_presupuesto (usuario_id, presupuesto_id, nivel)
      select p_usuario, r.id, n from unnest(array[75, 100, 101]::smallint[]) as n where n <= v_nivel
      on conflict (presupuesto_id, nivel) do nothing
      returning nivel
    )
    select max(nivel) into v_nuevo from nuevos;

    if v_nuevo is not null then
      v_avisos := v_avisos || jsonb_build_object(
        'presupuesto_id', r.id,
        'categoria', r.categoria,
        'nivel', v_nuevo,
        'porcentaje', v_porcentaje,
        'gastado', r.gastado,
        'limite', r.monto_limite
      );
    end if;
  end loop;
  return v_avisos;
end;
$$;

revoke all on function public.revisar_presupuestos(uuid, text, uuid) from public, anon, authenticated;

-- La app la llama al abrirse y al guardar un gasto: devuelve lo nuevo para
-- avisar (vacío si no hay nada) y lo deja anotado.
create or replace function public.revisar_mis_presupuestos(p_mes text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mes inválido: se espera AAAA-MM.' using errcode = '22023';
  end if;
  return revisar_presupuestos(auth.uid(), p_mes, null);
end;
$$;

revoke all on function public.revisar_mis_presupuestos(text) from public, anon;
grant execute on function public.revisar_mis_presupuestos(text) to authenticated;

-- 4) Registrar un pago con billetera ------------------------------------
-- Lo común al atajo de Apple Pay y a la notificación de Google Wallet, una
-- vez comprobada (y bloqueada) la clave. `p_cuando`: hora del pago si se
-- conoce (Google Wallet); si no, el pago es ahora (el atajo corre al pagar).
-- Interna: no se puede llamar desde afuera.

create or replace function public.registrar_pago_con_clave(
  p_clave_id uuid,
  p_monto text,
  p_comercio text,
  p_tarjeta text,
  p_latitud text,
  p_longitud text,
  p_precision text,
  p_billetera text,
  p_cuando timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clave claves_captura;
  v_monto numeric;
  v_comercio text;
  v_tarjeta text;
  v_digitos text;
  v_banco text;
  v_cuenta uuid;
  v_por_digitos boolean := false;
  v_lat numeric;
  v_lon numeric;
  v_precision int;
  v_fecha date := (coalesce(p_cuando, now()) at time zone 'America/Guayaquil')::date;
  v_categoria uuid;
  v_aviso uuid;
  v_gasto uuid;
  v_tipo_cuenta text;
  v_lugar uuid;
  v_categoria_nombre text;
  v_presupuestos jsonb;
  v_descripcion text;
begin
  select * into v_clave from claves_captura where id = p_clave_id;
  if not found then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;

  if p_billetera is null or p_billetera not in ('apple_pay', 'google_wallet') then
    raise exception 'Billetera no válida.' using errcode = '22023';
  end if;

  v_monto := interpretar_monto_texto(p_monto);
  if v_monto is null or v_monto < 0.01 or v_monto > 9999999999.99 then
    raise exception 'Monto no válido: %', left(coalesce(p_monto, ''), 40) using errcode = '22023';
  end if;

  -- Límite de uso por clave (solo cuenta avisos de su dueño).
  if (select count(*) from transacciones_detectadas
      where clave_captura_id = v_clave.id and usuario_id = v_clave.usuario_id
        and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from transacciones_detectadas
      where clave_captura_id = v_clave.id and usuario_id = v_clave.usuario_id
        and created_at > now() - interval '1 day') >= 200 then
    raise exception 'Demasiados avisos con esta clave: prueba más tarde.' using errcode = 'PT429';
  end if;

  -- Textos de terceros: sin caracteres de control, espacios normales y recortados.
  v_comercio := nullif(left(btrim(regexp_replace(regexp_replace(left(coalesce(p_comercio, ''), 500), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), 200), '');
  v_tarjeta := left(coalesce(p_tarjeta, ''), 200);

  v_descripcion := coalesce(v_comercio, case p_billetera when 'apple_pay' then 'Pago con Apple Pay' else 'Pago con Google Wallet' end);

  -- El mismo pago dos veces (el atajo se repitió): un solo aviso. Se compara
  -- la descripción y no el comercio, porque un aviso que se registró solo
  -- queda confirmado y sin comercio (minimización), pero con su descripción.
  if exists (
    select 1 from transacciones_detectadas
    where clave_captura_id = v_clave.id and usuario_id = v_clave.usuario_id
      and monto = v_monto and descripcion = v_descripcion
      and created_at > now() - interval '2 minutes'
  ) then
    return jsonb_build_object('estado', 'repetido', 'monto', v_monto);
  end if;

  -- ¿Con qué tarjeta? Los últimos dígitos mandan: una sola cuenta tuya con
  -- ese identificador (del banco nombrado, si lo hay). Sin dígitos que
  -- coincidan, la única tarjeta de ese banco, salvo que tenga anotados otros
  -- dígitos (entonces el pago fue con una tarjeta que no registraste).
  v_digitos := substring(v_tarjeta from '([0-9]{3,4})[^0-9]*$');
  v_banco := case
    when v_tarjeta ~* 'produbanco' then 'produbanco'
    when v_tarjeta ~* 'guayaquil' then 'banco_guayaquil'
    when v_tarjeta ~* 'pichincha' then 'pichincha'
    when v_tarjeta ~* 'diners' then 'diners_club'
    when v_tarjeta ~* 'pac[ií]fico' then 'banco_pacifico'
    when v_tarjeta ~* 'austro' then 'banco_austro'
  end;
  if v_digitos is not null then
    select case when count(*) = 1 then (array_agg(id))[1] end into v_cuenta
    from cuentas
    where usuario_id = v_clave.usuario_id and tipo <> 'efectivo' and identificador = v_digitos
      and (v_banco is null or banco = v_banco);
    v_por_digitos := v_cuenta is not null;
  end if;
  if v_cuenta is null and v_banco is not null then
    select case when count(*) = 1 then (array_agg(id))[1] end into v_cuenta
    from cuentas
    where usuario_id = v_clave.usuario_id and banco = v_banco and tipo <> 'efectivo'
      and (v_digitos is null or identificador is null);
  end if;

  -- Ubicación opcional: si viene mal, el aviso llega igual sin ella. Una
  -- precisión ilegible o de más de 50 km también la descarta: sin saber el
  -- margen, la base la tomaría por exacta y la asignaría a un lugar.
  v_lat := interpretar_coordenada(p_latitud);
  v_lon := interpretar_coordenada(p_longitud);
  if nullif(btrim(coalesce(p_precision, '')), '') is not null then
    v_precision := case
      when btrim(replace(p_precision, ',', '.')) ~ '^[0-9]{1,9}(\.[0-9]{1,6})?$'
        and btrim(replace(p_precision, ',', '.'))::numeric <= 50000
        then round(btrim(replace(p_precision, ',', '.'))::numeric)::int
    end;
    if v_precision is null then
      v_lat := null;
    end if;
  end if;
  if v_lat is null or v_lon is null or abs(v_lat) > 90 or abs(v_lon) > 180 then
    v_lat := null;
    v_lon := null;
    v_precision := null;
  end if;

  v_categoria := categoria_sugerida(v_clave.usuario_id, v_comercio);

  insert into transacciones_detectadas (
    usuario_id, mensaje_id, tipo, monto, descripcion, banco, cuenta_id, categoria_id, fecha,
    origen, comercio, latitud, longitud, precision_m, tarjeta_final, clave_captura_id, pagado_en
  ) values (
    v_clave.usuario_id, p_billetera || ':' || gen_random_uuid(), 'gasto', v_monto, v_descripcion,
    v_banco, v_cuenta, v_categoria, v_fecha,
    p_billetera, v_comercio, v_lat, v_lon, v_precision, v_digitos, v_clave.id, p_cuando
  )
  returning id into v_aviso;

  update claves_captura set ultimo_uso = now() where id = v_clave.id;

  -- Registro automático: solo con la tarjeta reconocida por sus dígitos.
  if v_por_digitos and registro_automatico_activo(v_clave.usuario_id) then
    select tipo into v_tipo_cuenta from cuentas where id = v_cuenta;
    if v_lat is null then
      v_lugar := lugar_por_comercio(v_clave.usuario_id, v_comercio);
    end if;
    begin
      insert into gastos (
        usuario_id, monto, descripcion, categoria_id, categoria_detalle, cuenta_id, fecha,
        metodo_pago, billetera, latitud, longitud, precision_m, lugar_id, pagado_en
      ) values (
        v_clave.usuario_id, v_monto, v_descripcion, v_categoria,
        case when (select nombre from categorias where id = v_categoria) = 'Otros' then left(v_descripcion, 80) end,
        v_cuenta, v_fecha,
        case v_tipo_cuenta when 'credito' then 'credito' else 'debito' end,
        p_billetera, v_lat, v_lon, v_precision, v_lugar, coalesce(p_cuando, now())
      )
      returning id into v_gasto;
      update transacciones_detectadas set estado = 'confirmado', gasto_id = v_gasto where id = v_aviso;
    exception when others then
      -- Por ejemplo, supera el cupo de la tarjeta: queda en la bandeja.
      v_gasto := null;
    end;
  end if;

  if v_gasto is null then
    -- No se devuelve nada del usuario: solo que llegó y el monto que se leyó.
    return jsonb_build_object('estado', 'recibido', 'monto', v_monto);
  end if;

  -- Registrado: el teléfono avisa «Registré $12,50 en SUPERMAXI» con la
  -- categoría y, si este pago cruzó un nivel de un presupuesto, también eso.
  -- Comercio y dígitos son los que mandó el teléfono; categoría y presupuesto
  -- son lo único del usuario que sale, y solo hacia quien tiene la clave.
  select nombre into v_categoria_nombre from categorias where id = v_categoria;
  v_presupuestos := revisar_presupuestos(v_clave.usuario_id, to_char(v_fecha, 'YYYY-MM'), v_categoria);
  return jsonb_strip_nulls(jsonb_build_object(
    'estado', 'registrado',
    'monto', v_monto,
    'gasto_id', v_gasto,
    'comercio', v_comercio,
    'tarjeta', v_digitos,
    'categoria', v_categoria_nombre,
    'presupuesto', v_presupuestos -> 0
  ));
end;
$$;

revoke all on function public.registrar_pago_con_clave(uuid, text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;

-- El atajo de Apple Pay: misma firma y mismos errores que antes.
create or replace function public.registrar_pago_billetera(
  p_clave text,
  p_monto text,
  p_comercio text default null,
  p_tarjeta text default null,
  p_latitud text default null,
  p_longitud text default null,
  p_precision text default null,
  p_billetera text default 'apple_pay'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clave claves_captura;
begin
  -- La clave primero, y sin decir nada más: una clave mal escrita, inventada
  -- o revocada reciben el mismo error. Se mira el formato antes de calcular
  -- la huella para no gastar trabajo en textos enormes.
  if p_clave is null or p_clave !~ '^ft_[0-9a-f]{64}$' then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;
  select * into v_clave from claves_captura
  where huella = encode(sha256(convert_to(p_clave, 'UTF8')), 'hex')
  for update; -- dos llamadas a la vez con la misma clave cuentan bien el límite
  if not found then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;
  return registrar_pago_con_clave(v_clave.id, p_monto, p_comercio, p_tarjeta,
    p_latitud, p_longitud, p_precision, p_billetera, null);
end;
$$;

revoke all on function public.registrar_pago_billetera(text, text, text, text, text, text, text, text) from public, authenticated;
grant execute on function public.registrar_pago_billetera(text, text, text, text, text, text, text, text) to anon;

-- La notificación de Google Wallet: igual que en 20261016220000_hora_del_pago,
-- pero la hora de la notificación entra desde el principio, así el gasto
-- registrado solo también lleva la fecha y la hora del pago.
create or replace function public.registrar_aviso_billetera(
  p_clave text,
  p_titulo text default null,
  p_texto text default null,
  p_paquete text default 'com.google.android.apps.walletnfcrel',
  p_cuando text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clave claves_captura;
  v_aviso jsonb;
  v_cuando timestamptz;
begin
  -- La clave primero, con el mismo error que el atajo de Apple Pay.
  if p_clave is null or p_clave !~ '^ft_[0-9a-f]{64}$' then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;
  select * into v_clave from claves_captura
  where huella = encode(sha256(convert_to(p_clave, 'UTF8')), 'hex')
  for update;
  if not found then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;

  -- Solo Google Wallet, por ahora.
  if p_paquete is distinct from 'com.google.android.apps.walletnfcrel' then
    raise exception 'Aplicación no admitida.' using errcode = '22023';
  end if;

  v_aviso := leer_aviso_google_wallet(p_titulo, p_texto);
  if (v_aviso ->> 'ignorar')::boolean then
    return jsonb_build_object('estado', 'ignorado');
  end if;

  -- Hora del pago según la notificación (sirve si llegó tarde, sin
  -- internet). Se acepta hasta 3 días atrás; si no, cuenta como ahora.
  if btrim(coalesce(p_cuando, '')) ~ '^[0-9]{13}$' then
    v_cuando := to_timestamp(btrim(p_cuando)::numeric / 1000);
    if v_cuando not between now() - interval '3 days' and now() + interval '10 minutes' then
      v_cuando := null;
    end if;
  end if;

  return registrar_pago_con_clave(v_clave.id, v_aviso ->> 'monto', v_aviso ->> 'comercio', v_aviso ->> 'tarjeta',
    null, null, null, 'google_wallet', v_cuando);
end;
$$;

revoke all on function public.registrar_aviso_billetera(text, text, text, text, text) from public, authenticated;
grant execute on function public.registrar_aviso_billetera(text, text, text, text, text) to anon;

-- 5) Confirmar en la bandeja: lugar por comercio y gasto creado ----------
-- Igual que en 20261016220000_hora_del_pago, más el lugar por comercio para
-- los pagos con billetera sin ubicación, y `gasto_id` en el aviso.

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
  v_pagado_en timestamptz;
  v_lugar uuid;
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
      v_pagado_en := coalesce(v_aviso.pagado_en, v_aviso.created_at);
      if p_cuenta_id is not null then
        select case tipo when 'credito' then 'credito' when 'efectivo' then null else 'debito' end
        into v_metodo
        from cuentas where id = p_cuenta_id;
      end if;
      if v_aviso.latitud is null then
        v_lugar := lugar_por_comercio(v_aviso.usuario_id, v_aviso.comercio);
      end if;
    end if;
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha,
                        metodo_pago, billetera, latitud, longitud, precision_m, lugar_id, pagado_en)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha,
            v_metodo, v_billetera, v_aviso.latitud, v_aviso.longitud, v_aviso.precision_m, v_lugar, v_pagado_en)
    returning id into v_id;
  else
    insert into ingresos (monto, descripcion, categoria_id, cuenta_id, fecha)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha)
    returning id into v_id;
  end if;

  -- El trigger proteger_estado_aviso borra asunto, comercio, ubicación y tarjeta.
  update transacciones_detectadas
  set estado = 'confirmado', gasto_id = case when v_aviso.tipo = 'gasto' then v_id end
  where id = p_id;

  return v_id;
end;
$$;

revoke execute on function public.confirmar_transaccion_detectada(uuid, numeric, text, uuid, uuid) from public, anon;
grant execute on function public.confirmar_transaccion_detectada(uuid, numeric, text, uuid, uuid) to authenticated;

-- `confirmar_transaccion_detectada` es security invoker: quien confirma debe
-- poder ejecutar `lugar_por_comercio` (que también es invoker: ve solo lo suyo).
grant execute on function public.lugar_por_comercio(uuid, text) to authenticated;

-- 6) Exportación de datos personales: con las tablas nuevas --------------
-- Igual que en 20261016211000_exportar_datos_persona, más transferencias,
-- ajustes y avisos de presupuesto.

create or replace function public.exportar_datos_persona(p_correo text)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'Solo la administración puede exportar datos.' using errcode = '42501';
  end if;

  select id into v_usuario from auth.users where lower(email) = lower(btrim(p_correo));
  if v_usuario is null then
    raise exception 'No existe una cuenta con ese correo.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'exportado_en', now(),
    'cuenta', (
      select jsonb_build_object('id', u.id, 'correo', u.email, 'creada', u.created_at, 'ultimo_ingreso', u.last_sign_in_at)
      from auth.users u where u.id = v_usuario
    ),
    'aceptaciones_legales', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.aceptado_en, t.documento), '[]'::jsonb) from public.aceptaciones_legales t where t.usuario_id = v_usuario),
    'ajustes_usuario', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id'), '[]'::jsonb) from public.ajustes_usuario t where t.usuario_id = v_usuario),
    'cuentas', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.cuentas t where t.usuario_id = v_usuario),
    'categorias', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.nombre, t.id), '[]'::jsonb) from public.categorias t where t.usuario_id = v_usuario),
    'gastos', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.gastos t where t.usuario_id = v_usuario),
    'ingresos', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.ingresos t where t.usuario_id = v_usuario),
    'transferencias', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.transferencias t where t.usuario_id = v_usuario),
    'deudas', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.deudas t where t.usuario_id = v_usuario),
    'abonos_deuda', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.abonos_deuda t where t.usuario_id = v_usuario),
    'pagos_tarjeta', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.pagos_tarjeta t where t.usuario_id = v_usuario),
    'presupuestos', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.mes, t.id), '[]'::jsonb) from public.presupuestos t where t.usuario_id = v_usuario),
    'avisos_presupuesto', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.avisos_presupuesto t where t.usuario_id = v_usuario),
    'recordatorios', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.id), '[]'::jsonb) from public.recordatorios t where t.usuario_id = v_usuario),
    'transacciones_detectadas', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.transacciones_detectadas t where t.usuario_id = v_usuario),
    'lugares', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.lugares t where t.usuario_id = v_usuario),
    -- Sin la huella: es un secreto derivado de la clave.
    'claves_captura', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' - 'huella' order by t.created_at, t.id), '[]'::jsonb) from public.claves_captura t where t.usuario_id = v_usuario),
    'facturas_guardadas', (
      select coalesce(jsonb_agg(o.name order by o.name), '[]'::jsonb)
      from storage.objects o
      where o.bucket_id = 'facturas' and (storage.foldername(o.name))[1] = v_usuario::text
    )
  );
end;
$$;

revoke all on function public.exportar_datos_persona(text) from public, anon, authenticated;

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261016220000', 'hora_del_pago'),
  ('20261016230000', 'diferido_fecha_fija'),
  ('20261018120000', 'ajustes_y_transferencias'),
  ('20261018130000', 'registro_automatico_billetera')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261018130000') then 'sí' else 'no' end as aplicada;
