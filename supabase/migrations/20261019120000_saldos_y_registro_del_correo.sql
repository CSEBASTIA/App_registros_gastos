-- Migración de saldos y registro del correo.
--
-- 1) SALDOS. Solo una tarjeta de crédito puede quedar en negativo (pasarse del
--    cupo = sobreendeudamiento, que la app muestra en rojo con un aviso). Una
--    cuenta de ahorro, de débito o el efectivo nunca puede quedar con saldo
--    negativo: toda operación que la dejaría por debajo de cero se rechaza,
--    venga de donde venga (gasto, transferencia, pago de tarjeta, abono a una
--    deuda, borrar un ingreso…), porque se vigila el saldo de la cuenta misma.
--    Una cuenta que ya estaba en negativo (datos de antes) no se rompe: solo
--    se rechaza lo que la baje más.
--    Se quita el rechazo por cupo de `trg_03_validar_cupo_gasto` y el de las
--    transferencias desde una tarjeta (avance), y también el de la «Migración
--    de cupo en lote», si alguien la aplicó a mano.
-- 2) El aviso del correo recuerda de qué clase es (consumo, pago de tarjeta,
--    transferencia), la otra cuenta de la operación y la comisión del banco.
-- 3) `registrar_avisos_correo()`: lo que el correo trae con un formato conocido
--    y cuyas cuentas la persona ya identificó por sus últimos dígitos se
--    registra solo (con `registro_automatico` encendido, como los pagos de
--    Google Wallet): consumos con tarjeta, pagos de tarjeta y transferencias
--    entre cuentas propias. Si ya estaba registrado (Google Wallet o el otro
--    correo del mismo pago) no se duplica. Lo demás queda en la Bandeja.
-- 4) `confirmar_aviso_como_pago_tarjeta()`: confirmar un pago de tarjeta desde
--    la Bandeja.
-- 5) Los lugares guardan la dirección.
-- Sin SQL dinámico; search_path fijo en todas las funciones.

-- 1) Saldos -------------------------------------------------------------

create or replace function public.validar_saldo_cuenta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> 'credito' and new.disponible < 0
     and (tg_op = 'INSERT' or new.disponible < old.disponible or new.tipo is distinct from old.tipo) then
    raise exception 'La cuenta «%» no puede quedar con saldo negativo (quedaría en $%). Solo una tarjeta de crédito puede pasarse del cupo.',
      new.nombre, to_char(new.disponible, 'FM9999999990.00')
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_saldo_cuenta on public.cuentas;
create trigger trg_validar_saldo_cuenta
  before insert or update of disponible, tipo on public.cuentas
  for each row execute function public.validar_saldo_cuenta();

-- Una tarjeta puede pasarse del cupo: ya no se rechaza el gasto.
drop trigger if exists trg_03_validar_cupo_gasto on public.gastos;
drop function if exists public.validar_cupo_gasto();
drop trigger if exists trg_validar_cupo_lote_insert on public.gastos;
drop trigger if exists trg_validar_cupo_lote_update on public.gastos;
drop function if exists public.validar_cupo_gastos_en_lote();

-- Igual que en 20261018120000_ajustes_y_transferencias, sin el rechazo por
-- cupo cuando el origen es una tarjeta (un avance puede pasarse del cupo).
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
  new.descripcion := nullif(btrim(regexp_replace(coalesce(new.descripcion, ''), '[[:cntrl:]]', ' ', 'g')), '');
  return new;
end;
$$;

-- 2) Lo que el correo sabe de cada aviso ---------------------------------

alter table public.transacciones_detectadas
  add column if not exists clase text,
  add column if not exists contraparte_cuenta_id uuid references public.cuentas(id) on delete set null,
  add column if not exists comision numeric(12, 2);

alter table public.transacciones_detectadas drop constraint if exists transacciones_detectadas_clase_valida;
alter table public.transacciones_detectadas add constraint transacciones_detectadas_clase_valida
  check (clase is null or clase in ('consumo', 'pago_tarjeta', 'transferencia'));
