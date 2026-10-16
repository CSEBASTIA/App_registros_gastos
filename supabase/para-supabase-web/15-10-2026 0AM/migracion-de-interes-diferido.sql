-- =====================================================================
-- gastos-app — Migración de interés diferido
-- Para un proyecto que ya tiene la base anterior. Incluye 2 archivo(s):
--   - 20261015170000_diferidos_cupo_interes.sql
--   - 20261015180000_proteger_tasa_diferido.sql
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

-- >>> 20261015170000_diferidos_cupo_interes.sql
-- El gasto reserva el capital completo de la tarjeta. El interés se paga
-- con las cuotas y nunca libera cupo: solo el capital abonado lo hace.
alter table public.gastos add column if not exists tasa_interes numeric(5, 2);
alter table public.gastos add constraint gastos_tasa_interes_valida
  check (tasa_interes is null or tasa_interes between 0 and 999.99) not valid;
-- Se exige tarjeta al crear. Una eliminación posterior de la tarjeta debe
-- poder dejar cuenta_id en NULL por su FK ON DELETE SET NULL.
create or replace function public.validar_gasto_diferido()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.metodo_pago = 'diferido' then
    if new.cuenta_id is null then
      raise exception 'Elegí una tarjeta de crédito para el diferido.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.cuentas where id = new.cuenta_id and usuario_id = new.usuario_id and tipo = 'credito') then
      raise exception 'Un gasto diferido se carga a una tarjeta de crédito: el pago en cuotas se registra después como abono a la deuda.'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
alter table public.deudas add column if not exists interes_cuota_pendiente numeric(12, 2) not null default 0;
alter table public.deudas add column if not exists capital_cuota_pendiente numeric(12, 2) not null default 0;

-- Deudas anteriores sin tasa: conserva la siguiente cuota pendiente.
update public.deudas set capital_cuota_pendiente = least(cuota_mensual, saldo_pendiente)
where gasto_id is not null and capital_cuota_pendiente = 0 and saldo_pendiente > 0;

create or replace function public.validar_cupo_gasto()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_disponible numeric;
  v_incremento numeric;
begin
  if new.cuenta_id is null then return new; end if;
  select disponible into v_disponible from public.cuentas
  where id = new.cuenta_id and usuario_id = new.usuario_id and tipo = 'credito'
  for update;
  if not found then return new; end if;

  v_incremento := case
    when tg_op = 'UPDATE' and new.cuenta_id is not distinct from old.cuenta_id
      then new.monto - old.monto
    else new.monto
  end;
  if v_incremento > v_disponible then
    raise exception 'El gasto ($%) supera el cupo disponible de la tarjeta ($%).',
      to_char(v_incremento, 'FM9999999990.00'), to_char(v_disponible, 'FM9999999990.00')
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_03_validar_cupo_gasto on public.gastos;
create trigger trg_03_validar_cupo_gasto
  before insert or update of monto, cuenta_id on public.gastos
  for each row execute function public.validar_cupo_gasto();

create or replace function public.crear_deuda_de_gasto_diferido()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tasa numeric := coalesce(new.tasa_interes, 0) / 1200;
  v_cuota numeric(12, 2);
  v_interes numeric(12, 2);
