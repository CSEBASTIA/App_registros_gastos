-- =====================================================================
-- gastos-app — BASE DE DATOS COMPLETA
-- Generado por supabase/generar-base-completa.sh el 2026-10-16 con las
-- 30 migraciones de supabase/migrations + seed.sql. No editar a mano.
--
-- Cómo usarlo en Supabase (web):
--   1. Proyecto nuevo → SQL Editor → New query.
--   2. Pegar TODO este archivo y pulsar Run.
--   3. Debe terminar mostrando "migraciones_registradas = 30".
--
-- Es para un proyecto VACÍO. Corre en una sola transacción: si algo falla
-- (por ejemplo, si la base ya existía), se detiene sin cambiar nada.
-- Al final marca las migraciones como aplicadas, para que
-- `supabase db push` no las repita.
-- No contiene datos de ninguna persona: solo estructura, reglas, seguridad
-- (RLS) y las categorías globales.
-- =====================================================================

begin;

-- >>> 20260826120000_gastos.sql
create extension if not exists "pgcrypto";

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  color text not null default '#999999'
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  monto numeric(12, 2) not null check (monto > 0),
  descripcion text not null,
  categoria_id uuid references categorias(id),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id),
  monto_limite numeric(12, 2) not null,
  mes text not null
);

alter table categorias enable row level security;
alter table gastos enable row level security;
alter table presupuestos enable row level security;


-- >>> 20260826130000_rls_policies.sql
-- La migración anterior activó RLS en las 3 tablas pero no creó policies,
-- lo que en la práctica bloqueaba todo select/insert/delete desde el
-- cliente (anon/authenticated). Esta migración:
--   1) agrega el dueño de cada gasto/presupuesto (usuario_id), para
--      poder aislar los datos por usuario autenticado.
--   2) crea las policies necesarias para que la app funcione.

alter table gastos
  add column if not exists usuario_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

alter table presupuestos
  add column if not exists usuario_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

-- Categorías: catálogo compartido, de solo lectura para la app.
-- Se administra desde el backend (service_role / seed), por eso no
-- tiene policies de insert/update/delete.
create policy "categorias: lectura para autenticados"
  on categorias for select
  to authenticated
  using (true);

-- Gastos: cada usuario ve y modifica únicamente los suyos.
create policy "gastos: select propio"
  on gastos for select
  to authenticated
  using (auth.uid() = usuario_id);

create policy "gastos: insert propio"
  on gastos for insert
  to authenticated
  with check (auth.uid() = usuario_id);

create policy "gastos: update propio"
  on gastos for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "gastos: delete propio"
  on gastos for delete
  to authenticated
  using (auth.uid() = usuario_id);

-- Presupuestos: mismo criterio que gastos.
create policy "presupuestos: select propio"
  on presupuestos for select
  to authenticated
  using (auth.uid() = usuario_id);

create policy "presupuestos: insert propio"
  on presupuestos for insert
  to authenticated
  with check (auth.uid() = usuario_id);

create policy "presupuestos: update propio"
  on presupuestos for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "presupuestos: delete propio"
  on presupuestos for delete
  to authenticated
  using (auth.uid() = usuario_id);


-- >>> 20260826140000_finanzas_completas.sql
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


-- >>> 20260830120000_estilo_tarjeta.sql
-- Agrega el "estilo" de tarjeta: el id del producto específico dentro del
-- catálogo de diseños (ej. "visa-oro-lifemiles", "amex-platinum-metal"),
-- que la UI de desktop usa para mostrar la imagen real de la tarjeta.
-- `banco`/`marca` siguen existiendo para el degradado de respaldo cuando
-- no hay estilo (débito/ahorro/efectivo, o un producto fuera de catálogo).

alter table cuentas add column if not exists estilo text;


-- >>> 20260830130000_eliminar_cuenta_con_movimientos.sql
-- Hasta ahora, `cuenta_id` en gastos/ingresos/pagos_tarjeta/deudas apuntaba
-- a cuentas(id) sin política de borrado (equivale a ON DELETE NO ACTION):
-- si una tarjeta tenía aunque sea un gasto o un pago registrado, eliminarla
-- fallaba con una violación de foreign key. Acá se redefinen esas
-- relaciones para que borrar una cuenta sí funcione:
--   - gastos/ingresos/deudas.cuenta_id -> SET NULL (el movimiento queda,
--     solo pierde el vínculo con la cuenta borrada).
--   - pagos_tarjeta.cuenta_id -> CASCADE (un pago de tarjeta no tiene
--     sentido sin la cuenta a la que se le pagó, y esa columna es NOT NULL).

alter table gastos drop constraint if exists gastos_cuenta_id_fkey;
alter table gastos
  add constraint gastos_cuenta_id_fkey
  foreign key (cuenta_id) references cuentas(id) on delete set null;

alter table ingresos drop constraint if exists ingresos_cuenta_id_fkey;
alter table ingresos
  add constraint ingresos_cuenta_id_fkey
  foreign key (cuenta_id) references cuentas(id) on delete set null;

alter table deudas drop constraint if exists deudas_cuenta_id_fkey;
alter table deudas
  add constraint deudas_cuenta_id_fkey
  foreign key (cuenta_id) references cuentas(id) on delete set null;

alter table pagos_tarjeta drop constraint if exists pagos_tarjeta_cuenta_id_fkey;
alter table pagos_tarjeta
  add constraint pagos_tarjeta_cuenta_id_fkey
  foreign key (cuenta_id) references cuentas(id) on delete cascade;


-- >>> 20260830140000_categorias_crud.sql
-- Categorías pasa de "catálogo compartido de solo lectura" a poder
-- administrarse por el usuario (CRUD completo):
--   - `tipo`: separa categorías de gasto vs. de ingreso, para no
--     mezclarlas en los selectores de cada formulario.
--   - `usuario_id` (nullable): NULL = categoría global/compartida (las 4
--     que ya existían siguen así, visibles para todos); con dueño = la
--     creó ese usuario, y solo él la ve/edita/borra.
--   - políticas de insert/update/delete, que hoy no existían (por eso el
--     CRUD estaba bloqueado a nivel de base de datos).
--
-- También se agrega el soporte para "Otros + detalle": una categoría
-- "Otros" (una por tipo) y una columna `categoria_detalle` en gastos e
-- ingresos para guardar el texto libre que el usuario escribe al elegirla.
-- Ingresos además gana `categoria_id` (hoy no tenía ninguna).

alter table categorias add column if not exists tipo text not null default 'gasto' check (tipo in ('gasto', 'ingreso'));
alter table categorias add column if not exists usuario_id uuid references auth.users(id) on delete cascade;

alter table gastos add column if not exists categoria_detalle text;
alter table ingresos add column if not exists categoria_id uuid references categorias(id);
alter table ingresos add column if not exists categoria_detalle text;

-- Semilla: "Otros" por tipo (si no existe ya) + un par de categorías de
-- ingreso básicas, para que el selector de Ingresos no arranque vacío.
insert into categorias (nombre, color, tipo)
select 'Otros', '#6b7280', 'gasto'
where not exists (select 1 from categorias where nombre = 'Otros' and tipo = 'gasto');

insert into categorias (nombre, color, tipo)
select v.nombre, v.color, 'ingreso'
from (values
  ('Sueldo', '#16a34a'),
  ('Freelance', '#0891b2'),
  ('Regalo', '#db2777'),
  ('Otros', '#6b7280')
) as v(nombre, color)
where not exists (select 1 from categorias c where c.nombre = v.nombre and c.tipo = 'ingreso');

-- Reemplaza la policy de solo-lectura por una que también deja ver las
-- categorías propias (además de las globales).
drop policy if exists "categorias: lectura para autenticados" on categorias;

create policy "categorias: select propias o globales"
  on categorias for select
  to authenticated
  using (usuario_id is null or usuario_id = auth.uid());

create policy "categorias: insert propia"
  on categorias for insert
  to authenticated
  with check (usuario_id = auth.uid());

create policy "categorias: update propia"
  on categorias for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "categorias: delete propia"
  on categorias for delete
  to authenticated
  using (usuario_id = auth.uid());


-- >>> 20260830150000_gastos_factura_metodo_pago.sql
-- Gastos gana "método de pago" y factura adjunta (PDF o imagen, en
-- Supabase Storage). Se guarda solo la RUTA dentro del bucket
-- (`factura_path`), no una URL pública — el bucket es privado y la app
-- pide una signed URL al momento de abrir/descargar el archivo.

alter table gastos add column if not exists metodo_pago text
  check (metodo_pago is null or metodo_pago in ('efectivo', 'debito', 'credito', 'transferencia', 'otro'));
alter table gastos add column if not exists factura_path text;