alter table public.transacciones_detectadas drop constraint if exists transacciones_detectadas_comision_valida;
alter table public.transacciones_detectadas add constraint transacciones_detectadas_comision_valida
  check (comision is null or (comision >= 0 and comision <= 9999999999.99));

create index if not exists transacciones_detectadas_pago_idx
  on public.transacciones_detectadas (usuario_id, monto) where clase = 'pago_tarjeta';
-- Borrar una cuenta pone en NULL esta columna en sus avisos: sin índice, recorre la tabla.
create index if not exists transacciones_detectadas_contraparte_idx
  on public.transacciones_detectadas (contraparte_cuenta_id) where contraparte_cuenta_id is not null;

-- 5) Dirección de los lugares ---------------------------------------------

alter table public.lugares add column if not exists direccion text;
alter table public.lugares drop constraint if exists lugares_direccion_valida;
alter table public.lugares add constraint lugares_direccion_valida
  check (direccion is null or char_length(btrim(direccion)) between 1 and 200);

-- 3) Registrar solo lo que el correo trae ---------------------------------

create or replace function public.registrar_avisos_correo()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  a transacciones_detectadas;
  v_cuenta cuentas;
  v_otra cuentas;
  v_resultados jsonb := '[]'::jsonb;
  v_gasto uuid;
  v_pago uuid;
  v_transferencia uuid;
  v_existente uuid;
  v_categoria uuid;
  v_categoria_nombre text;
  v_lugar uuid;
  v_comercio text;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para registrar tus movimientos.' using errcode = '28000';
  end if;
  if not registro_automatico_activo(v_usuario) then
    return v_resultados;
  end if;

  for a in
    select * from transacciones_detectadas
    where usuario_id = v_usuario and estado = 'pendiente' and origen = 'correo'
      and (clase is not null or (es_transferencia and tipo = 'ingreso'))
    order by coalesce(pagado_en, fecha::timestamptz), created_at, id
    for update
  loop
    -- Cada aviso va en su propio bloque: si uno no se puede registrar (por
    -- ejemplo, dejaría una cuenta en negativo), queda en la Bandeja y los
    -- demás siguen.
    begin
      v_cuenta := null;
      v_otra := null;
      if a.cuenta_id is not null then
        select * into v_cuenta from cuentas where id = a.cuenta_id and usuario_id = v_usuario;
      end if;
      if a.contraparte_cuenta_id is not null then
        select * into v_otra from cuentas where id = a.contraparte_cuenta_id and usuario_id = v_usuario;
      end if;

      -- La otra mitad de una transferencia que ya se registró sola: el aviso
      -- de «recibida» de la cuenta destino no se vuelve a contar.
      if a.clase is null then
        select t.id into v_existente
        from transferencias t
        where t.usuario_id = v_usuario and t.origen = 'correo' and a.cuenta_id is not null
          and t.cuenta_destino_id = a.cuenta_id and t.monto = a.monto
          and t.fecha between a.fecha - 2 and a.fecha + 2
          and t.created_at > now() - interval '3 days'
          and not exists (select 1 from transacciones_detectadas o where o.transferencia_id = t.id and o.tipo = 'ingreso')
        order by t.created_at desc
        limit 1;
        if found then
          update transacciones_detectadas set estado = 'confirmado', transferencia_id = v_existente where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'ya_registrado', 'clase', 'transferencia');
        end if;
        continue;
      end if;

      if a.clase = 'consumo' then
        continue when v_cuenta.id is null or v_cuenta.tipo = 'efectivo';
        -- Ya lo registró otro camino (Google Wallet) a la misma hora: no se duplica.
        select g.id into v_existente
        from gastos g
        where g.usuario_id = v_usuario and g.cuenta_id = a.cuenta_id and g.monto = a.monto
          and g.pagado_en is not null and a.pagado_en is not null
          and abs(extract(epoch from g.pagado_en - a.pagado_en)) <= 600
        limit 1;
        if found then
          update transacciones_detectadas set estado = 'confirmado', gasto_id = v_existente where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'ya_registrado', 'clase', 'consumo', 'gasto_id', v_existente);
          continue;
        end if;
        -- ¿Lo anotaste tú a mano el mismo día (sin hora)? Que decida la persona.
        continue when exists (
          select 1 from gastos g
          where g.usuario_id = v_usuario and g.cuenta_id = a.cuenta_id and g.monto = a.monto
            and g.fecha = a.fecha and g.pagado_en is null
        );

        v_comercio := coalesce(nullif(btrim(a.comercio), ''), a.descripcion);
        v_categoria := categoria_sugerida(v_usuario, v_comercio);
        v_lugar := lugar_por_comercio(v_usuario, a.comercio);
        insert into gastos (
          usuario_id, monto, descripcion, categoria_id, categoria_detalle, cuenta_id, fecha,
          metodo_pago, pagado_en, lugar_id
        ) values (
          v_usuario, a.monto, left(v_comercio, 200), v_categoria,
          case when (select nombre from categorias where id = v_categoria) = 'Otros' then left(v_comercio, 80) end,
          a.cuenta_id, a.fecha,
          case v_cuenta.tipo when 'credito' then 'credito' else 'debito' end,
          a.pagado_en, v_lugar
        )
        returning id into v_gasto;
        update transacciones_detectadas set estado = 'confirmado', gasto_id = v_gasto where id = a.id;
        select nombre into v_categoria_nombre from categorias where id = v_categoria;
        v_resultados := v_resultados || jsonb_strip_nulls(jsonb_build_object(
          'aviso', a.id, 'resultado', 'registrado', 'clase', 'consumo', 'gasto_id', v_gasto,
          'monto', a.monto, 'comercio', v_comercio, 'fecha', a.fecha,
          'cuenta', v_cuenta.nombre, 'tarjeta', coalesce(v_cuenta.identificador, a.tarjeta_final),
          'categoria', v_categoria_nombre, 'sin_lugar', v_lugar is null
        ));

      elsif a.clase = 'pago_tarjeta' then
        -- El mismo pago llega en dos correos (el del banco y el comprobante): se cuenta una vez.
        select o.id into v_existente
        from transacciones_detectadas o
        where o.usuario_id = v_usuario and o.id <> a.id and o.clase = 'pago_tarjeta' and o.estado = 'confirmado'
          and o.monto = a.monto and o.pagado_en is not null and a.pagado_en is not null
          and abs(extract(epoch from o.pagado_en - a.pagado_en)) <= 600
        limit 1;
        if found then
          update transacciones_detectadas set estado = 'confirmado' where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'ya_registrado', 'clase', 'pago_tarjeta');
          continue;
        end if;
        -- Hace falta saber la tarjeta y de qué cuenta se pagó: si no, la Bandeja.
        continue when v_cuenta.id is null or v_cuenta.tipo <> 'credito' or v_otra.id is null or v_otra.tipo = 'credito';
        insert into pagos_tarjeta (usuario_id, cuenta_id, cuenta_origen_id, monto, fecha)
        values (v_usuario, a.cuenta_id, a.contraparte_cuenta_id, a.monto, a.fecha)
        returning id into v_pago;
        update transacciones_detectadas set estado = 'confirmado' where id = a.id;
        v_resultados := v_resultados || jsonb_strip_nulls(jsonb_build_object(
          'aviso', a.id, 'resultado', 'registrado', 'clase', 'pago_tarjeta', 'pago_id', v_pago,
          'monto', a.monto, 'fecha', a.fecha, 'cuenta', v_cuenta.nombre, 'origen', v_otra.nombre,
          'tarjeta', coalesce(v_cuenta.identificador, a.tarjeta_final)
        ));

      elsif a.clase = 'transferencia' then
        -- Solo entre cuentas propias: si el destino no es una cuenta tuya
        -- reconocida, no se sabe si es un gasto: la Bandeja.
        continue when v_cuenta.id is null or v_otra.id is null or v_cuenta.id = v_otra.id
          or v_cuenta.tipo = 'credito' or v_otra.tipo = 'credito';
        insert into transferencias (usuario_id, cuenta_origen_id, cuenta_destino_id, monto, fecha, descripcion, origen)
        values (v_usuario, a.cuenta_id, a.contraparte_cuenta_id, a.monto, a.fecha, 'Transferencia entre mis cuentas', 'correo')
        returning id into v_transferencia;
        -- La comisión del banco sí es un gasto.
        if coalesce(a.comision, 0) > 0 then
          v_categoria := categoria_sugerida(v_usuario, 'comisión bancaria');
          insert into gastos (usuario_id, monto, descripcion, categoria_id, categoria_detalle, cuenta_id, fecha, metodo_pago, pagado_en)
          values (
            v_usuario, a.comision, 'Comisión de transferencia', v_categoria,
            case when (select nombre from categorias where id = v_categoria) = 'Otros' then 'Comisión de transferencia' end,
            a.cuenta_id, a.fecha, case v_cuenta.tipo when 'debito' then 'debito' end, a.pagado_en
          );
        end if;
        update transacciones_detectadas set estado = 'confirmado', transferencia_id = v_transferencia where id = a.id;
        v_resultados := v_resultados || jsonb_strip_nulls(jsonb_build_object(
          'aviso', a.id, 'resultado', 'registrado', 'clase', 'transferencia', 'transferencia_id', v_transferencia,
          'monto', a.monto, 'fecha', a.fecha, 'cuenta', v_cuenta.nombre, 'destino', v_otra.nombre,
          'comision', a.comision
        ));
      end if;
    exception when others then
      -- Queda pendiente en la Bandeja (la subtransacción deshizo lo que alcanzó a escribir).
      null;
    end;
  end loop;

  return v_resultados;