begin
  if new.metodo_pago = 'diferido' and new.meses_diferido is not null and new.meses_diferido > 0 then
    v_cuota := case when v_tasa = 0 then
      ceil(new.monto * 100 / new.meses_diferido) / 100
    else
      ceil(new.monto * v_tasa / (1 - power(1 + v_tasa, -new.meses_diferido)) * 100) / 100
    end;
    v_interes := round(new.monto * v_tasa, 2);
    insert into public.deudas (
      usuario_id, nombre, tipo, monto_total, saldo_pendiente,
      cuota_mensual, tasa_interes, interes_cuota_pendiente,
      capital_cuota_pendiente, fecha_inicio, proximo_pago, cuenta_id, gasto_id
    ) values (
      new.usuario_id, new.descripcion, 'diferido', new.monto, new.monto,
      v_cuota, new.tasa_interes,
      v_interes, least(new.monto, greatest(0, v_cuota - v_interes)),
      new.fecha, new.fecha, new.cuenta_id, new.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.registrar_abono_deuda(
  p_deuda_id uuid, p_monto numeric, p_cuenta_id uuid default null, p_fecha date default null
) returns public.deudas language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_usuario uuid := auth.uid();
  v_deuda public.deudas;
  v_cuenta public.cuentas;
  v_monto numeric(12, 2);
  v_capital numeric(12, 2);
  v_interes numeric(12, 2);
  v_saldo numeric(12, 2);
  v_interes_restante numeric(12, 2);
  v_capital_cuota numeric(12, 2);
  v_base date;
  v_proximo date;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_monto is null or round(p_monto, 2) <= 0 then
    raise exception 'El abono debe ser de al menos $0,01.' using errcode = '22023';
  end if;
  select * into v_deuda from public.deudas
  where id = p_deuda_id and usuario_id = v_usuario for update;
  if not found then
    raise exception 'La deuda indicada no existe o no es tuya.' using errcode = '42501';
  end if;
  if v_deuda.saldo_pendiente <= 0 then
    raise exception 'Esta deuda ya está saldada.' using errcode = '22023';
  end if;
  if p_cuenta_id is not null then
    select * into v_cuenta from public.cuentas where id = p_cuenta_id and usuario_id = v_usuario;
    if not found then
      raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
    end if;
    if v_cuenta.tipo = 'credito' then
      raise exception 'Un abono se paga desde una cuenta de ahorro, débito o efectivo, no desde una tarjeta de crédito.' using errcode = '22023';
    end if;
  end if;

  v_monto := least(round(p_monto, 2), v_deuda.saldo_pendiente +
    case when v_deuda.gasto_id is not null then v_deuda.interes_cuota_pendiente else 0 end);
  v_interes := case when v_deuda.gasto_id is not null
    then least(v_monto, v_deuda.interes_cuota_pendiente) else 0 end;
  v_capital := v_monto - v_interes;
  v_saldo := v_deuda.saldo_pendiente - v_capital;
  v_interes_restante := v_deuda.interes_cuota_pendiente - v_interes;
  v_capital_cuota := greatest(0, v_deuda.capital_cuota_pendiente - v_capital);
  v_proximo := v_deuda.proximo_pago;

  -- La tarjeta se bloquea antes de la cuenta origen, como en pagos_tarjeta.
  if v_deuda.gasto_id is not null and v_deuda.cuenta_id is not null then
    update public.cuentas set disponible = disponible + v_capital
    where id = v_deuda.cuenta_id and usuario_id = v_usuario and tipo = 'credito';
  end if;
  if p_cuenta_id is not null then
    update public.cuentas set disponible = disponible - v_monto
    where id = p_cuenta_id and usuario_id = v_usuario;
  end if;
  insert into public.abonos_deuda (usuario_id, deuda_id, cuenta_id, monto, fecha)
  values (v_usuario, v_deuda.id, p_cuenta_id, v_monto, coalesce(p_fecha, current_date));

  if v_saldo <= 0 then
    v_proximo := null;
    v_interes_restante := 0;
    v_capital_cuota := 0;
  elsif v_deuda.gasto_id is not null then
    if v_interes_restante = 0 and v_capital_cuota = 0 then
      if v_proximo is not null then
        v_base := (date_trunc('month', v_proximo) + interval '1 month')::date;
        v_proximo := least(v_base + (extract(day from v_deuda.fecha_inicio)::int - 1),
          (v_base + interval '1 month' - interval '1 day')::date);
      end if;
      v_interes_restante := round(v_saldo * coalesce(v_deuda.tasa_interes, 0) / 1200, 2);
      v_capital_cuota := least(v_saldo, greatest(0, v_deuda.cuota_mensual - v_interes_restante));
    end if;
  elsif v_proximo is not null and v_deuda.cuota_mensual > 0 and v_monto >= v_deuda.cuota_mensual then
    v_proximo := (v_proximo + interval '1 month')::date;
  end if;

  update public.deudas set saldo_pendiente = v_saldo, proximo_pago = v_proximo,
    interes_cuota_pendiente = v_interes_restante, capital_cuota_pendiente = v_capital_cuota
  where id = v_deuda.id returning * into v_deuda;
  return v_deuda;
end;
$$;

revoke execute on function public.registrar_abono_deuda(uuid, numeric, uuid, date) from public, anon;
grant execute on function public.registrar_abono_deuda(uuid, numeric, uuid, date) to authenticated;
notify pgrst, 'reload schema';


-- >>> 20261015180000_proteger_tasa_diferido.sql
-- La tasa de un gasto diferido debe coincidir con la de la deuda que creó.
create or replace function public.proteger_tasa_diferido()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.metodo_pago = 'diferido' and new.tasa_interes is distinct from old.tasa_interes then
    raise exception 'La tasa de un diferido registrado no se puede cambiar: elimínalo y regístralo de nuevo.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_04_proteger_tasa_diferido on public.gastos;
create trigger trg_04_proteger_tasa_diferido before update of tasa_interes on public.gastos
  for each row execute function public.proteger_tasa_diferido();


-- >>> Registro de migraciones
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261015170000', 'diferidos_cupo_interes'),
  ('20261015180000', 'proteger_tasa_diferido')
on conflict (version) do nothing;

commit;

select case when exists (select 1 from supabase_migrations.schema_migrations where version = '20261015180000') then 'sí' else 'no' end as aplicada;
