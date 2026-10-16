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
