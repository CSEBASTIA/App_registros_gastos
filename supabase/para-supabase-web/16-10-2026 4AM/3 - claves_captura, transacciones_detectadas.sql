-- =====================================================================
-- gastos-app — Migración de captura con Apple Pay
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261016140000_captura_apple_pay.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261016140000_captura_apple_pay.sql
-- Migración de captura con Apple Pay (Fase 3 del plan de billeteras).
--
-- La automatización «Transacción» de Atajos (iOS 17+) se ejecuta al pagar con
-- Wallet y llama por HTTPS a `registrar_pago_billetera` con la clave pública
-- de Supabase (rol anon). Lo que autoriza es la **clave de captura** del
-- usuario, no la clave pública:
--   * es larga y aleatoria (244 bits), se muestra una sola vez y la base
--     guarda solo su huella SHA-256 (ni el dueño puede volver a leerla);
--   * con ella solo se deja un aviso PENDIENTE en la bandeja: no se lee nada
--     ni se crea ningún gasto. Lo peor que puede hacer quien la robe es
--     llenar la bandeja de avisos falsos, con un límite por hora y por día;
--   * se revoca borrándola (hasta 5 por usuario, una por dispositivo).
-- La fecha la pone el servidor (hora de Ecuador): el atajo corre al pagar.

-- 1) Claves de captura --------------------------------------------------

create table if not exists public.claves_captura (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  huella text not null unique check (huella ~ '^[0-9a-f]{64}$'),
  -- Primeros 6 caracteres de la clave, para reconocerla en la lista.
  prefijo text not null check (prefijo ~ '^[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz
);

create index if not exists claves_captura_usuario_idx on public.claves_captura (usuario_id);

alter table public.claves_captura enable row level security;
-- Sin INSERT ni UPDATE directos (solo la función crea claves) y sin poder
-- leer la huella: solo los datos para la lista y borrar (= revocar).
revoke all on public.claves_captura from anon, authenticated;
grant select (id, usuario_id, nombre, prefijo, created_at, ultimo_uso) on public.claves_captura to authenticated;
grant delete on public.claves_captura to authenticated;

drop policy if exists "claves_captura: select propio" on public.claves_captura;
create policy "claves_captura: select propio" on public.claves_captura
  for select to authenticated using (auth.uid() = usuario_id);
drop policy if exists "claves_captura: delete propio" on public.claves_captura;
create policy "claves_captura: delete propio" on public.claves_captura
  for delete to authenticated using (auth.uid() = usuario_id);

-- Cada aviso captado recuerda con qué clave llegó (para el límite de uso).
alter table public.transacciones_detectadas
  add column if not exists clave_captura_id uuid references public.claves_captura(id) on delete set null;
create index if not exists transacciones_detectadas_clave_idx
  on public.transacciones_detectadas (clave_captura_id, created_at) where clave_captura_id is not null;

create or replace function public.crear_clave_captura(p_nombre text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:cntrl:]]', '', 'g'));
  v_clave text;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if char_length(v_nombre) not between 1 and 40 then
    raise exception 'Ponle un nombre de 1 a 40 caracteres, por ejemplo «Mi iPhone».' using errcode = '22023';
  end if;
  -- Dos pedidos a la vez no pueden pasar juntos el tope de 5.
  perform pg_advisory_xact_lock(hashtext('claves_captura:' || v_usuario::text));
  if (select count(*) from claves_captura where usuario_id = v_usuario) >= 5 then
    raise exception 'Ya tienes 5 claves: revoca una antes de crear otra.' using errcode = '22023';
  end if;

  -- Dos UUID v4 = 244 bits del generador seguro de Postgres (sin pgcrypto).
  v_clave := 'ft_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into claves_captura (usuario_id, nombre, huella, prefijo)
  values (v_usuario, v_nombre, encode(sha256(convert_to(v_clave, 'UTF8')), 'hex'), substr(v_clave, 4, 6));
  -- La única vez que la clave sale de la base.
  return v_clave;
end;
$$;

revoke all on function public.crear_clave_captura(text) from public, anon;
grant execute on function public.crear_clave_captura(text) to authenticated;

-- 2) Leer el monto como lo manda el iPhone -------------------------------
-- Mismas reglas que `interpretarNumero` de core: "12,50", "12.50", "$12.50",
-- "US$ 1.234,56", "1,234.56". El último separador es de miles solo si lo
-- siguen 3 dígitos y lo anterior es una agrupación válida. NULL si no es un
-- monto positivo (también si viene negativo o con otra moneda).

create or replace function public.interpretar_monto_texto(p_texto text)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_limpio text;
  v_ultimo int;
  v_antes text;
  v_despues text;
  v_entero text;