-- Los triggers de finanzas_completas solo ajustan `cuentas.disponible` en
-- INSERT/DELETE de gastos. Ahora que un gasto se puede editar (monto o
-- cuenta), hace falta el mismo ajuste en UPDATE: revierte el efecto del
-- monto/cuenta viejos y aplica el nuevo, para que el cupo no quede
-- desincronizado al corregir un gasto.
create or replace function ajustar_gasto_actualizado()
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
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible - new.monto where id = new.cuenta_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ajustar_gasto_actualizado on gastos;
create trigger trg_ajustar_gasto_actualizado
  after update of monto, cuenta_id on gastos
  for each row execute function ajustar_gasto_actualizado();

-- Bucket privado para facturas. Cada archivo vive en
-- "<usuario_id>/<archivo>" dentro del bucket, y las policies de abajo
-- usan ese primer segmento de la ruta para que cada quien solo pueda
-- subir/ver/borrar lo suyo.
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

drop policy if exists "facturas: select propio" on storage.objects;
create policy "facturas: select propio"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "facturas: insert propio" on storage.objects;
create policy "facturas: insert propio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "facturas: delete propio" on storage.objects;
create policy "facturas: delete propio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);


-- >>> 20260831120000_banco_diners_club.sql
-- Diners Club Ecuador es un emisor de tarjetas aparte (no un producto de
-- Banco Guayaquil), así que se agrega como valor propio de `banco` en
-- cuentas, para poder tener su catálogo de diseños de tarjeta igual que
-- Banco Guayaquil.

alter table cuentas drop constraint if exists cuentas_banco_check;
alter table cuentas
  add constraint cuentas_banco_check
  check (banco in ('banco_guayaquil', 'pichincha', 'produbanco', 'diners_club', 'otro'));


-- >>> 20260831130000_gasto_diferido.sql
-- Método de pago "diferido": un gasto grande a plazos (tarjeta a meses,
-- crédito tipo Artefacta, etc.). Al registrarlo con `meses_diferido`, se
-- crea automáticamente la deuda asociada — vía trigger, no en el cliente,
-- para que valga igual desde desktop y mobile (mismo criterio que el
-- ajuste de `cuentas.disponible`).

alter table gastos add column if not exists meses_diferido integer check (meses_diferido is null or meses_diferido > 0);

-- Referencia de vuelta: de qué gasto salió la deuda (si fue automática).
-- Si se borra el gasto original, la deuda derivada se borra con él.
alter table deudas add column if not exists gasto_id uuid references gastos(id) on delete cascade;

create or replace function crear_deuda_de_gasto_diferido()
returns trigger as $$
begin
  if new.metodo_pago = 'diferido' and new.meses_diferido is not null and new.meses_diferido > 0 then
    insert into deudas (
      usuario_id, nombre, tipo, monto_total, saldo_pendiente,
      cuota_mensual, fecha_inicio, proximo_pago, cuenta_id, gasto_id
    )
    values (
      new.usuario_id,
      new.descripcion,
      'prestamo',
      new.monto,
      new.monto,
      round(new.monto / new.meses_diferido, 2),
      new.fecha,
      (new.fecha::date + interval '1 month')::date,
      new.cuenta_id,
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_crear_deuda_de_gasto_diferido on gastos;
create trigger trg_crear_deuda_de_gasto_diferido
  after insert on gastos
  for each row execute function crear_deuda_de_gasto_diferido();


-- >>> 20260831140000_fix_metodo_pago_diferido.sql
-- Bug: la migración que agregó "diferido" como método de pago (gasto
-- diferido) nunca actualizó el check constraint de `gastos.metodo_pago`,
-- que seguía sin incluir ese valor — todo gasto diferido fallaba al
-- guardarse. Detectado probando la app con datos reales.

alter table gastos drop constraint if exists gastos_metodo_pago_check;
alter table gastos
  add constraint gastos_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('efectivo', 'debito', 'credito', 'transferencia', 'diferido', 'otro'));


-- >>> 20260831150000_pago_tarjeta_origen_y_tipo_diferido.sql
-- Dos ajustes pedidos tras probar la app con datos reales:
--
-- 1) Pagar una tarjeta no movía plata de ningún lado: solo subía el cupo
--    disponible de la tarjeta, como si el dinero saliera de la nada. Ahora
--    `pagos_tarjeta` puede llevar una cuenta de origen (ahorro/débito) y el
--    trigger también le descuenta el monto a esa cuenta.
--
-- 2) Las deudas generadas automáticamente desde un gasto diferido quedaban
--    con tipo = 'prestamo', igual que un préstamo manual, sin forma de
--    distinguirlas en la columna "Tipo" de la vista Deudas. Se agrega el
--    tipo 'diferido' y se migran las filas ya generadas por diferido.

alter table pagos_tarjeta add column if not exists cuenta_origen_id uuid references cuentas(id);

create or replace function aplicar_pago_tarjeta()
returns trigger as $$
begin
  update cuentas
  set disponible = case
    when cupo_total is not null then least(cupo_total, disponible + new.monto)
    else disponible + new.monto
  end
  where id = new.cuenta_id;

  if new.cuenta_origen_id is not null then
    update cuentas
    set disponible = disponible - new.monto
    where id = new.cuenta_origen_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

alter table deudas drop constraint if exists deudas_tipo_check;
alter table deudas
  add constraint deudas_tipo_check
  check (tipo in ('prestamo', 'tarjeta', 'otro', 'diferido'));

update deudas set tipo = 'diferido' where gasto_id is not null and tipo = 'prestamo';

create or replace function crear_deuda_de_gasto_diferido()
returns trigger as $$
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
      round(new.monto / new.meses_diferido, 2),
      new.fecha,
      (new.fecha::date + interval '1 month')::date,
      new.cuenta_id,
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;


-- >>> 20260901120000_correo_transacciones_detectadas.sql
-- Detección automática de gastos/ingresos desde el correo (mobile): un
-- lector de avisos bancarios en Outlook deja lo que encuentra acá, en una
-- cola de revisión — nada se guarda como gasto/ingreso real hasta que el
-- usuario lo confirma desde la app (que en ese momento llama a los mismos
-- crearGasto/crearIngreso de siempre; no hace falta ningún trigger nuevo).

alter table cuentas add column if not exists identificador text;

create table if not exists transacciones_detectadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- id del mensaje en el proveedor de correo: evita procesar el mismo aviso dos veces.
  mensaje_id text not null,
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  monto numeric(12, 2) not null check (monto > 0),
  descripcion text not null,
  -- null = no se pudo identificar el banco del remitente.
  banco text,
  -- null = no se pudo desambiguar la cuenta (ej. dos cuentas del mismo banco); el usuario la elige al revisar.
  cuenta_id uuid references cuentas(id) on delete set null,
  categoria_id uuid references categorias(id) on delete set null,
  fecha date not null,
  correo_asunto text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'descartado')),
  created_at timestamptz not null default now(),
  unique (usuario_id, mensaje_id)
);

alter table transacciones_detectadas enable row level security;

create policy "transacciones_detectadas: select propio" on transacciones_detectadas
  for select to authenticated using (auth.uid() = usuario_id);
create policy "transacciones_detectadas: insert propio" on transacciones_detectadas
  for insert to authenticated with check (auth.uid() = usuario_id);
create policy "transacciones_detectadas: update propio" on transacciones_detectadas
  for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "transacciones_detectadas: delete propio" on transacciones_detectadas
  for delete to authenticated using (auth.uid() = usuario_id);


-- >>> 20261013120000_seguridad_y_presupuestos.sql
-- Paso 1 (presupuestos inteligentes) + endurecimiento de seguridad.
--
-- 1) Referencias propias: RLS solo mira la fila que se inserta, no las
--    filas a las que apunta. Un usuario podía crear un gasto con el
--    `cuenta_id` de OTRO usuario (la foreign key no pasa por RLS) y los
--    triggers `security definer` le descontaban el saldo a esa cuenta
--    ajena. Un trigger BEFORE ahora rechaza cualquier referencia (cuenta,
--    categoría, deuda, gasto) que no sea del mismo usuario.
-- 2) Los triggers de saldo además filtran por `usuario_id` (defensa en
--    profundidad) y todas las funciones `security definer` fijan
--    `search_path` para que nadie pueda secuestrarlas con objetos propios.
-- 3) Límites de longitud y formato en los textos (los mismos de
--    `packages/core/src/schemas/limites.ts`). Van NOT VALID: se exigen en
--    filas nuevas o editadas sin revalidar los datos que ya existen.
-- 4) Presupuestos: uno por usuario/categoría/mes, monto > 0, mes válido y
--    borrado en cascada con su categoría.
-- 5) Bucket de facturas con tamaño máximo y tipos de archivo permitidos.
-- 6) Timeouts explícitos por rol e índices para que las consultas por
--    usuario no se acerquen a ese límite.
--
-- Nada de esto usa SQL dinámico (EXECUTE con texto concatenado): todas
-- las consultas son estáticas, así que no hay superficie de inyección SQL.

