-- Integridad de saldos (hallazgos de la revisión de bugs del 14-oct).
--
-- 1) SALDO A FAVOR. Hasta ahora el disponible de una tarjeta nunca podía
--    superar su cupo: cada vez que una operación lo habría superado, el
--    excedente se recortaba y ese dinero desaparecía. Pasaba al pagar más de
--    lo usado, al borrar o editar un gasto ya pagado y al liberar cupo con
--    abonos. Ahora el disponible puede quedar por encima del cupo: es saldo a
--    favor, como en un banco real. La interfaz debe mostrarlo así cuando
--    `disponible > cupo_total`.
-- 2) Editar un gasto sin cambiar monto ni cuenta ya no toca los saldos; si
--    cambia el monto en la misma cuenta, se aplica solo la diferencia.
-- 3) Un diferido solo puede cargarse a una tarjeta de crédito (o sin cuenta)
--    y siempre con su plazo. Antes, uno cargado a una cuenta de ahorro se
--    cobraba dos veces: al comprar y al pagar cada cuota.
-- 4) El historial de abonos no se pierde: no se puede borrar una deuda con
--    abonos (ni el diferido que la generó), y la deuda automática de un
--    diferido solo se quita borrando su gasto.
-- 5) Un aviso del correo ya confirmado o descartado no vuelve a "pendiente"
--    (confirmarlo otra vez duplicaba el gasto).
-- 6) Al borrar una categoría propia con movimientos, estos pasan a "Otros"
--    con el nombre anterior como detalle (antes el borrado fallaba).
-- 7) Cuotas de diferido redondeadas hacia arriba (sin centavo colgando) y
--    fecha de pago anclada al día de la compra (ya no se corre a fin de mes).
-- 8) Un abono con más de 2 decimales se redondea antes de validarse.
-- 9) Pagos y abonos bloquean las cuentas en el mismo orden (tarjeta y luego
--    origen) para evitar un bloqueo mutuo entre operaciones simultáneas.
--
-- SQL estático, search_path fijo en todas las funciones.

-- 1 y 2) Triggers de saldo sin recorte al cupo -------------------------

create or replace function public.revertir_gasto_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cuenta_id is not null then
    update cuentas set disponible = disponible + old.monto
    where id = old.cuenta_id and usuario_id = old.usuario_id;
  end if;
  return old;
end;
$$;

create or replace function public.ajustar_gasto_actualizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- El trigger corre aunque los valores no cambien (la web reenvía monto y
  -- cuenta al editar la descripción): en ese caso no hay nada que ajustar.
  if new.monto = old.monto and new.cuenta_id is not distinct from old.cuenta_id then
    return new;
  end if;

  if new.cuenta_id is not distinct from old.cuenta_id then
    -- Misma cuenta: solo la diferencia.
    if new.cuenta_id is not null then
      update cuentas set disponible = disponible - (new.monto - old.monto)
      where id = new.cuenta_id and usuario_id = new.usuario_id;
    end if;
    return new;
  end if;

  -- Cambió de cuenta: se devuelve a la vieja y se cobra en la nueva.
  if old.cuenta_id is not null then
    update cuentas set disponible = disponible + old.monto
    where id = old.cuenta_id and usuario_id = old.usuario_id;
  end if;
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible - new.monto
    where id = new.cuenta_id and usuario_id = new.usuario_id;
  end if;
  return new;
end;
$$;

create or replace function public.aplicar_pago_tarjeta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Pagar de más deja saldo a favor en la tarjeta: el dinero no se pierde.
  update cuentas set disponible = disponible + new.monto
  where id = new.cuenta_id and usuario_id = new.usuario_id;

  if new.cuenta_origen_id is not null then
    update cuentas set disponible = disponible - new.monto
    where id = new.cuenta_origen_id and usuario_id = new.usuario_id;
  end if;

  return new;
end;
$$;

-- 3) Diferidos: plazo obligatorio y solo en tarjeta de crédito ---------