begin
  if p_texto is null or char_length(p_texto) > 40 then
    return null;
  end if;
  v_limpio := translate(lower(p_texto), chr(160) || chr(8239), '  ');
  v_limpio := regexp_replace(v_limpio, '(usd|us\$|us|\$|[[:space:]])', '', 'g');
  if v_limpio !~ '^[0-9][0-9.,]*$' or v_limpio ~ '[.,]{2}' or v_limpio ~ '[.,]$' then
    return null;
  end if;

  v_ultimo := strpos(reverse(translate(v_limpio, ',', '.')), '.');
  if v_ultimo = 0 then
    return round(v_limpio::numeric, 2);
  end if;
  v_ultimo := char_length(v_limpio) - v_ultimo + 1;
  v_antes := substr(v_limpio, 1, v_ultimo - 1);
  v_despues := substr(v_limpio, v_ultimo + 1);
  v_entero := regexp_replace(v_antes, '[.,]', '', 'g');
  if char_length(v_despues) = 3 and v_antes ~ '^[1-9][0-9]{0,2}([.,][0-9]{3})*$' then
    return round((v_entero || v_despues)::numeric, 2);
  end if;
  return round((v_entero || '.' || v_despues)::numeric, 2);
end;
$$;

-- Coordenada como número o como texto con coma ("-0,1807"). NULL si no sirve.
create or replace function public.interpretar_coordenada(p_texto text)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when btrim(replace(p_texto, ',', '.')) ~ '^-?[0-9]{1,3}(\.[0-9]{1,12})?$'
      then btrim(replace(p_texto, ',', '.'))::numeric
  end
$$;

-- 3) Registrar el pago que manda el atajo -------------------------------

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
  v_monto numeric;
  v_comercio text;
  v_tarjeta text;
  v_digitos text;
  v_banco text;
  v_cuenta uuid;
  v_lat numeric;
  v_lon numeric;
  v_precision int;
  v_fecha date := (now() at time zone 'America/Guayaquil')::date;
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

  -- El mismo pago dos veces (el atajo se repitió): un solo aviso.
  if exists (
    select 1 from transacciones_detectadas
    where clave_captura_id = v_clave.id and usuario_id = v_clave.usuario_id
      and monto = v_monto and comercio is not distinct from v_comercio
      and created_at > now() - interval '2 minutes'
  ) then
    return jsonb_build_object('estado', 'repetido', 'monto', v_monto);
  end if;

  -- ¿Con qué tarjeta? Por el banco que aparece en su nombre y, si hay varias
  -- de ese banco, por los últimos dígitos. Si es ambiguo, se elige al revisar.
  v_digitos := substring(v_tarjeta from '([0-9]{3,4})[^0-9]*$');
  v_banco := case
    when v_tarjeta ~* 'produbanco' then 'produbanco'
    when v_tarjeta ~* 'guayaquil' then 'banco_guayaquil'
    when v_tarjeta ~* 'pichincha' then 'pichincha'
    when v_tarjeta ~* 'diners' then 'diners_club'
    when v_tarjeta ~* 'pac[ií]fico' then 'banco_pacifico'
    when v_tarjeta ~* 'austro' then 'banco_austro'
  end;
  if v_banco is not null then
    select case when count(*) = 1 then (array_agg(id))[1] end into v_cuenta
    from cuentas where usuario_id = v_clave.usuario_id and banco = v_banco and tipo <> 'efectivo';
    if v_cuenta is null and v_digitos is not null then
      select case when count(*) = 1 then (array_agg(id))[1] end into v_cuenta
      from cuentas where usuario_id = v_clave.usuario_id and banco = v_banco and tipo <> 'efectivo'
        and identificador = v_digitos;
    end if;
  elsif v_digitos is not null then
    select case when count(*) = 1 then (array_agg(id))[1] end into v_cuenta
    from cuentas where usuario_id = v_clave.usuario_id and tipo <> 'efectivo' and identificador = v_digitos;
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

  insert into transacciones_detectadas (
    usuario_id, mensaje_id, tipo, monto, descripcion, banco, cuenta_id, fecha,
    origen, comercio, latitud, longitud, precision_m, tarjeta_final, clave_captura_id
  ) values (
    v_clave.usuario_id, p_billetera || ':' || gen_random_uuid(), 'gasto', v_monto,
    coalesce(v_comercio, case p_billetera when 'apple_pay' then 'Pago con Apple Pay' else 'Pago con Google Wallet' end),
    v_banco, v_cuenta, v_fecha,
    p_billetera, v_comercio, v_lat, v_lon, v_precision, v_digitos, v_clave.id
  );

  update claves_captura set ultimo_uso = now() where id = v_clave.id;

  -- No se devuelve nada del usuario: solo que llegó y el monto que se leyó.
  return jsonb_build_object('estado', 'recibido', 'monto', v_monto);
end;
$$;

-- Solo `anon`, que es como llama el atajo (con la clave pública). Desde la
-- app, con sesión, no hace falta: así una sesión ajena tampoco puede usarla.
revoke all on function public.registrar_pago_billetera(text, text, text, text, text, text, text, text) from public, authenticated;
grant execute on function public.registrar_pago_billetera(text, text, text, text, text, text, text, text) to anon;
revoke all on function public.interpretar_monto_texto(text) from public, anon, authenticated;
revoke all on function public.interpretar_coordenada(text) from public, anon, authenticated;

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261016140000', 'captura_apple_pay')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261016140000') then 'sí' else 'no' end as aplicada;