-- ---------------------------------------------------------------------
-- 1) Validación de pertenencia de las referencias
-- ---------------------------------------------------------------------

create or replace function public.validar_referencias_propias()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fila jsonb := to_jsonb(new);
  anterior jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  -- Con sesión de usuario manda auth.uid(); con service_role (sin JWT de
  -- usuario) se usa el dueño declarado en la fila.
  dueno uuid := coalesce(auth.uid(), new.usuario_id);
  columna text;
  ref uuid;
begin
  foreach columna in array array['cuenta_id', 'cuenta_origen_id', 'categoria_id', 'deuda_id', 'gasto_id'] loop
    continue when not (fila ? columna);
    ref := nullif(fila ->> columna, '')::uuid;
    continue when ref is null;
    -- En un UPDATE solo se valida lo que cambió: no se rompen filas viejas.
    continue when tg_op = 'UPDATE' and (anterior ->> columna) is not distinct from (fila ->> columna);

    if columna in ('cuenta_id', 'cuenta_origen_id') then
      if not exists (select 1 from cuentas where id = ref and usuario_id = dueno) then
        raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'categoria_id' then
      if not exists (select 1 from categorias where id = ref and (usuario_id is null or usuario_id = dueno)) then
        raise exception 'La categoría indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'deuda_id' then
      if not exists (select 1 from deudas where id = ref and usuario_id = dueno) then
        raise exception 'La deuda indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'gasto_id' then
      if not exists (select 1 from gastos where id = ref and usuario_id = dueno) then
        raise exception 'El gasto indicado no existe o no es tuyo.' using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

-- "trg_00_" para que corra antes que cualquier otro trigger BEFORE de la tabla.
drop trigger if exists trg_00_validar_referencias on gastos;
create trigger trg_00_validar_referencias before insert or update on gastos
  for each row execute function validar_referencias_propias();

drop trigger if exists trg_00_validar_referencias on ingresos;
create trigger trg_00_validar_referencias before insert or update on ingresos
  for each row execute function validar_referencias_propias();

drop trigger if exists trg_00_validar_referencias on pagos_tarjeta;
create trigger trg_00_validar_referencias before insert or update on pagos_tarjeta
  for each row execute function validar_referencias_propias();

drop trigger if exists trg_00_validar_referencias on deudas;
create trigger trg_00_validar_referencias before insert or update on deudas
  for each row execute function validar_referencias_propias();

drop trigger if exists trg_00_validar_referencias on recordatorios;
create trigger trg_00_validar_referencias before insert or update on recordatorios
  for each row execute function validar_referencias_propias();

drop trigger if exists trg_00_validar_referencias on presupuestos;
create trigger trg_00_validar_referencias before insert or update on presupuestos
  for each row execute function validar_referencias_propias();

drop trigger if exists trg_00_validar_referencias on transacciones_detectadas;
create trigger trg_00_validar_referencias before insert or update on transacciones_detectadas
  for each row execute function validar_referencias_propias();

-- ---------------------------------------------------------------------
-- 2) Triggers de saldo: filtran por dueño y fijan search_path
-- ---------------------------------------------------------------------

create or replace function public.aplicar_gasto_a_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible - new.monto
    where id = new.cuenta_id and usuario_id = new.usuario_id;
  end if;
  return new;
end;
$$;

create or replace function public.revertir_gasto_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cuenta_id is not null then
    update cuentas
    set disponible = case
      when cupo_total is not null then least(cupo_total, disponible + old.monto)
      else disponible + old.monto
    end
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
  if old.cuenta_id is not null then
    update cuentas
    set disponible = case
      when cupo_total is not null then least(cupo_total, disponible + old.monto)
      else disponible + old.monto
    end
    where id = old.cuenta_id and usuario_id = old.usuario_id;
  end if;
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible - new.monto
    where id = new.cuenta_id and usuario_id = new.usuario_id;
  end if;
  return new;
end;
$$;

create or replace function public.aplicar_ingreso_a_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible + new.monto
    where id = new.cuenta_id and usuario_id = new.usuario_id and tipo <> 'credito';
  end if;
  return new;
end;
$$;

create or replace function public.revertir_ingreso_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cuenta_id is not null then
    update cuentas set disponible = disponible - old.monto
    where id = old.cuenta_id and usuario_id = old.usuario_id and tipo <> 'credito';
  end if;
  return old;
end;
$$;

create or replace function public.aplicar_pago_tarjeta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update cuentas
  set disponible = case
    when cupo_total is not null then least(cupo_total, disponible + new.monto)
    else disponible + new.monto
  end
  where id = new.cuenta_id and usuario_id = new.usuario_id;

  if new.cuenta_origen_id is not null then
    update cuentas set disponible = disponible - new.monto
    where id = new.cuenta_origen_id and usuario_id = new.usuario_id;
  end if;

  return new;
end;
$$;

-- Su cuerpo ya usa new.usuario_id; solo le falta el search_path fijo.
alter function public.crear_deuda_de_gasto_diferido() set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 3) Límites de longitud y formato
-- ---------------------------------------------------------------------

alter table gastos drop constraint if exists gastos_descripcion_valida;
alter table gastos add constraint gastos_descripcion_valida
  check (btrim(descripcion) <> '' and char_length(descripcion) <= 200) not valid;
alter table gastos drop constraint if exists gastos_categoria_detalle_valida;
alter table gastos add constraint gastos_categoria_detalle_valida
  check (categoria_detalle is null or char_length(categoria_detalle) <= 80) not valid;
-- La factura tiene que vivir en la carpeta del propio usuario.
alter table gastos drop constraint if exists gastos_factura_path_valida;
alter table gastos add constraint gastos_factura_path_valida
  check (factura_path is null or (char_length(factura_path) <= 300 and factura_path like usuario_id::text || '/%')) not valid;

alter table ingresos drop constraint if exists ingresos_descripcion_valida;
alter table ingresos add constraint ingresos_descripcion_valida
  check (btrim(descripcion) <> '' and char_length(descripcion) <= 200) not valid;
alter table ingresos drop constraint if exists ingresos_categoria_detalle_valida;
alter table ingresos add constraint ingresos_categoria_detalle_valida
  check (categoria_detalle is null or char_length(categoria_detalle) <= 80) not valid;

alter table cuentas drop constraint if exists cuentas_nombre_valido;
alter table cuentas add constraint cuentas_nombre_valido
  check (btrim(nombre) <> '' and char_length(nombre) <= 80) not valid;
alter table cuentas drop constraint if exists cuentas_identificador_valido;
alter table cuentas add constraint cuentas_identificador_valido
  check (identificador is null or identificador ~ '^[0-9]{3,4}$') not valid;
alter table cuentas drop constraint if exists cuentas_estilo_valido;
alter table cuentas add constraint cuentas_estilo_valido
  check (estilo is null or estilo ~ '^[a-z0-9-]{1,60}$') not valid;

alter table categorias drop constraint if exists categorias_nombre_valido;
alter table categorias add constraint categorias_nombre_valido
  check (btrim(nombre) <> '' and char_length(nombre) <= 80) not valid;
alter table categorias drop constraint if exists categorias_color_valido;
alter table categorias add constraint categorias_color_valido
  check (color ~ '^#[0-9a-fA-F]{6}$') not valid;

alter table deudas drop constraint if exists deudas_nombre_valido;
alter table deudas add constraint deudas_nombre_valido
  check (btrim(nombre) <> '' and char_length(nombre) <= 80) not valid;
alter table deudas drop constraint if exists deudas_tasa_valida;
alter table deudas add constraint deudas_tasa_valida
  check (tasa_interes is null or tasa_interes >= 0) not valid;

alter table recordatorios drop constraint if exists recordatorios_titulo_valido;
alter table recordatorios add constraint recordatorios_titulo_valido
  check (btrim(titulo) <> '' and char_length(titulo) <= 120) not valid;

alter table pagos_tarjeta drop constraint if exists pagos_tarjeta_origen_distinto;
alter table pagos_tarjeta add constraint pagos_tarjeta_origen_distinto
  check (cuenta_origen_id is null or cuenta_origen_id <> cuenta_id) not valid;

alter table transacciones_detectadas drop constraint if exists transacciones_detectadas_textos_validos;
alter table transacciones_detectadas add constraint transacciones_detectadas_textos_validos
  check (
    char_length(mensaje_id) <= 500
    and btrim(descripcion) <> '' and char_length(descripcion) <= 200
    and (correo_asunto is null or char_length(correo_asunto) <= 300)
    and (banco is null or char_length(banco) <= 40)
  ) not valid;