alter table gastos drop constraint if exists gastos_diferido_con_plazo;
alter table gastos add constraint gastos_diferido_con_plazo
  check (metodo_pago is distinct from 'diferido' or meses_diferido is not null) not valid;

create or replace function public.validar_gasto_diferido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.metodo_pago = 'diferido' and new.cuenta_id is not null
     and not exists (select 1 from cuentas where id = new.cuenta_id and tipo = 'credito') then
    raise exception 'Un gasto diferido se carga a una tarjeta de crédito: el pago en cuotas se registra después como abono a la deuda.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_02_validar_gasto_diferido on gastos;
create trigger trg_02_validar_gasto_diferido
  before insert on gastos
  for each row execute function validar_gasto_diferido();

-- 7) Cuota del diferido redondeada hacia arriba -------------------------

create or replace function public.crear_deuda_de_gasto_diferido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.metodo_pago = 'diferido' and new.meses_diferido is not null and new.meses_diferido > 0 then
    insert into deudas (
      usuario_id, nombre, tipo, monto_total, saldo_pendiente,
      cuota_mensual, fecha_inicio, proximo_pago, cuenta_id, gasto_id
    )
    values (
      new.usuario_id,
      new.descripcion,
      'diferido',
      new.monto,
      new.monto,
      -- Hacia arriba: 100 / 3 = 33.34, así la última cuota (recortada al
      -- saldo) cierra la deuda sin dejar un centavo pendiente.
      ceil(new.monto * 100 / new.meses_diferido) / 100,
      new.fecha,
      (new.fecha::date + interval '1 month')::date,
      new.cuenta_id,
      new.id
    );
  end if;
  return new;
end;
$$;

-- 4) Historial de abonos protegido --------------------------------------

-- NO ACTION (no RESTRICT): se comprueba al final de la sentencia, así borrar
-- la cuenta de un usuario (que arrastra deudas y abonos a la vez) sigue
-- funcionando.
alter table abonos_deuda drop constraint if exists abonos_deuda_deuda_id_fkey;
alter table abonos_deuda
  add constraint abonos_deuda_deuda_id_fkey
  foreign key (deuda_id) references deudas(id);

create or replace function public.proteger_borrado_deuda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Se está borrando la cuenta del usuario completa: dejar pasar.
  if not exists (select 1 from auth.users where id = old.usuario_id) then
    return old;
  end if;
  -- Borrado directo de la deuda automática (su gasto sigue existiendo).
  if old.gasto_id is not null and exists (select 1 from gastos where id = old.gasto_id) then
    raise exception 'Esta deuda viene de un gasto diferido: para quitarla, elimina ese gasto.'
      using errcode = '22023';
  end if;
  if exists (select 1 from abonos_deuda where deuda_id = old.id) then
    raise exception 'Esta deuda ya tiene abonos registrados: no se puede borrar, para conservar el historial de pagos.'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_proteger_borrado_deuda on deudas;
create trigger trg_proteger_borrado_deuda
  before delete on deudas
  for each row execute function proteger_borrado_deuda();

-- 5) Avisos del correo: lo resuelto no vuelve atrás --------------------

create or replace function public.proteger_estado_aviso()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.estado <> 'pendiente' and new.estado is distinct from old.estado then
    raise exception 'Este aviso ya fue %: no se puede cambiar.', old.estado using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_estado_aviso on transacciones_detectadas;
create trigger trg_proteger_estado_aviso
  before update on transacciones_detectadas
  for each row execute function proteger_estado_aviso();

-- 6) Borrar una categoría con movimientos los pasa a "Otros" ------------

create or replace function public.reasignar_movimientos_de_categoria()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_otros uuid;
begin
  select id into v_otros from categorias
  where usuario_id is null and tipo = old.tipo and nombre = 'Otros'
  limit 1;

  update gastos
  set categoria_id = v_otros,
      categoria_detalle = coalesce(categoria_detalle, left(old.nombre, 80))
  where categoria_id = old.id;

  update ingresos
  set categoria_id = v_otros,
      categoria_detalle = coalesce(categoria_detalle, left(old.nombre, 80))
  where categoria_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_reasignar_movimientos_de_categoria on categorias;
