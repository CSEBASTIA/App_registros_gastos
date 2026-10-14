-- P0 · Correo: confirmación atómica y menos datos guardados.
--
-- 1) Confirmar un movimiento de la bandeja eran dos llamadas (crear el
--    gasto/ingreso y luego marcar el aviso). Si la segunda fallaba, un
--    reintento duplicaba el gasto y descuadraba el saldo. Ahora es una sola
--    función, en una transacción y con la fila bloqueada: si el aviso ya
--    estaba confirmado no vuelve a crear nada (reintentar es seguro).
-- 2) Minimización: el asunto original del correo solo hace falta mientras
--    se revisa. Al confirmar o descartar se borra (`correo_asunto = null`).
--
-- `security invoker`: corre con los permisos de quien llama, así RLS limita
-- cada lectura y escritura a los datos propios, y los triggers de saldo y de
-- validación de referencias actúan igual que con un alta normal.

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
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha)
    returning id into v_id;
  else
    insert into ingresos (monto, descripcion, categoria_id, cuenta_id, fecha)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha)
    returning id into v_id;
  end if;

  update transacciones_detectadas
  set estado = 'confirmado', correo_asunto = null
  where id = p_id;

  return v_id;
end;
$$;

revoke execute on function public.confirmar_transaccion_detectada(uuid, numeric, text, uuid, uuid) from public, anon;
grant execute on function public.confirmar_transaccion_detectada(uuid, numeric, text, uuid, uuid) to authenticated;

-- (Los avisos resueltos antes de esta migración conservan su asunto: no se
-- reescriben filas viejas, porque los límites de texto se agregaron NOT VALID
-- y una fila antigua fuera de límite haría fallar la migración entera.)

notify pgrst, 'reload schema';