end;
$$;

revoke all on function public.registrar_avisos_correo() from public, anon;
grant execute on function public.registrar_avisos_correo() to authenticated;

-- 4) Confirmar un pago de tarjeta desde la Bandeja ---------------------------

-- p_tarjeta: la tarjeta que se pagó; p_origen: la cuenta de la que salió el
-- dinero. Si el mismo pago llegó en otro correo también pendiente, se resuelve
-- junto. Idempotente: si ya estaba confirmado devuelve null.
create or replace function public.confirmar_aviso_como_pago_tarjeta(
  p_id uuid,
  p_tarjeta uuid,
  p_origen uuid,
  p_monto numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_aviso transacciones_detectadas;
  v_monto numeric(12, 2);
  v_pago uuid;
begin
  select * into v_aviso from transacciones_detectadas where id = p_id for update;
  if not found then
    raise exception 'El movimiento detectado no existe o no es tuyo.' using errcode = '42501';
  end if;
  if v_aviso.estado = 'confirmado' then
    return null;
  end if;
  if v_aviso.estado = 'descartado' then
    raise exception 'Este movimiento ya fue descartado.' using errcode = '22023';
  end if;
  if v_aviso.origen <> 'correo' then
    raise exception 'Solo un aviso del correo puede confirmarse como pago de tarjeta.' using errcode = '22023';
  end if;
  if p_tarjeta is null or p_origen is null then
    raise exception 'Elige la tarjeta y la cuenta desde la que pagaste.' using errcode = '22023';
  end if;
  if not exists (select 1 from cuentas where id = p_tarjeta and tipo = 'credito') then
    raise exception 'Elige una tarjeta de crédito.' using errcode = '22023';
  end if;
  v_monto := round(coalesce(p_monto, v_aviso.monto), 2);
  if v_monto is null or v_monto < 0.01 or v_monto > 9999999999.99 then
    raise exception 'Escribe un monto válido, por ejemplo 12,50.' using errcode = '22023';
  end if;

  insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto, fecha)
  values (p_tarjeta, p_origen, v_monto, v_aviso.fecha)
  returning id into v_pago;

  update transacciones_detectadas
  set estado = 'confirmado'
  where id = p_id
     or (id <> p_id and estado = 'pendiente' and origen = 'correo' and clase = 'pago_tarjeta'
         and monto = v_aviso.monto and pagado_en is not null and v_aviso.pagado_en is not null
         and abs(extract(epoch from pagado_en - v_aviso.pagado_en)) <= 600);

  return v_pago;
end;
$$;

revoke all on function public.confirmar_aviso_como_pago_tarjeta(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.confirmar_aviso_como_pago_tarjeta(uuid, uuid, uuid, numeric) to authenticated;

notify pgrst, 'reload schema';
