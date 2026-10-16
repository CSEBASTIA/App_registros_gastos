-- =====================================================================
-- gastos-app — Migración de captura de Google Wallet · 16-10-2026 5AM
-- Para un proyecto que ya tiene la base anterior. Incluye 1 archivo(s):
--   - 20261016180000_captura_google_wallet.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261016180000_captura_google_wallet.sql
-- Migración de captura de Google Wallet (fase 4 del plan de billeteras).
--
-- En Android, la app lee la notificación que Google Wallet muestra al pagar
-- (solo la de esa app) y la envía con la clave de captura, igual que el
-- atajo de Apple Pay. La base lee el título y el texto y crea el aviso en la
-- bandeja, usando `registrar_pago_billetera` (misma clave, límites de uso,
-- detección de repetidos y de tarjeta).
--
-- La lectura del texto vive aquí y no en el teléfono: si Google cambia el
-- formato de sus notificaciones, se corrige con una actualización de la base,
-- sin publicar otra versión de la app. Sirve también para MacroDroid o
-- Tasker, que pueden enviar el título y el texto de la notificación.
--
-- Avisos que no son un pago (sin monto) o que son un pago rechazado o un
-- reembolso se ignoran: no llegan a la bandeja.
-- Sin SQL dinámico.

-- 1) Leer el aviso -----------------------------------------------------
-- Devuelve {monto, comercio, tarjeta, ignorar}. `monto` es el texto del
-- número (lo interpreta `interpretar_monto_texto`).

create or replace function public.leer_aviso_google_wallet(p_titulo text, p_texto text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_titulo text;
  v_texto text;
  v_todo text;
  v_pago text;
  v_monto text;
  v_comercio text;
  v_final text;
  v_banco text;
  v_m text[];
begin
  -- Textos de terceros: sin caracteres de control, espacios normales, acotados.
  v_titulo := btrim(regexp_replace(regexp_replace(left(coalesce(p_titulo, ''), 500),
    '[[:cntrl:]' || chr(160) || chr(8239) || ']', ' ', 'g'), '\s+', ' ', 'g'));
  v_texto := btrim(regexp_replace(regexp_replace(left(coalesce(p_texto, ''), 500),
    '[[:cntrl:]' || chr(160) || chr(8239) || ']', ' ', 'g'), '\s+', ' ', 'g'));
  -- Salto de línea como separador: no se confunde con los puntos de "•••• 1234".
  v_todo := v_titulo || chr(10) || v_texto;
  -- Lo que sigue a "con"/"with" es el medio de pago: ahí se buscan el banco y
  -- los últimos dígitos (no en el comercio, que puede llamarse "… Guayaquil").
  v_pago := coalesce(substring(v_texto from '(?:^|\s)(?:con|with)\s+(.*)$'), v_texto);

  if v_todo ~* '(rechaz|declin|no se (pudo|complet|proces)|reembols|refund|devoluci|revers)' then
    return jsonb_build_object('ignorar', true);
  end if;

  -- Monto: "$12.50", "US$ 12,50", "USD 12.50" o "12,50 USD", primero en el texto.
  v_m := regexp_match(v_texto, '(us\$|usd|\$)\s?([0-9][0-9.,]*)', 'i');
  if v_m is null then
    v_m := regexp_match(v_texto, '()([0-9][0-9.,]*)\s?(usd|us\$|d[oó]lares)', 'i');
  end if;
  if v_m is null then
    v_m := regexp_match(v_titulo, '(us\$|usd|\$)\s?([0-9][0-9.,]*)', 'i');
  end if;
  v_monto := rtrim(v_m[2], '.,');
  if v_monto is null or v_monto = '' then
    return jsonb_build_object('ignorar', true);
  end if;

  -- Comercio: el título, salvo que sea genérico o traiga el monto; entonces,
  -- lo que sigue a "en"/"at" en el texto, hasta "con"/"with"/"el".
  if v_titulo <> ''
     and v_titulo !~* '^(google ?wallet|wallet|google ?pay|g ?pay|pago|pagos|compra|pagaste|transacci[oó]n|nuevo pago|pago realizado|compra realizada)\W*$'
     and v_titulo !~* '(us\$|usd|\$)\s?[0-9]' then
    v_comercio := v_titulo;
  else
    v_comercio := substring(v_texto from '(?:^|\s)(?:en|at)\s+(.*)$');
    v_comercio := regexp_replace(v_comercio, '\s+(con|with|el|on|por|usando|using|mediante)\s+.*$', '', 'i');
    v_comercio := nullif(btrim(v_comercio, ' .,;:·-'), '');
  end if;

  -- Tarjeta: "•••• 1234", "**1234", "terminada en 1234" o "ending in 1234",
  -- y el banco si aparece.
  v_final := coalesce(
    substring(v_pago from '[•·∙●*]+\s?([0-9]{4})'),
    (regexp_match(v_pago, 'termina(?:da)?\s+en\s+([0-9]{4})', 'i'))[1],
    (regexp_match(v_pago, 'ending\s+in\s+([0-9]{4})', 'i'))[1]
  );
  v_banco := (regexp_match(v_pago,'(produbanco|guayaquil|pichincha|diners|pac[ií]fico|austro)', 'i'))[1];

  return jsonb_build_object(
    'ignorar', false,
    'monto', v_monto,
    'comercio', left(v_comercio, 200),
    'tarjeta', nullif(concat_ws(' ', v_banco, v_final), '')
  );
end;
$$;

-- 2) Registrar el aviso ------------------------------------------------
-- p_cuando: hora de la notificación (milisegundos desde 1970, como la da
-- Android). Si el teléfono estaba sin internet y la envía después, la fecha
-- del aviso es la del pago. Se acepta hasta 3 días atrás.

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

  -- Fecha del pago si la notificación llegó tarde. La fila recién creada es
  -- la de esta transacción: su created_at es exactamente now().
  if v_resultado ->> 'estado' = 'recibido' and btrim(coalesce(p_cuando, '')) ~ '^[0-9]{13}$' then
    v_cuando := to_timestamp(btrim(p_cuando)::numeric / 1000);
    if v_cuando between now() - interval '3 days' and now() + interval '10 minutes' then
      update transacciones_detectadas
      set fecha = (v_cuando at time zone 'America/Guayaquil')::date
      where clave_captura_id = v_clave.id and usuario_id = v_clave.usuario_id
        and origen = 'google_wallet' and created_at = now();
    end if;
  end if;

  return v_resultado;
end;
$$;

-- Como el atajo: solo `anon` (la app de Android llama con la clave pública).
revoke all on function public.registrar_aviso_billetera(text, text, text, text, text) from public, authenticated;
grant execute on function public.registrar_aviso_billetera(text, text, text, text, text) to anon;
revoke all on function public.leer_aviso_google_wallet(text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261016180000', 'captura_google_wallet')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261016180000') then 'sí' else 'no' end as aplicada;