-- ---------------------------------------------------------------------
-- 4) Presupuestos
-- ---------------------------------------------------------------------

alter table presupuestos drop constraint if exists presupuestos_categoria_id_fkey;
alter table presupuestos add constraint presupuestos_categoria_id_fkey
  foreign key (categoria_id) references categorias(id) on delete cascade;

alter table presupuestos drop constraint if exists presupuestos_valido;
alter table presupuestos add constraint presupuestos_valido
  check (
    categoria_id is not null
    and monto_limite > 0
    and mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ) not valid;

-- Uno por usuario/categoría/mes. Es el destino del upsert de
-- `guardarPresupuesto` (onConflict: usuario_id,categoria_id,mes).
create unique index if not exists presupuestos_usuario_categoria_mes_key
  on presupuestos (usuario_id, categoria_id, mes);

-- ---------------------------------------------------------------------
-- 5) Bucket de facturas: máx. 10 MB y solo PDF / imágenes
-- ---------------------------------------------------------------------

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'facturas';

-- ---------------------------------------------------------------------
-- 6) Timeouts e índices
-- ---------------------------------------------------------------------

-- Una consulta que se cuelga no puede retener una conexión para siempre.
-- (Son los valores por defecto de Supabase; se dejan explícitos para que
-- no dependan de la configuración del proyecto.)
alter role authenticated set statement_timeout = '8s';
alter role anon set statement_timeout = '3s';

-- Todas las pantallas filtran por usuario (RLS) y ordenan por fecha.
create index if not exists gastos_usuario_fecha_idx on gastos (usuario_id, fecha desc);
create index if not exists ingresos_usuario_fecha_idx on ingresos (usuario_id, fecha desc);
create index if not exists pagos_tarjeta_usuario_fecha_idx on pagos_tarjeta (usuario_id, fecha desc);
create index if not exists recordatorios_usuario_fecha_idx on recordatorios (usuario_id, fecha);
create index if not exists cuentas_usuario_idx on cuentas (usuario_id);
create index if not exists deudas_usuario_idx on deudas (usuario_id);
create index if not exists transacciones_detectadas_usuario_estado_idx on transacciones_detectadas (usuario_id, estado);
-- Claves foráneas que se recorren al borrar una cuenta o un gasto.
create index if not exists gastos_cuenta_idx on gastos (cuenta_id);
create index if not exists ingresos_cuenta_idx on ingresos (cuenta_id);
create index if not exists deudas_gasto_idx on deudas (gasto_id);

-- PostgREST lee los ajustes por rol al recargar su caché.
notify pgrst, 'reload schema';


-- >>> 20261014120000_abono_deuda_atomico.sql
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


-- >>> 20261014130000_saldos_confiables.sql
-- P0 · Saldos confiables (versión mínima).
--
-- Revisión de las operaciones que mueven dinero y que todavía podían dejar
-- los saldos descuadrados:
--   1) Editar un ingreso: la base lo permitía (política de UPDATE) pero
--      ningún trigger reajustaba la cuenta. Ahora se revierte el monto/cuenta
--      viejos y se aplica el nuevo, igual que ya pasaba con los gastos.
--   2) Borrar un pago de tarjeta: se permitía y no revertía nada (la tarjeta
--      quedaba con cupo de más y la cuenta de origen sin el débito). Revertir
--      automáticamente tampoco es correcto: cuando el pago desaparece porque
--      se borra la tarjeta (cascada), ese dinero sí salió de la cuenta. Un
--      pago registrado pasa a ser un movimiento definitivo; si hiciera falta
--      anular uno por error, será con una función explícita de anulación.
--      (Las cascadas de la clave foránea siguen funcionando: no pasan por RLS.)
--   3) Borrar una cuenta que se usó como origen de un pago fallaba por la
--      clave foránea sin ON DELETE. Ahora el pago queda, sin origen.
--   4) Editar un gasto diferido no actualizaba la deuda que generó, y
--      convertir un gasto en diferido al editarlo no la creaba. En vez de
--      sincronizar (con abonos de por medio sería frágil), se bloquea: para
--      cambiar monto, cuenta, método o plazo se elimina y se registra de nuevo.
--
-- SQL estático y funciones con search_path fijo, como el resto del esquema.

-- 1) Editar un ingreso reajusta el saldo -------------------------------

create or replace function public.ajustar_ingreso_actualizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cuenta_id is not null then
    update cuentas set disponible = disponible - old.monto
    where id = old.cuenta_id and usuario_id = old.usuario_id and tipo <> 'credito';
  end if;
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible + new.monto
    where id = new.cuenta_id and usuario_id = new.usuario_id and tipo <> 'credito';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ajustar_ingreso_actualizado on ingresos;
create trigger trg_ajustar_ingreso_actualizado
  after update of monto, cuenta_id on ingresos
  for each row execute function ajustar_ingreso_actualizado();

-- 2) Los pagos de tarjeta no se borran desde la app --------------------

drop policy if exists "pagos_tarjeta: delete propio" on pagos_tarjeta;

-- 3) Borrar la cuenta de origen deja el pago sin origen ----------------

alter table pagos_tarjeta drop constraint if exists pagos_tarjeta_cuenta_origen_id_fkey;
alter table pagos_tarjeta
  add constraint pagos_tarjeta_cuenta_origen_id_fkey
  foreign key (cuenta_origen_id) references cuentas(id) on delete set null;

-- 4) Un gasto diferido no se edita en lo que define su deuda -----------

create or replace function public.proteger_gasto_diferido()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.metodo_pago = 'diferido' and (
       new.monto is distinct from old.monto
    or new.metodo_pago is distinct from old.metodo_pago
    or new.meses_diferido is distinct from old.meses_diferido
    -- Soltar la cuenta (null) sí se permite: es lo que hace la base cuando
    -- se borra la tarjeta (ON DELETE SET NULL). Cambiarla por otra, no.
    or (new.cuenta_id is not null and new.cuenta_id is distinct from old.cuenta_id)
  ) then
    raise exception 'Un gasto diferido no se puede editar en monto, cuenta, método de pago o plazo: elimínalo y regístralo de nuevo.'
      using errcode = '22023';
  end if;

  if new.metodo_pago = 'diferido' and old.metodo_pago is distinct from 'diferido' then
    raise exception 'Un gasto no se puede convertir en diferido al editarlo: regístralo de nuevo como diferido.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

-- "trg_01_" para que corra después de trg_00_validar_referencias.
drop trigger if exists trg_01_proteger_gasto_diferido on gastos;
create trigger trg_01_proteger_gasto_diferido
  before update on gastos
  for each row execute function proteger_gasto_diferido();

notify pgrst, 'reload schema';


-- >>> 20261014140000_correo_confirmacion_y_privacidad.sql
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


-- >>> 20261014150000_agregar_bancos_pacifico_y_austro.sql
-- Permite guardar cuentas y tarjetas de Banco del Pacífico y Banco del Austro.
alter table cuentas drop constraint if exists cuentas_banco_check;
alter table cuentas
  add constraint cuentas_banco_check
  check (banco in (
    'banco_guayaquil',
    'pichincha',
    'produbanco',
    'diners_club',
    'banco_pacifico',
    'banco_austro',
    'otro'
  ));


-- >>> 20261015120000_integridad_saldos.sql
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


-- >>> 20261015150000_categoria_salud.sql
-- Categoría global de gasto para consumos médicos detectados en estados de cuenta.
insert into categorias (nombre, color, tipo)
select 'Salud', '#ef4444', 'gasto'
where not exists (
  select 1 from categorias where nombre = 'Salud' and tipo = 'gasto' and usuario_id is null
);


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


-- >>> 20261015190000_eliminar_cuenta.sql
-- Migración de eliminar cuenta.
--
-- Google Play exige que quien se registra pueda borrar su cuenta desde la
-- app, y la Ley Orgánica de Protección de Datos Personales de Ecuador da
-- derecho a la eliminación. La app no puede borrar usuarios de auth (eso
-- requiere la clave service_role, que nunca va en una app): lo hace esta
-- función, y solo para quien la llama.
--
-- Las facturas (archivos en Storage) las borra antes la app con la API de
-- Storage: Supabase no permite borrar archivos con SQL. Si queda alguna, la
-- función se niega, para no dejar facturas huérfanas con datos personales.
create or replace function public.eliminar_mi_cuenta(p_confirmacion text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  -- Evita que un error de programación borre la cuenta sin querer.
  if p_confirmacion is distinct from 'ELIMINAR' then
    raise exception 'Escribe ELIMINAR para confirmar.' using errcode = '22023';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'facturas' and (storage.foldername(name))[1] = v_usuario::text
  ) then
    raise exception 'Todavía quedan facturas guardadas. Inténtalo de nuevo.' using errcode = '22023';
  end if;

  -- Las 10 tablas de la app apuntan a auth.users con ON DELETE CASCADE: se
  -- borran todos sus datos (y sus sesiones, que también cuelgan de auth.users).
  delete from auth.users where id = v_usuario;
