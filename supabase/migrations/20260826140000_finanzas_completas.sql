-- Extiende el esquema de "gastos simples" a finanzas personales completas:
-- cuentas/tarjetas con cupo, ingresos, pagos de tarjeta, deudas/préstamos
-- y recordatorios. El cupo de una cuenta ("disponible") se mantiene
-- consistente vía triggers (no en el cliente), porque tanto desktop como
-- mobile comparten `packages/core` y pegan directo a Supabase.

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists cuentas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('debito', 'credito', 'efectivo', 'ahorro')),
  banco text not null default 'otro'
    check (banco in ('banco_guayaquil', 'pichincha', 'produbanco', 'otro')),
  marca text
    check (marca is null or marca in ('amex', 'visa', 'mastercard', 'diners', 'otro')),
  cupo_total numeric(12, 2) check (cupo_total is null or cupo_total >= 0),
  disponible numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table gastos
  add column if not exists cuenta_id uuid references cuentas(id);

create table if not exists ingresos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  monto numeric(12, 2) not null check (monto > 0),
  descripcion text not null,
  cuenta_id uuid references cuentas(id),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists pagos_tarjeta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cuenta_id uuid not null references cuentas(id),
  monto numeric(12, 2) not null check (monto > 0),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists deudas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('prestamo', 'tarjeta', 'otro')),
  monto_total numeric(12, 2) not null check (monto_total > 0),
  saldo_pendiente numeric(12, 2) not null check (saldo_pendiente >= 0),
  cuota_mensual numeric(12, 2) not null check (cuota_mensual >= 0),
  tasa_interes numeric(5, 2),
  fecha_inicio date not null default current_date,
  proximo_pago date,
  cuenta_id uuid references cuentas(id),
  created_at timestamptz not null default now()
);

create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null,
  tipo text not null check (tipo in ('pago', 'prestamo', 'tarjeta', 'otro')),
  monto numeric(12, 2),
  fecha date not null,
  recurrente boolean not null default false,
  frecuencia text check (frecuencia is null or frecuencia in ('semanal', 'mensual', 'anual')),
  completado boolean not null default false,
  deuda_id uuid references deudas(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Triggers: el "disponible" de una cuenta se ajusta solo.
-- ---------------------------------------------------------------------

create or replace function aplicar_gasto_a_cuenta()
returns trigger as $$
begin
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible - new.monto where id = new.cuenta_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function revertir_gasto_de_cuenta()
returns trigger as $$
begin
  if old.cuenta_id is not null then
    update cuentas
    set disponible = case
      when cupo_total is not null then least(cupo_total, disponible + old.monto)
      else disponible + old.monto
    end
    where id = old.cuenta_id;
  end if;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_aplicar_gasto_a_cuenta on gastos;
create trigger trg_aplicar_gasto_a_cuenta
  after insert on gastos
  for each row execute function aplicar_gasto_a_cuenta();

drop trigger if exists trg_revertir_gasto_de_cuenta on gastos;
create trigger trg_revertir_gasto_de_cuenta
  after delete on gastos
  for each row execute function revertir_gasto_de_cuenta();

create or replace function aplicar_ingreso_a_cuenta()
returns trigger as $$
begin
  if new.cuenta_id is not null then
    update cuentas
    set disponible = disponible + new.monto
    where id = new.cuenta_id and tipo <> 'credito';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function revertir_ingreso_de_cuenta()
returns trigger as $$
begin
  if old.cuenta_id is not null then
    update cuentas
    set disponible = disponible - old.monto
    where id = old.cuenta_id and tipo <> 'credito';
  end if;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_aplicar_ingreso_a_cuenta on ingresos;
create trigger trg_aplicar_ingreso_a_cuenta
  after insert on ingresos
  for each row execute function aplicar_ingreso_a_cuenta();

drop trigger if exists trg_revertir_ingreso_de_cuenta on ingresos;
create trigger trg_revertir_ingreso_de_cuenta
  after delete on ingresos
  for each row execute function revertir_ingreso_de_cuenta();

-- Un pago de tarjeta sube el disponible, sin pasarse del cupo total.
create or replace function aplicar_pago_tarjeta()
returns trigger as $$
begin
  update cuentas
  set disponible = case
    when cupo_total is not null then least(cupo_total, disponible + new.monto)
    else disponible + new.monto
  end
  where id = new.cuenta_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_aplicar_pago_tarjeta on pagos_tarjeta;
create trigger trg_aplicar_pago_tarjeta
  after insert on pagos_tarjeta
  for each row execute function aplicar_pago_tarjeta();

-- ---------------------------------------------------------------------
-- RLS: mismo criterio que gastos/presupuestos — cada usuario ve y
-- modifica únicamente lo suyo.
-- ---------------------------------------------------------------------

alter table cuentas enable row level security;
alter table ingresos enable row level security;
alter table pagos_tarjeta enable row level security;
alter table deudas enable row level security;
alter table recordatorios enable row level security;

create policy "cuentas: select propio" on cuentas for select to authenticated using (auth.uid() = usuario_id);
create policy "cuentas: insert propio" on cuentas for insert to authenticated with check (auth.uid() = usuario_id);
create policy "cuentas: update propio" on cuentas for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "cuentas: delete propio" on cuentas for delete to authenticated using (auth.uid() = usuario_id);

create policy "ingresos: select propio" on ingresos for select to authenticated using (auth.uid() = usuario_id);
create policy "ingresos: insert propio" on ingresos for insert to authenticated with check (auth.uid() = usuario_id);
create policy "ingresos: update propio" on ingresos for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "ingresos: delete propio" on ingresos for delete to authenticated using (auth.uid() = usuario_id);

create policy "pagos_tarjeta: select propio" on pagos_tarjeta for select to authenticated using (auth.uid() = usuario_id);
create policy "pagos_tarjeta: insert propio" on pagos_tarjeta for insert to authenticated with check (auth.uid() = usuario_id);
create policy "pagos_tarjeta: delete propio" on pagos_tarjeta for delete to authenticated using (auth.uid() = usuario_id);

create policy "deudas: select propio" on deudas for select to authenticated using (auth.uid() = usuario_id);
create policy "deudas: insert propio" on deudas for insert to authenticated with check (auth.uid() = usuario_id);
create policy "deudas: update propio" on deudas for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "deudas: delete propio" on deudas for delete to authenticated using (auth.uid() = usuario_id);

create policy "recordatorios: select propio" on recordatorios for select to authenticated using (auth.uid() = usuario_id);
create policy "recordatorios: insert propio" on recordatorios for insert to authenticated with check (auth.uid() = usuario_id);
create policy "recordatorios: update propio" on recordatorios for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "recordatorios: delete propio" on recordatorios for delete to authenticated using (auth.uid() = usuario_id);
