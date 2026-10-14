-- Paso 2: abono a deudas atómico y con movimiento de dinero.
--
-- Antes, `registrarAbonoDeuda` hacía leer-calcular-escribir desde el
-- cliente: dos abonos al mismo tiempo podían pisarse, el dinero no salía
-- de ninguna cuenta y `proximo_pago` nunca avanzaba. Ahora todo pasa en
-- una sola función de la base, dentro de una transacción y con las filas
-- bloqueadas (`for update`):
--   1) valida que la deuda (y la cuenta, si se indica) sean del usuario,
--   2) recorta el abono al saldo pendiente (no se cobra de más),
--   3) descuenta el monto de la cuenta de origen (ahorro/débito/efectivo),
--   4) si la deuda es un diferido en tarjeta, libera ese cupo,
--   5) deja constancia en `abonos_deuda` (historial inmutable),
--   6) baja el saldo y mueve `proximo_pago` un mes si se cubrió la cuota.
--
-- Parámetros tipados y SQL estático: sin superficie de inyección.

create table if not exists abonos_deuda (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deuda_id uuid not null references deudas(id) on delete cascade,
  cuenta_id uuid references cuentas(id) on delete set null,
  monto numeric(12, 2) not null check (monto > 0),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

alter table abonos_deuda enable row level security;

-- Solo lectura desde la app: se escribe únicamente vía registrar_abono_deuda.
drop policy if exists "abonos_deuda: select propio" on abonos_deuda;
create policy "abonos_deuda: select propio" on abonos_deuda
  for select to authenticated using (auth.uid() = usuario_id);

create index if not exists abonos_deuda_usuario_deuda_idx on abonos_deuda (usuario_id, deuda_id, fecha desc);

drop trigger if exists trg_00_validar_referencias on abonos_deuda;
create trigger trg_00_validar_referencias before insert or update on abonos_deuda
  for each row execute function validar_referencias_propias();

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
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El abono debe ser mayor que 0.' using errcode = '22023';
  end if;

  -- Bloquea la deuda: un segundo abono simultáneo espera a que este termine
  -- y ve el saldo ya actualizado.
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

  if p_cuenta_id is not null then
    select * into v_cuenta from cuentas
    where id = p_cuenta_id and usuario_id = v_usuario
    for update;
    if not found then
      raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
    end if;
    if v_cuenta.tipo = 'credito' then
      raise exception 'Un abono se paga desde una cuenta de ahorro, débito o efectivo, no desde una tarjeta de crédito.'
        using errcode = '22023';
    end if;
    update cuentas set disponible = disponible - v_monto where id = v_cuenta.id;
  end if;

  -- Pagar la cuota de un diferido libera ese cupo en la tarjeta (sin pasar del cupo total).
  if v_deuda.tipo = 'diferido' and v_deuda.cuenta_id is not null then
    update cuentas
    set disponible = case
      when cupo_total is not null then least(cupo_total, disponible + v_monto)
      else disponible + v_monto
    end
    where id = v_deuda.cuenta_id and usuario_id = v_usuario and tipo = 'credito';
  end if;

  insert into abonos_deuda (usuario_id, deuda_id, cuenta_id, monto, fecha)
  values (v_usuario, v_deuda.id, p_cuenta_id, v_monto, coalesce(p_fecha, current_date));

  update deudas
  set saldo_pendiente = saldo_pendiente - v_monto,
      proximo_pago = case
        when saldo_pendiente - v_monto <= 0 then null
        when proximo_pago is not null and cuota_mensual > 0 and v_monto >= cuota_mensual
          then (proximo_pago + interval '1 month')::date
        else proximo_pago
      end
  where id = v_deuda.id
  returning * into v_deuda;

  return v_deuda;
end;
$$;

-- Solo usuarios con sesión pueden llamarla (anon no).
revoke execute on function public.registrar_abono_deuda(uuid, numeric, uuid, date) from public, anon;
grant execute on function public.registrar_abono_deuda(uuid, numeric, uuid, date) to authenticated;

notify pgrst, 'reload schema';