end;
$$;

revoke all on function public.eliminar_mi_cuenta(text) from public, anon;
grant execute on function public.eliminar_mi_cuenta(text) to authenticated;


-- >>> 20261015200000_rendimiento.sql
-- Migración de rendimiento.

-- 1) Índices para las claves foráneas que no tenían (los pide el asesor de
--    rendimiento de Supabase). Sin ellos, borrar una categoría, una cuenta o
--    una deuda recorría tablas enteras buscando lo que dependía de ella.
create index if not exists categorias_usuario_id_idx on public.categorias (usuario_id);
create index if not exists gastos_categoria_id_idx on public.gastos (categoria_id);
create index if not exists presupuestos_categoria_id_idx on public.presupuestos (categoria_id);
create index if not exists ingresos_categoria_id_idx on public.ingresos (categoria_id);
create index if not exists pagos_tarjeta_cuenta_id_idx on public.pagos_tarjeta (cuenta_id);
create index if not exists pagos_tarjeta_cuenta_origen_id_idx on public.pagos_tarjeta (cuenta_origen_id);
create index if not exists deudas_cuenta_id_idx on public.deudas (cuenta_id);
create index if not exists recordatorios_deuda_id_idx on public.recordatorios (deuda_id);
create index if not exists transacciones_detectadas_categoria_id_idx on public.transacciones_detectadas (categoria_id);
create index if not exists transacciones_detectadas_cuenta_id_idx on public.transacciones_detectadas (cuenta_id);
create index if not exists abonos_deuda_cuenta_id_idx on public.abonos_deuda (cuenta_id);
create index if not exists abonos_deuda_deuda_id_idx on public.abonos_deuda (deuda_id);

-- 2) Las reglas de RLS llamaban a auth.uid() una vez POR FILA. Envuelto en
--    (select auth.uid()), Postgres lo calcula una sola vez por consulta
--    (recomendación del asesor de Supabase). El significado no cambia: solo
--    se reemplaza la llamada dentro de cada regla existente. Las que ya
--    estaban envueltas se dejan igual, así que se puede volver a correr.
do $$
declare
  p record;
  v_using text;
  v_check text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      and coalesce(qual, '') !~* 'select auth\.uid'
      and coalesce(with_check, '') !~* 'select auth\.uid'
  loop
    v_using := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    v_check := replace(p.with_check, 'auth.uid()', '(select auth.uid())');
    execute format('alter policy %I on public.%I%s%s', p.policyname, p.tablename,
      case when v_using is not null then format(' using (%s)', v_using) else '' end,
      case when v_check is not null then format(' with check (%s)', v_check) else '' end);
  end loop;
end;
$$;

-- 3) Totales de gastos e ingresos por mes, calculados en la base. Para los
--    gráficos y el resumen ya no hace falta descargar todos los movimientos.
--    SECURITY INVOKER: RLS aplica, cada quien suma solo lo suyo.
create or replace function public.totales_por_mes(p_desde date, p_hasta date)
returns table (mes text, total_gastos numeric, total_ingresos numeric)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas inválido.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 3660 then
    raise exception 'El rango no puede pasar de 10 años.' using errcode = '22023';
  end if;

  return query
  with meses as (
    select to_char(m, 'YYYY-MM') as mes
    from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') as m
  ),
  g as (
    select to_char(fecha, 'YYYY-MM') as mes, sum(monto) as total
    from gastos where fecha between p_desde and p_hasta group by 1
  ),
  i as (
    select to_char(fecha, 'YYYY-MM') as mes, sum(monto) as total
    from ingresos where fecha between p_desde and p_hasta group by 1
  )
  select meses.mes, coalesce(g.total, 0)::numeric, coalesce(i.total, 0)::numeric
  from meses
  left join g on g.mes = meses.mes
  left join i on i.mes = meses.mes
  order by meses.mes;
end;
$$;

revoke all on function public.totales_por_mes(date, date) from public, anon;
grant execute on function public.totales_por_mes(date, date) to authenticated;


-- >>> 20261016120000_billeteras_y_ubicacion.sql
-- Migración de billeteras y ubicación (Fase 1 del plan de billeteras).
--
-- 1) "Pagado con": Apple Pay y Google Wallet no son un método de pago nuevo,
--    pagan con una tarjeta de débito o crédito. Van en una columna aparte
--    (`billetera`) y `metodo_pago` sigue diciendo débito/crédito: los saldos,
--    los cupos y los diferidos no cambian.
-- 2) Ubicación de cada gasto. Las columnas numeric(6,4)/(7,4) la redondean
--    a 4 decimales (unos 11 m): alcanza para agrupar por lugar sin guardar la
--    posición exacta. También se guarda la precisión que dio el GPS.
-- 3) Lugares: un gasto con ubicación se asigna al lugar propio más cercano
--    dentro de su radio, o crea uno nuevo con el nombre del gasto.
-- 4) Bandeja: de dónde vino el aviso (correo, Apple Pay, Google Wallet), el
--    comercio, la ubicación y los últimos dígitos de la tarjeta. Al confirmar,
--    todo pasa al gasto; al resolver el aviso se borra de él (minimización).

-- 1) Lugares ------------------------------------------------------------

create table if not exists public.lugares (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  latitud numeric(6, 4) not null check (latitud between -90 and 90),
  longitud numeric(7, 4) not null check (longitud between -180 and 180),
  radio_m integer not null default 80 check (radio_m between 20 and 500),
  created_at timestamptz not null default now()
);

create index if not exists lugares_usuario_latitud_idx on public.lugares (usuario_id, latitud);

alter table public.lugares enable row level security;
revoke all on public.lugares from anon;

drop policy if exists "lugares: select propio" on public.lugares;
create policy "lugares: select propio" on public.lugares
  for select to authenticated using (auth.uid() = usuario_id);
drop policy if exists "lugares: insert propio" on public.lugares;
create policy "lugares: insert propio" on public.lugares
  for insert to authenticated with check (auth.uid() = usuario_id);
drop policy if exists "lugares: update propio" on public.lugares;
create policy "lugares: update propio" on public.lugares
  for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
drop policy if exists "lugares: delete propio" on public.lugares;
create policy "lugares: delete propio" on public.lugares
  for delete to authenticated using (auth.uid() = usuario_id);

-- Distancia en metros entre dos puntos (fórmula de haversine). Sin PostGIS:
-- cada usuario tiene pocos lugares y la búsqueda se acota antes por latitud.
create or replace function public.distancia_m(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians((lat2 - lat1)::double precision) / 2), 2)
    + cos(radians(lat1::double precision)) * cos(radians(lat2::double precision))
      * power(sin(radians((lon2 - lon1)::double precision) / 2), 2)
  )))
$$;

-- 2) Gastos: pagado con, ubicación y lugar ------------------------------

alter table public.gastos
  add column if not exists billetera text,
  add column if not exists latitud numeric(6, 4),
  add column if not exists longitud numeric(7, 4),
  add column if not exists precision_m integer,
  add column if not exists lugar_id uuid references public.lugares(id) on delete set null;

alter table public.gastos drop constraint if exists gastos_billetera_valida;
alter table public.gastos add constraint gastos_billetera_valida
  check (billetera is null or billetera in ('apple_pay', 'google_wallet', 'otra'));

-- Una billetera paga con tarjeta: no tiene sentido con efectivo o transferencia.
alter table public.gastos drop constraint if exists gastos_billetera_con_tarjeta;
alter table public.gastos add constraint gastos_billetera_con_tarjeta
  check (billetera is null or metodo_pago is null or metodo_pago in ('debito', 'credito', 'diferido'));

alter table public.gastos drop constraint if exists gastos_ubicacion_valida;
alter table public.gastos add constraint gastos_ubicacion_valida
  check (
    (latitud is null) = (longitud is null)
    and (precision_m is null or latitud is not null)
    and (latitud is null or latitud between -90 and 90)
    and (longitud is null or longitud between -180 and 180)
    and (precision_m is null or precision_m between 0 and 50000)
  );

-- Borrar un lugar pone lugar_id en NULL en sus gastos: sin índice, recorre la tabla.
create index if not exists gastos_lugar_idx on public.gastos (lugar_id) where lugar_id is not null;

-- 3) Bandeja: origen, comercio, ubicación y tarjeta ----------------------

alter table public.transacciones_detectadas
  add column if not exists origen text not null default 'correo',
  add column if not exists comercio text,
  add column if not exists latitud numeric(6, 4),
  add column if not exists longitud numeric(7, 4),
  add column if not exists precision_m integer,
  add column if not exists tarjeta_final text;

