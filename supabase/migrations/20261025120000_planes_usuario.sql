-- Migración de planes de pago (Gratis, Plus y Pro).
--
-- Los cobros los hace Google Play (y la App Store, cuando llegue) a través de
-- RevenueCat. RevenueCat avisa cada compra, renovación, cancelación o
-- vencimiento a la función `revenuecat-webhook`, que llama a
-- `registrar_evento_revenuecat` con la llave de servicio.
--
-- 1) Tabla `planes_usuario`: el plan de cada persona. Ella solo puede LEER el
--    suyo; nadie lo escribe desde la app (si no, cualquiera se pondría Pro).
--    Sin fila = plan Gratis.
-- 2) Tabla `eventos_pago`: cada aviso recibido, para no aplicarlo dos veces
--    (RevenueCat reintenta) y para revisar un cobro si alguien reclama. Solo
--    guarda lo necesario: ni precio, ni país, ni datos de la tarjeta.
-- 3) `registrar_evento_revenuecat`: aplica un aviso. Los avisos pueden llegar
--    desordenados; uno más viejo que el último aplicado no pisa el estado.
--
-- En RevenueCat, el `app_user_id` es el id de la persona en Supabase y los
-- "entitlements" se llaman `plus` y `pro`, igual que en packages/core/src/lib/planes.ts.

create table if not exists public.planes_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('plus', 'pro')),
  -- 'cancelada': no se renovará, pero sigue vigente hasta `vence_en`.
  estado text not null check (estado in ('activa', 'cancelada', 'vencida')),
  vence_en timestamptz,
  producto text check (char_length(producto) <= 200),
  entorno text check (entorno in ('PRODUCTION', 'SANDBOX')),
  ultimo_evento_en timestamptz not null,
  actualizado_en timestamptz not null default now()
);

alter table public.planes_usuario enable row level security;
revoke all on public.planes_usuario from anon, authenticated;
grant select on public.planes_usuario to authenticated;

drop policy if exists "planes_usuario: select propio" on public.planes_usuario;
create policy "planes_usuario: select propio" on public.planes_usuario
  for select to authenticated using ((select auth.uid()) = usuario_id);

create table if not exists public.eventos_pago (
  id text primary key check (char_length(id) <= 200),
  usuario_id uuid references auth.users(id) on delete cascade,
  tipo text not null check (char_length(tipo) <= 60),
  producto text check (char_length(producto) <= 200),
  entorno text,
  -- 'aplicado', 'antiguo', 'ignorado', 'prueba' o 'usuario_desconocido'.
  resultado text not null,
  ocurrido_en timestamptz,
  recibido_en timestamptz not null default now()
);

create index if not exists eventos_pago_usuario_idx on public.eventos_pago (usuario_id);

-- Sin acceso desde la API: solo la función de abajo la escribe.
alter table public.eventos_pago enable row level security;
revoke all on public.eventos_pago from anon, authenticated;

