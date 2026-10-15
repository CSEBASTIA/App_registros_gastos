-- =====================================================================
-- gastos-app — BASE DE DATOS COMPLETA
-- Generado por supabase/generar-base-completa.sh el 2026-10-15 con las
-- 21 migraciones de supabase/migrations + seed.sql. No editar a mano.
--
-- Cómo usarlo en Supabase (web):
--   1. Proyecto nuevo → SQL Editor → New query.
--   2. Pegar TODO este archivo y pulsar Run.
--   3. Debe terminar mostrando "migraciones_registradas = 21".
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
  ('20261015180000', 'proteger_tasa_diferido')
on conflict (version) do nothing;

commit;

select count(*) as migraciones_registradas from supabase_migrations.schema_migrations;