alter table public.transacciones_detectadas drop constraint if exists transacciones_detectadas_origen_valido;
alter table public.transacciones_detectadas add constraint transacciones_detectadas_origen_valido
  check (origen in ('correo', 'apple_pay', 'google_wallet') and (origen = 'correo' or tipo = 'gasto'));

alter table public.transacciones_detectadas drop constraint if exists transacciones_detectadas_billetera_valida;
alter table public.transacciones_detectadas add constraint transacciones_detectadas_billetera_valida
  check (
    (comercio is null or char_length(comercio) <= 200)
    and (tarjeta_final is null or tarjeta_final ~ '^[0-9]{3,4}$')
    and (latitud is null) = (longitud is null)
    and (precision_m is null or latitud is not null)
    and (latitud is null or latitud between -90 and 90)
    and (longitud is null or longitud between -180 and 180)
    and (precision_m is null or precision_m between 0 and 50000)
  );

-- 4) Referencias propias: ahora también el lugar ------------------------
-- Igual que la versión de 20261013120000, con la rama de `lugar_id`.

create or replace function public.validar_referencias_propias()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fila jsonb := to_jsonb(new);
  anterior jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  -- Con sesión de usuario manda auth.uid(); con service_role (sin JWT de
  -- usuario) se usa el dueño declarado en la fila.
  dueno uuid := coalesce(auth.uid(), new.usuario_id);
  columna text;
  ref uuid;
begin
  foreach columna in array array['cuenta_id', 'cuenta_origen_id', 'categoria_id', 'deuda_id', 'gasto_id', 'lugar_id'] loop
    continue when not (fila ? columna);
    ref := nullif(fila ->> columna, '')::uuid;
    continue when ref is null;
    -- En un UPDATE solo se valida lo que cambió: no se rompen filas viejas.
    continue when tg_op = 'UPDATE' and (anterior ->> columna) is not distinct from (fila ->> columna);

    if columna in ('cuenta_id', 'cuenta_origen_id') then
      if not exists (select 1 from cuentas where id = ref and usuario_id = dueno) then
        raise exception 'La cuenta indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'categoria_id' then
      if not exists (select 1 from categorias where id = ref and (usuario_id is null or usuario_id = dueno)) then
        raise exception 'La categoría indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'deuda_id' then
      if not exists (select 1 from deudas where id = ref and usuario_id = dueno) then
        raise exception 'La deuda indicada no existe o no es tuya.' using errcode = '42501';
      end if;
    elsif columna = 'gasto_id' then
      if not exists (select 1 from gastos where id = ref and usuario_id = dueno) then
        raise exception 'El gasto indicado no existe o no es tuyo.' using errcode = '42501';
      end if;
    elsif columna = 'lugar_id' then
      if not exists (select 1 from lugares where id = ref and usuario_id = dueno) then
        raise exception 'El lugar indicado no existe o no es tuyo.' using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

-- 5) Asignar el lugar de un gasto ---------------------------------------
-- `security invoker`: busca y crea lugares con los permisos de quien guarda
-- el gasto, así RLS impide tocar lugares ajenos aunque la fila diga otro dueño.

create or replace function public.asignar_lugar_gasto()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lugar uuid;
  -- 500 m (el radio máximo) en grados de latitud; en longitud se corrige por
  -- la latitud. No contempla el antimeridiano (±180°), que no cruza Ecuador.
  v_dlat numeric := 0.0046;
  v_dlon numeric;
begin
  if tg_op = 'UPDATE' then
    if new.latitud is not distinct from old.latitud and new.longitud is not distinct from old.longitud then
      return new;
    end if;
    -- Cambió la ubicación y no se eligió otro lugar a mano: se recalcula.
    if new.lugar_id is not distinct from old.lugar_id then
      new.lugar_id := null;
    end if;
  end if;

  if new.lugar_id is not null or new.latitud is null then
    return new;
  end if;
  -- Ubicación incompleta o imposible: los CHECK de gastos corren después de
  -- los triggers BEFORE, así que se deja pasar para que ellos la rechacen.
  if new.longitud is null or abs(new.latitud) > 90 or abs(new.longitud) > 180 then
    return new;
  end if;
  -- GPS impreciso: mejor sin lugar que en el lugar equivocado.
  if new.precision_m is not null and new.precision_m > 200 then
    return new;
  end if;

  v_dlon := v_dlat / greatest(cos(radians(new.latitud::double precision)), 0.01)::numeric;

  select l.id into v_lugar
  from lugares l
  where l.usuario_id = new.usuario_id
    and l.latitud between new.latitud - v_dlat and new.latitud + v_dlat
    and l.longitud between new.longitud - v_dlon and new.longitud + v_dlon
    and distancia_m(l.latitud, l.longitud, new.latitud, new.longitud) <= l.radio_m
  order by distancia_m(l.latitud, l.longitud, new.latitud, new.longitud), l.created_at
  limit 1;

  if v_lugar is null then
    insert into lugares (usuario_id, nombre, latitud, longitud)
    values (
      new.usuario_id,
      coalesce(nullif(left(btrim(new.descripcion), 80), ''), 'Lugar sin nombre'),
      new.latitud,
      new.longitud
    )
    returning id into v_lugar;
  end if;

  new.lugar_id := v_lugar;
  return new;
end;
$$;

-- "trg_05_": corre después de validar referencias (trg_00) y el cupo (trg_03).
drop trigger if exists trg_05_asignar_lugar on public.gastos;
create trigger trg_05_asignar_lugar
  before insert or update of latitud, longitud on public.gastos
  for each row execute function public.asignar_lugar_gasto();

-- 6) Aviso resuelto: no vuelve atrás y se olvidan sus datos sensibles ------
-- Antes cada llamada borraba el asunto por su cuenta; ahora lo hace la base
-- para cualquier camino (confirmar, descartar o un UPDATE directo).

create or replace function public.proteger_estado_aviso()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.estado <> 'pendiente' and new.estado is distinct from old.estado then
    raise exception 'Este aviso ya fue %: no se puede cambiar.', old.estado using errcode = '22023';
  end if;
  if new.estado <> 'pendiente' then
    new.correo_asunto := null;
    new.comercio := null;
    new.latitud := null;
    new.longitud := null;
    new.precision_m := null;
    new.tarjeta_final := null;
  end if;
  return new;
end;
$$;

-- 7) Confirmar un aviso pasa la billetera y la ubicación al gasto ----------
-- Misma firma que antes: la app ya instalada sigue confirmando igual.

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
      if p_cuenta_id is not null then
        select case tipo when 'credito' then 'credito' when 'efectivo' then null else 'debito' end
        into v_metodo
        from cuentas where id = p_cuenta_id;
      end if;
    end if;
    insert into gastos (monto, descripcion, categoria_id, cuenta_id, fecha,
                        metodo_pago, billetera, latitud, longitud, precision_m)
    values (p_monto, p_descripcion, p_categoria_id, p_cuenta_id, v_aviso.fecha,
            v_metodo, v_billetera, v_aviso.latitud, v_aviso.longitud, v_aviso.precision_m)
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

notify pgrst, 'reload schema';


-- >>> 20261016130000_borrar_ubicaciones.sql
-- Migración de borrar ubicaciones (Fase 2 del plan de billeteras).
--
-- "Borrar todas mis ubicaciones": la Ley Orgánica de Protección de Datos
-- Personales da derecho a eliminar un dato personal sin borrar la cuenta.
-- En un solo paso (una transacción): quita la ubicación y el lugar de todos
-- los gastos, la ubicación de los avisos de la bandeja y borra los lugares.
-- Los gastos y sus montos no cambian: los saldos quedan igual.
--
-- `security invoker`: corre con los permisos de quien llama; RLS limita cada
-- UPDATE/DELETE a sus filas, y además se filtra por auth.uid() explícitamente.

create or replace function public.borrar_mis_ubicaciones()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_gastos int;
  v_avisos int;
  v_lugares int;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;

  update gastos
  set latitud = null, longitud = null, precision_m = null, lugar_id = null
  where usuario_id = v_usuario and (latitud is not null or lugar_id is not null);
  get diagnostics v_gastos = row_count;

  update transacciones_detectadas
  set latitud = null, longitud = null, precision_m = null
  where usuario_id = v_usuario and latitud is not null;
  get diagnostics v_avisos = row_count;

  delete from lugares where usuario_id = v_usuario;
  get diagnostics v_lugares = row_count;

  return jsonb_build_object('gastos', v_gastos, 'avisos', v_avisos, 'lugares', v_lugares);
end;
$$;