create trigger trg_reasignar_movimientos_de_categoria
  before delete on categorias
  for each row execute function reasignar_movimientos_de_categoria();

-- 7, 8 y 9) Abono: redondeo antes de validar, fecha anclada, orden de bloqueo

create or replace function public.registrar_abono_deuda(
  p_deuda_id uuid,
  p_monto numeric,
  p_cuenta_id uuid default null,
  p_fecha date default null
)
returns deudas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_deuda deudas;
  v_cuenta cuentas;
  v_monto numeric(12, 2);
  v_base date;
  v_proximo date;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_monto is null or round(p_monto, 2) <= 0 then
    raise exception 'El abono debe ser de al menos $0,01.' using errcode = '22023';
  end if;

  select * into v_deuda from deudas
  where id = p_deuda_id and usuario_id = v_usuario
  for update;
  if not found then
    raise exception 'La deuda indicada no existe o no es tuya.' using errcode = '42501';
  end if;
  if v_deuda.saldo_pendiente <= 0 then
    raise exception 'Esta deuda ya está saldada.' using errcode = '22023';
  end if;

  v_monto := least(round(p_monto, 2), v_deuda.saldo_pendiente);

  -- Validar la cuenta de origen antes de mover nada (sin bloquearla todavía).
  if p_cuenta_id is not null then
    select * into v_cuenta from cuentas where id = p_cuenta_id and usuario_id = v_usuario;
    if not found then
      raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
    end if;
    if v_cuenta.tipo = 'credito' then
      raise exception 'Un abono se paga desde una cuenta de ahorro, débito o efectivo, no desde una tarjeta de crédito.'
        using errcode = '22023';
    end if;
  end if;

  -- Mismo orden que aplicar_pago_tarjeta: primero la tarjeta, luego el origen.
  -- Pagar la cuota de un diferido libera ese cupo (sin recorte: saldo a favor).
  -- Sin cuenta de origen, el pago se hizo con dinero no registrado en la app.
  if v_deuda.tipo = 'diferido' and v_deuda.cuenta_id is not null then
    update cuentas set disponible = disponible + v_monto
    where id = v_deuda.cuenta_id and usuario_id = v_usuario and tipo = 'credito';
  end if;

  if p_cuenta_id is not null then
    update cuentas set disponible = disponible - v_monto where id = p_cuenta_id and usuario_id = v_usuario;
  end if;

  insert into abonos_deuda (usuario_id, deuda_id, cuenta_id, monto, fecha)
  values (v_usuario, v_deuda.id, p_cuenta_id, v_monto, coalesce(p_fecha, current_date));

  -- Próximo pago: en los diferidos, anclado al día de la compra (31-ene →
  -- 28-feb → 31-mar), sin correrse a fin de mes; en las demás, +1 mes.
  v_proximo := v_deuda.proximo_pago;
  if v_deuda.proximo_pago is not null and v_deuda.cuota_mensual > 0 and v_monto >= v_deuda.cuota_mensual then
    if v_deuda.gasto_id is not null then
      v_base := (date_trunc('month', v_deuda.proximo_pago) + interval '1 month')::date;
      v_proximo := least(
        v_base + (extract(day from v_deuda.fecha_inicio)::int - 1),
        (v_base + interval '1 month' - interval '1 day')::date
      );
    else
      v_proximo := (v_deuda.proximo_pago + interval '1 month')::date;
    end if;
  end if;

  update deudas
  set saldo_pendiente = saldo_pendiente - v_monto,
      proximo_pago = case when saldo_pendiente - v_monto <= 0 then null else v_proximo end
  where id = v_deuda.id
  returning * into v_deuda;

  return v_deuda;
end;
$$;

revoke execute on function public.registrar_abono_deuda(uuid, numeric, uuid, date) from public, anon;
grant execute on function public.registrar_abono_deuda(uuid, numeric, uuid, date) to authenticated;

notify pgrst, 'reload schema';