create or replace function public.registrar_evento_revenuecat(p_evento jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := p_evento ->> 'id';
  v_tipo text := upper(coalesce(p_evento ->> 'type', ''));
  v_producto text := left(p_evento ->> 'product_id', 200);
  v_entorno text := case when p_evento ->> 'environment' in ('PRODUCTION', 'SANDBOX') then p_evento ->> 'environment' end;
  v_usuario uuid;
  v_candidato text;
  v_en timestamptz;
  v_vence timestamptz;
  v_plan text;
  v_estado text;
  v_resultado text;
  v_anterior public.planes_usuario%rowtype;
begin
  if v_id is null or char_length(v_id) > 200 or v_tipo = '' or char_length(v_tipo) > 60 then
    raise exception 'aviso de pago sin id o sin tipo' using errcode = '22023';
  end if;

  -- RevenueCat reintenta: un aviso ya recibido no se aplica de nuevo.
  if exists (select 1 from eventos_pago where id = v_id) then
    return 'repetido';
  end if;

  if v_tipo = 'TEST' then
    insert into eventos_pago (id, tipo, resultado) values (v_id, v_tipo, 'prueba');
    return 'prueba';
  end if;

  -- La persona: app_user_id, o alguno de sus alias (antes de iniciar sesión,
  -- RevenueCat usa un id anónimo y después lo enlaza).
  for v_candidato in
    select x from (
      select p_evento ->> 'app_user_id' as x
      union all select p_evento ->> 'original_app_user_id'
      union all select jsonb_array_elements_text(coalesce(p_evento -> 'aliases', '[]'::jsonb))
    ) c where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  loop
    select id into v_usuario from auth.users where id = v_candidato::uuid;
    exit when v_usuario is not null;
  end loop;

  v_en := coalesce(to_timestamp((p_evento ->> 'event_timestamp_ms')::bigint / 1000.0), now());

  if v_usuario is null then
    insert into eventos_pago (id, tipo, producto, entorno, resultado, ocurrido_en)
      values (v_id, v_tipo, v_producto, v_entorno, 'usuario_desconocido', v_en);
    return 'usuario_desconocido';
  end if;

  if p_evento ->> 'expiration_at_ms' is not null then
    v_vence := to_timestamp((p_evento ->> 'expiration_at_ms')::bigint / 1000.0);
  end if;

  v_estado := case
    when v_tipo in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT') then 'activa'
    when v_tipo = 'CANCELLATION' then 'cancelada'
    when v_tipo = 'EXPIRATION' then 'vencida'
    -- BILLING_ISSUE (Google da días de gracia), PRODUCT_CHANGE (el cambio llega
    -- con la RENEWAL siguiente), SUBSCRIPTION_PAUSED, TRANSFER…: solo se anotan.
    else null
  end;

  select * into v_anterior from planes_usuario where usuario_id = v_usuario for update;

  -- Plan: el entitlement del aviso; si no lo trae (cancelación o vencimiento), el que ya tenía.
  v_plan := case
    when coalesce(p_evento -> 'entitlement_ids', '[]'::jsonb) ? 'pro' then 'pro'
    when coalesce(p_evento -> 'entitlement_ids', '[]'::jsonb) ? 'plus' then 'plus'
    else v_anterior.plan
  end;

  if v_estado is null or v_plan is null then
    v_resultado := 'ignorado';
  elsif v_anterior.usuario_id is not null and v_en < v_anterior.ultimo_evento_en then
    v_resultado := 'antiguo';
  else
    insert into planes_usuario as p (usuario_id, plan, estado, vence_en, producto, entorno, ultimo_evento_en, actualizado_en)
      values (v_usuario, v_plan, v_estado, v_vence, v_producto, v_entorno, v_en, now())
    on conflict (usuario_id) do update set
      plan = excluded.plan,
      estado = excluded.estado,
      vence_en = coalesce(excluded.vence_en, p.vence_en),
      producto = coalesce(excluded.producto, p.producto),
      entorno = coalesce(excluded.entorno, p.entorno),
      ultimo_evento_en = excluded.ultimo_evento_en,
      actualizado_en = now();
    v_resultado := 'aplicado';
  end if;

  insert into eventos_pago (id, usuario_id, tipo, producto, entorno, resultado, ocurrido_en)
    values (v_id, v_usuario, v_tipo, v_producto, v_entorno, v_resultado, v_en);
  return v_resultado;
end;
$$;

revoke all on function public.registrar_evento_revenuecat(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_evento_revenuecat(jsonb) to service_role;

-- Exportación de datos personales: con el plan y los avisos de pago ------
-- Igual que en 20261018130000_registro_automatico_billetera, más
-- planes_usuario y eventos_pago.

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
    'planes_usuario', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id'), '[]'::jsonb) from public.planes_usuario t where t.usuario_id = v_usuario),
    'eventos_pago', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.recibido_en, t.id), '[]'::jsonb) from public.eventos_pago t where t.usuario_id = v_usuario),
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