revoke execute on function public.borrar_mis_ubicaciones() from public, anon;
grant execute on function public.borrar_mis_ubicaciones() to authenticated;

notify pgrst, 'reload schema';


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


-- >>> 20261016150000_resumen_por_lugar.sql
-- Migración de resumen por lugar (Fase 5 del plan de billeteras).
--
-- 1) resumen_por_lugar: cuánto pagaste en cada lugar, cuántas veces y cuándo.
-- 2) resumen_por_comercio: junta los lugares con el MISMO nombre (sin mirar
--    mayúsculas ni espacios). Para juntar dos sucursales basta con ponerles el
--    mismo nombre: cada una conserva su ubicación.
-- 3) fusionar_lugares: pasa los pagos de un lugar a otro y borra el primero,
--    en un solo paso.
-- Renombrar y borrar un lugar no necesitan función: son un UPDATE/DELETE
-- normales, limitados por RLS (migración de billeteras y ubicación).
--
-- Todas son `security invoker`: corren con los permisos de quien llama y RLS
-- filtra lo propio; además se filtra por auth.uid() explícitamente. El rango
-- de fechas se limita a 2 años para que nadie pida una consulta enorme. Usan
-- el índice existente gastos (usuario_id, fecha).

create or replace function public.resumen_por_lugar(p_desde date, p_hasta date)
returns table (
  lugar_id uuid,
  nombre text,
  latitud numeric,
  longitud numeric,
  pagos integer,
  total numeric,
  promedio numeric,
  -- Parte del total pagado en lugares durante el rango, en %.
  porcentaje numeric,
  primer_pago date,
  ultimo_pago date,
  -- La más frecuente; con empate, cualquiera de las empatadas.
  categoria_id uuid,
  -- La más usada; null si ningún pago fue con billetera.
  billetera text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null then
    raise exception 'Indica el rango de fechas.' using errcode = '22023';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha final es anterior a la inicial.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 731 then
    raise exception 'El rango máximo es de 2 años.' using errcode = '22023';
  end if;

  return query
  select
    l.id,
    l.nombre,
    l.latitud,
    l.longitud,
    count(*)::integer,
    sum(g.monto),
    round(avg(g.monto), 2),
    round(100 * sum(g.monto) / nullif(sum(sum(g.monto)) over (), 0), 1),
    min(g.fecha),
    max(g.fecha),
    mode() within group (order by g.categoria_id),
    mode() within group (order by g.billetera)
  from gastos g
  join lugares l on l.id = g.lugar_id
  where g.usuario_id = v_usuario
    and l.usuario_id = v_usuario
    and g.fecha between p_desde and p_hasta
  group by l.id
  order by sum(g.monto) desc, max(g.fecha) desc, l.id;
end;
$$;

create or replace function public.resumen_por_comercio(p_desde date, p_hasta date)
returns table (
  comercio text,
  locales integer,
  pagos integer,
  total numeric,
  promedio numeric,
  ultimo_pago date,
  lugar_ids uuid[]
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null then
    raise exception 'Indica el rango de fechas.' using errcode = '22023';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha final es anterior a la inicial.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 731 then
    raise exception 'El rango máximo es de 2 años.' using errcode = '22023';
  end if;

  return query
  select
    -- El nombre tal como está escrito en el lugar con más pagos.
    mode() within group (order by l.nombre),
    count(distinct l.id)::integer,
    count(*)::integer,
    sum(g.monto),
    round(avg(g.monto), 2),
    max(g.fecha),
    array_agg(distinct l.id)
  from gastos g
  join lugares l on l.id = g.lugar_id
  where g.usuario_id = v_usuario
    and l.usuario_id = v_usuario
    and g.fecha between p_desde and p_hasta
  group by lower(regexp_replace(btrim(l.nombre), '\s+', ' ', 'g'))
  order by sum(g.monto) desc, max(g.fecha) desc;
end;
$$;

create or replace function public.fusionar_lugares(p_origen uuid, p_destino uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_propios int;
  v_movidos int;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if p_origen is null or p_destino is null or p_origen = p_destino then
    raise exception 'Elige dos lugares distintos.' using errcode = '22023';
  end if;

  -- Bloquea los dos lugares, siempre en el mismo orden (sin interbloqueos).
  perform 1 from lugares
  where id in (p_origen, p_destino) and usuario_id = v_usuario
  order by id
  for update;
  select count(*) into v_propios from lugares where id in (p_origen, p_destino) and usuario_id = v_usuario;
  if v_propios <> 2 then
    raise exception 'El lugar indicado no existe o no es tuyo.' using errcode = '42501';
  end if;

  update gastos set lugar_id = p_destino where lugar_id = p_origen and usuario_id = v_usuario;
  get diagnostics v_movidos = row_count;
  delete from lugares where id = p_origen and usuario_id = v_usuario;
  return v_movidos;
end;
$$;

revoke all on function public.resumen_por_lugar(date, date) from public, anon;
revoke all on function public.resumen_por_comercio(date, date) from public, anon;
revoke all on function public.fusionar_lugares(uuid, uuid) from public, anon;
grant execute on function public.resumen_por_lugar(date, date) to authenticated;
grant execute on function public.resumen_por_comercio(date, date) to authenticated;
grant execute on function public.fusionar_lugares(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';


-- >>> 20261016160000_casas_comerciales_y_corte.sql
-- Migración de casas comerciales y fecha de corte (fases A y B del plan de
-- cuentas, avisos y resumen).
--
-- 1) Casas comerciales y créditos directos (Comandato, Artefacta, Marcimex,
--    La Ganga, Japón, De Prati, Créditos Económicos u otra): se guardan como
--    una tarjeta de crédito (`tipo = 'credito'`, con cupo). Así las compras a
--    cuotas usan el diferido que ya existe, con su deuda, su cupo y su interés.
-- 2) Día de corte y día máximo de pago de una tarjeta (1-31; en meses más
--    cortos, el último día). Solo para crédito.

alter table public.cuentas drop constraint if exists cuentas_banco_check;
alter table public.cuentas
  add constraint cuentas_banco_check
  check (banco in (
    'banco_guayaquil',
    'pichincha',
    'produbanco',
    'diners_club',
    'banco_pacifico',
    'banco_austro',
    'otro',
    'comandato',
    'artefacta',
    'marcimex',
    'la_ganga',
    'japon',
    'de_prati',
    'creditos_economicos',
    'otra_casa_comercial'
  ));

-- Una casa comercial da crédito: no hay "cuenta de ahorros de Comandato".
alter table public.cuentas drop constraint if exists cuentas_casa_comercial_es_credito;
alter table public.cuentas
  add constraint cuentas_casa_comercial_es_credito
  check (
    tipo = 'credito'
    or banco not in ('comandato', 'artefacta', 'marcimex', 'la_ganga', 'japon', 'de_prati', 'creditos_economicos', 'otra_casa_comercial')
  );

alter table public.cuentas
  add column if not exists dia_corte smallint,
  add column if not exists dia_pago smallint;

alter table public.cuentas drop constraint if exists cuentas_fechas_tarjeta_validas;
alter table public.cuentas
  add constraint cuentas_fechas_tarjeta_validas
  check (
    (dia_corte is null or dia_corte between 1 and 31)
    and (dia_pago is null or dia_pago between 1 and 31)
    and (tipo = 'credito' or (dia_corte is null and dia_pago is null))
  );

notify pgrst, 'reload schema';


-- >>> 20261016170000_recordatorios_diferidos.sql
-- Migración de recordatorios de diferidos (fase C del plan de cuentas,
-- avisos y resumen).
--
-- Al comprar a cuotas (un gasto diferido), la base ya crea su deuda. Ahora
-- también crea un recordatorio por cada cuota, el mismo día de la compra de
-- cada mes (un 31 en un mes corto cae el último día), con el monto de la
-- cuota. Ejemplo: $130 a 3 meses el 10 de octubre → 10/10, 10/11 y 10/12,
-- de $43,34, $43,34 y $43,32.
--
-- 1) `recordatorios.automatico` marca los que creó la base. Siempre van
--    atados a su deuda.
-- 2) Al registrar un abono, los recordatorios de las cuotas ya pagadas se
--    marcan como hechos. Al saldar la deuda, se cierran todos.
-- 3) Al borrar el diferido (o su deuda), se borran sus recordatorios
--    automáticos. Los que creó el usuario y apuntaban a esa deuda se quedan,
--    sin deuda (antes, esa referencia impedía borrar la deuda).
-- 4) Los diferidos que ya existían reciben sus recordatorios, con las cuotas
--    ya pagadas marcadas como hechas.
--
-- Las fechas siguen la misma regla que `registrar_abono_deuda` usa para el
-- próximo pago, así que la cuota k cierra justo cuando el abono la paga.
-- Sin SQL dinámico.

alter table public.recordatorios add column if not exists automatico boolean not null default false;

alter table public.recordatorios drop constraint if exists recordatorios_automatico_con_deuda;
alter table public.recordatorios
  add constraint recordatorios_automatico_con_deuda
  check (not automatico or deuda_id is not null);

alter table public.recordatorios drop constraint if exists recordatorios_deuda_id_fkey;
alter table public.recordatorios
  add constraint recordatorios_deuda_id_fkey
  foreign key (deuda_id) references public.deudas(id) on delete set null;

-- 1) Crear los recordatorios al nacer la deuda de un diferido ---------

create or replace function public.crear_recordatorios_de_diferido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meses int;
begin
  if new.gasto_id is null or new.tipo <> 'diferido' then
    return null;
  end if;
  select meses_diferido into v_meses from public.gastos
  where id = new.gasto_id and usuario_id = new.usuario_id;
  if v_meses is null or v_meses < 1 then
    return null;
  end if;

  insert into public.recordatorios (usuario_id, titulo, tipo, monto, fecha, recurrente, completado, deuda_id, automatico)
  select
    new.usuario_id,
    left(format('Cuota %s de %s · %s', k + 1, v_meses, new.nombre), 120),
    'tarjeta',
    -- Sin interés, la última cuota lleva el redondeo: 130 / 3 = 43,34 + 43,34 + 43,32.
    case when k = v_meses - 1 and coalesce(new.tasa_interes, 0) = 0
      then greatest(new.monto_total - new.cuota_mensual * (v_meses - 1), 0.01)
      else new.cuota_mensual
    end,
    least(m.inicio + (extract(day from new.fecha_inicio)::int - 1),
      (m.inicio + interval '1 month' - interval '1 day')::date),
    false,
    false,
    new.id,
    true
  -- Tope de 60 cuotas: la app permite hasta 24.
  from generate_series(0, least(v_meses, 60) - 1) as k
  cross join lateral (
    select (date_trunc('month', new.fecha_inicio) + make_interval(months => k))::date as inicio
  ) as m;
  return null;
end;
$$;

drop trigger if exists trg_crear_recordatorios_de_diferido on public.deudas;
create trigger trg_crear_recordatorios_de_diferido
  after insert on public.deudas
  for each row when (new.gasto_id is not null)
  execute function public.crear_recordatorios_de_diferido();

-- 2) Cerrar los de las cuotas pagadas ---------------------------------

create or replace function public.cerrar_recordatorios_de_diferido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Solo se cierran, nunca se reabren: si el usuario marcó uno como hecho,
  -- se respeta.
  update public.recordatorios set completado = true
  where deuda_id = new.id
    and automatico
    and not completado
    and (new.saldo_pendiente <= 0 or (new.proximo_pago is not null and fecha < new.proximo_pago));
  return null;
end;
$$;

drop trigger if exists trg_cerrar_recordatorios_de_diferido on public.deudas;
create trigger trg_cerrar_recordatorios_de_diferido
  after update of saldo_pendiente, proximo_pago on public.deudas
  for each row when (new.gasto_id is not null)
  execute function public.cerrar_recordatorios_de_diferido();

-- 3) Borrarlos con su deuda -------------------------------------------

create or replace function public.borrar_recordatorios_de_diferido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.recordatorios where deuda_id = old.id and automatico;
  return old;
end;
$$;

-- BEFORE: así ya no existen cuando la FK suelta los recordatorios manuales.
-- Corre después de trg_proteger_borrado_deuda (orden alfabético), que impide
-- borrar un diferido con abonos.
drop trigger if exists trg_quitar_recordatorios_de_diferido on public.deudas;
create trigger trg_quitar_recordatorios_de_diferido
  before delete on public.deudas
  for each row
  execute function public.borrar_recordatorios_de_diferido();

-- Un recordatorio no cambia de automático a manual ni al revés.
create or replace function public.proteger_recordatorio_automatico()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.automatico is distinct from old.automatico then
    raise exception 'Un recordatorio automático no se puede convertir en manual (ni al revés).'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_recordatorio_automatico on public.recordatorios;
create trigger trg_proteger_recordatorio_automatico
  before update of automatico on public.recordatorios
  for each row
  execute function public.proteger_recordatorio_automatico();

-- 4) Diferidos que ya existían ----------------------------------------
-- Función de mantenimiento: solo la puede correr el dueño de la base (no se
-- expone por la API). Crea los recordatorios que le falten a cada diferido y
-- devuelve cuántos creó. Volver a correrla no duplica nada.

create or replace function public.crear_recordatorios_faltantes_de_diferidos()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_creados integer;
begin
  insert into public.recordatorios (usuario_id, titulo, tipo, monto, fecha, recurrente, completado, deuda_id, automatico)
  select
    d.usuario_id,
    left(format('Cuota %s de %s · %s', k + 1, g.meses_diferido, d.nombre), 120),
    'tarjeta',
    case when k = g.meses_diferido - 1 and coalesce(d.tasa_interes, 0) = 0
      then greatest(d.monto_total - d.cuota_mensual * (g.meses_diferido - 1), 0.01)
      else d.cuota_mensual
    end,
    f.fecha,
    false,
    d.saldo_pendiente <= 0 or (d.proximo_pago is not null and f.fecha < d.proximo_pago),
    d.id,
    true
  from public.deudas d
  join public.gastos g on g.id = d.gasto_id and g.usuario_id = d.usuario_id
  cross join lateral generate_series(0, least(g.meses_diferido, 60) - 1) as k
  cross join lateral (
    select least(m.inicio + (extract(day from d.fecha_inicio)::int - 1),
      (m.inicio + interval '1 month' - interval '1 day')::date) as fecha
    from (select (date_trunc('month', d.fecha_inicio) + make_interval(months => k))::date as inicio) as m
  ) as f
  where d.tipo = 'diferido'
    and g.meses_diferido > 0
    and not exists (select 1 from public.recordatorios r where r.deuda_id = d.id and r.automatico);
  get diagnostics v_creados = row_count;
  return v_creados;
end;
$$;

revoke execute on function public.crear_recordatorios_faltantes_de_diferidos() from public, anon, authenticated;

select public.crear_recordatorios_faltantes_de_diferidos();

notify pgrst, 'reload schema';


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


-- >>> seed.sql (categorías globales)
-- Categorías globales de gasto. Se puede correr más de una vez sin duplicar
-- (va también dentro de base-completa.sql).
insert into categorias (nombre, color)
select v.nombre, v.color
from (values
  ('Comida', '#f97316'),
  ('Transporte', '#3b82f6'),
  ('Ocio', '#a855f7'),
  ('Servicios', '#22c55e')
) as v(nombre, color)
where not exists (
  select 1 from categorias c where c.nombre = v.nombre and c.usuario_id is null and c.tipo = 'gasto'
);


-- >>> Registro de migraciones (lo mismo que crea la CLI de Supabase)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260826120000', 'gastos'),
  ('20260826130000', 'rls_policies'),
  ('20260826140000', 'finanzas_completas'),
  ('20260830120000', 'estilo_tarjeta'),
  ('20260830130000', 'eliminar_cuenta_con_movimientos'),
  ('20260830140000', 'categorias_crud'),
  ('20260830150000', 'gastos_factura_metodo_pago'),
  ('20260831120000', 'banco_diners_club'),
  ('20260831130000', 'gasto_diferido'),
  ('20260831140000', 'fix_metodo_pago_diferido'),
  ('20260831150000', 'pago_tarjeta_origen_y_tipo_diferido'),
  ('20260901120000', 'correo_transacciones_detectadas'),
  ('20261013120000', 'seguridad_y_presupuestos'),
  ('20261014120000', 'abono_deuda_atomico'),
  ('20261014130000', 'saldos_confiables'),
  ('20261014140000', 'correo_confirmacion_y_privacidad'),
  ('20261014150000', 'agregar_bancos_pacifico_y_austro'),
  ('20261015120000', 'integridad_saldos'),
  ('20261015150000', 'categoria_salud'),
  ('20261015170000', 'diferidos_cupo_interes'),
  ('20261015180000', 'proteger_tasa_diferido'),
  ('20261015190000', 'eliminar_cuenta'),
  ('20261015200000', 'rendimiento'),
  ('20261016120000', 'billeteras_y_ubicacion'),
  ('20261016130000', 'borrar_ubicaciones'),
  ('20261016140000', 'captura_apple_pay'),
  ('20261016150000', 'resumen_por_lugar'),
  ('20261016160000', 'casas_comerciales_y_corte'),
  ('20261016170000', 'recordatorios_diferidos'),
  ('20261016180000', 'captura_google_wallet')
on conflict (version) do nothing;

commit;

select count(*) as migraciones_registradas from supabase_migrations.schema_migrations;
