-- Pruebas de la migración 20261013120000_seguridad_y_presupuestos.
--
-- Se corre como superusuario sobre una base DESECHABLE con todas las
-- migraciones aplicadas (nunca sobre datos reales). Simula dos usuarios
-- (A y B) con el mismo mecanismo que usa PostgREST: rol `authenticated`
-- + claims del JWT en `request.jwt.claims`, así RLS y auth.uid() se
-- comportan igual que desde la app.
--
-- Cada prueba imprime "PASS ..." o "FAIL ...". Al final se cuentan.

\set ON_ERROR_STOP 1
set client_min_messages = notice;

create temp table resultados (prueba text, ok boolean, detalle text);
grant all on resultados to authenticated;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@prueba.local'),
  ('b0000000-0000-4000-8000-000000000002', 'b@prueba.local')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Datos de B (la víctima)
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into cuentas (id, nombre, tipo, disponible)
  values ('b1000000-0000-4000-8000-000000000001', 'Ahorro de B', 'ahorro', 1000);
insert into categorias (id, nombre, color, tipo, usuario_id)
  values ('b2000000-0000-4000-8000-000000000001', 'Privada de B', '#123456', 'gasto', 'b0000000-0000-4000-8000-000000000002');
insert into deudas (id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual)
  values ('b3000000-0000-4000-8000-000000000001', 'Préstamo de B', 'prestamo', 500, 500, 50);
commit;

-- ---------------------------------------------------------------------
-- Ataques de A contra B (antes de esta migración, varios pasaban)
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$ begin
  insert into gastos (monto, descripcion, cuenta_id) values (300, 'ataque', 'b1000000-0000-4000-8000-000000000001');
  insert into resultados values ('S1 gasto con cuenta ajena', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S1 gasto con cuenta ajena', true, sqlerrm);
end $$;

do $$ begin
  insert into ingresos (monto, descripcion, cuenta_id) values (300, 'ataque', 'b1000000-0000-4000-8000-000000000001');
  insert into resultados values ('S2 ingreso con cuenta ajena', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S2 ingreso con cuenta ajena', true, sqlerrm);
end $$;

do $$ begin
  insert into cuentas (id, nombre, tipo, cupo_total, disponible)
    values ('a1000000-0000-4000-8000-000000000009', 'Tarjeta A', 'credito', 1000, 0);
  insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto)
    values ('a1000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000001', 300);
  insert into resultados values ('S3 pagar tarjeta propia con cuenta ajena', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S3 pagar tarjeta propia con cuenta ajena', true, sqlerrm);
end $$;

do $$ begin
  insert into gastos (monto, descripcion, categoria_id) values (10, 'ataque', 'b2000000-0000-4000-8000-000000000001');
  insert into resultados values ('S4 gasto con categoría privada ajena', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S4 gasto con categoría privada ajena', true, sqlerrm);
end $$;

do $$ begin
  insert into recordatorios (titulo, tipo, fecha, deuda_id) values ('ataque', 'pago', current_date, 'b3000000-0000-4000-8000-000000000001');
  insert into resultados values ('S5 recordatorio con deuda ajena', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S5 recordatorio con deuda ajena', true, sqlerrm);
end $$;

do $$ begin
  insert into gastos (id, monto, descripcion) values ('a4000000-0000-4000-8000-000000000009', 10, 'legítimo');
  update gastos set cuenta_id = 'b1000000-0000-4000-8000-000000000001' where id = 'a4000000-0000-4000-8000-000000000009';
  insert into resultados values ('S6 editar gasto hacia cuenta ajena', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S6 editar gasto hacia cuenta ajena', true, sqlerrm);
end $$;

do $$ begin
  insert into gastos (monto, descripcion, usuario_id) values (10, 'suplantación', 'b0000000-0000-4000-8000-000000000002');
  insert into resultados values ('S7 insertar a nombre de otro usuario', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('S7 insertar a nombre de otro usuario', true, sqlerrm);
end $$;

do $$ declare n int; begin
  select count(*) into n from cuentas where usuario_id = 'b0000000-0000-4000-8000-000000000002';
  insert into resultados values ('S8 A no ve cuentas de B', n = 0, n || ' filas visibles');
  -- Solo las de B: A puede tener deudas propias (las crea abono_deuda.sql).
  select count(*) into n from deudas where usuario_id = 'b0000000-0000-4000-8000-000000000002';
  insert into resultados values ('S8b A no ve deudas de B', n = 0, n || ' filas visibles');
end $$;

do $$ declare n int; begin
  update cuentas set disponible = 0 where id = 'b1000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  insert into resultados values ('S9 A no puede editar la cuenta de B', n = 0, n || ' filas afectadas');
end $$;

-- Inyección: el texto se guarda tal cual, como dato, nunca como SQL.
do $$ declare guardado text; existe boolean; begin
  insert into gastos (id, monto, descripcion)
    values ('a4000000-0000-4000-8000-000000000010', 1, $t$'); drop table gastos; --$t$);
  select descripcion into guardado from gastos where id = 'a4000000-0000-4000-8000-000000000010';
  select to_regclass('public.gastos') is not null into existe;
  insert into resultados values ('S10 texto con SQL se guarda como dato', existe and guardado = $t$'); drop table gastos; --$t$, guardado);
end $$;
commit;

-- El saldo de B no se movió con ningún ataque.
do $$ declare d numeric; begin
  select disponible into d from cuentas where id = 'b1000000-0000-4000-8000-000000000001';
  insert into resultados values ('S11 saldo de B intacto tras los ataques', d = 1000, 'disponible = ' || d);
end $$;

-- ---------------------------------------------------------------------
-- Flujo normal de A (los triggers de saldo siguen funcionando)
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into cuentas (id, nombre, tipo, disponible) values ('a1000000-0000-4000-8000-000000000001', 'Ahorro A', 'ahorro', 500);
insert into cuentas (id, nombre, tipo, cupo_total, disponible) values ('a1000000-0000-4000-8000-000000000002', 'Visa A', 'credito', 1000, 1000);

insert into gastos (id, monto, descripcion, cuenta_id, categoria_id)
  select 'a4000000-0000-4000-8000-000000000001', 120, 'Supermercado', 'a1000000-0000-4000-8000-000000000001', id
  from categorias where nombre = 'Comida' and usuario_id is null;
do $$ declare d numeric; begin
  select disponible into d from cuentas where id = 'a1000000-0000-4000-8000-000000000001';
  insert into resultados values ('F1 gasto descuenta del ahorro (500-120)', d = 380, 'disponible = ' || d);
end $$;

update gastos set monto = 100 where id = 'a4000000-0000-4000-8000-000000000001';
do $$ declare d numeric; begin
  select disponible into d from cuentas where id = 'a1000000-0000-4000-8000-000000000001';
  insert into resultados values ('F2 editar monto reajusta (500-100)', d = 400, 'disponible = ' || d);
end $$;

insert into ingresos (monto, descripcion, cuenta_id) values (50, 'Venta', 'a1000000-0000-4000-8000-000000000001');
do $$ declare d numeric; begin
  select disponible into d from cuentas where id = 'a1000000-0000-4000-8000-000000000001';
  insert into resultados values ('F3 ingreso suma al ahorro (400+50)', d = 450, 'disponible = ' || d);
end $$;

insert into gastos (id, monto, descripcion, cuenta_id, metodo_pago, meses_diferido)
  values ('a4000000-0000-4000-8000-000000000002', 600, 'Refrigeradora', 'a1000000-0000-4000-8000-000000000002', 'diferido', 6);
do $$ declare d numeric; deuda record; begin
  select disponible into d from cuentas where id = 'a1000000-0000-4000-8000-000000000002';
  insert into resultados values ('F4 diferido consume cupo (1000-600)', d = 400, 'disponible = ' || d);
  select * into deuda from deudas where gasto_id = 'a4000000-0000-4000-8000-000000000002';
  insert into resultados values ('F5 diferido crea su deuda (tipo diferido, cuota 100)',
    deuda.tipo = 'diferido' and deuda.cuota_mensual = 100, coalesce(deuda.tipo, 'sin deuda') || ' / ' || coalesce(deuda.cuota_mensual::text, '-'));
end $$;

insert into pagos_tarjeta (cuenta_id, cuenta_origen_id, monto)
  values ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 200);
do $$ declare t numeric; a numeric; begin
  select disponible into t from cuentas where id = 'a1000000-0000-4000-8000-000000000002';
  select disponible into a from cuentas where id = 'a1000000-0000-4000-8000-000000000001';
  insert into resultados values ('F6 pago de tarjeta: tarjeta +200, ahorro -200', t = 600 and a = 250, 'tarjeta = ' || t || ', ahorro = ' || a);
end $$;

delete from gastos where id = 'a4000000-0000-4000-8000-000000000001';
do $$ declare d numeric; begin
  select disponible into d from cuentas where id = 'a1000000-0000-4000-8000-000000000001';
  insert into resultados values ('F7 borrar gasto devuelve el dinero (250+100)', d = 350, 'disponible = ' || d);
end $$;
commit;

-- ---------------------------------------------------------------------
-- Presupuestos (Paso 1)
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Mismo SQL que genera PostgREST para el upsert de guardarPresupuesto.
insert into presupuestos (categoria_id, monto_limite, mes)
  select id, 100, '2026-10' from categorias where nombre = 'Comida' and usuario_id is null
  on conflict (usuario_id, categoria_id, mes) do update set monto_limite = excluded.monto_limite;
insert into presupuestos (categoria_id, monto_limite, mes)
  select id, 150, '2026-10' from categorias where nombre = 'Comida' and usuario_id is null
  on conflict (usuario_id, categoria_id, mes) do update set monto_limite = excluded.monto_limite;
do $$ declare n int; m numeric; begin
  select count(*), max(monto_limite) into n, m from presupuestos where mes = '2026-10';
  insert into resultados values ('P1 upsert deja un solo presupuesto y actualiza el límite', n = 1 and m = 150, n || ' filas, límite ' || m);
end $$;

do $$ begin
  insert into presupuestos (categoria_id, monto_limite, mes)
    select id, 0, '2026-10' from categorias where nombre = 'Transporte' and usuario_id is null;
  insert into resultados values ('P2 límite 0 rechazado', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('P2 límite 0 rechazado', true, sqlerrm);
end $$;

do $$ begin
  insert into presupuestos (categoria_id, monto_limite, mes)
    select id, 50, '2026-13' from categorias where nombre = 'Transporte' and usuario_id is null;
  insert into resultados values ('P3 mes inválido rechazado', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('P3 mes inválido rechazado', true, sqlerrm);
end $$;

do $$ begin
  insert into presupuestos (categoria_id, monto_limite, mes) values (null, 50, '2026-10');
  insert into resultados values ('P4 presupuesto sin categoría rechazado', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('P4 presupuesto sin categoría rechazado', true, sqlerrm);
end $$;

do $$ begin
  insert into presupuestos (categoria_id, monto_limite, mes) values ('b2000000-0000-4000-8000-000000000001', 50, '2026-10');
  insert into resultados values ('P5 presupuesto sobre categoría ajena rechazado', false, 'se permitió');
exception when insufficient_privilege then
  insert into resultados values ('P5 presupuesto sobre categoría ajena rechazado', true, sqlerrm);
end $$;

-- Borrar una categoría propia arrastra sus presupuestos (antes fallaba por FK).
insert into categorias (id, nombre, color, tipo, usuario_id)
  values ('a2000000-0000-4000-8000-000000000001', 'Mascotas', '#aa5500', 'gasto', 'a0000000-0000-4000-8000-000000000001');
insert into presupuestos (categoria_id, monto_limite, mes) values ('a2000000-0000-4000-8000-000000000001', 40, '2026-10');
delete from categorias where id = 'a2000000-0000-4000-8000-000000000001';
do $$ declare n int; begin
  select count(*) into n from presupuestos where categoria_id = 'a2000000-0000-4000-8000-000000000001';
  insert into resultados values ('P6 borrar categoría borra sus presupuestos', n = 0, n || ' restantes');
end $$;
commit;

-- B puede tener su propio presupuesto para la misma categoría y mes, y no ve el de A.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from presupuestos;
  insert into resultados values ('P7 B no ve presupuestos de A', n = 0, n || ' visibles');
  insert into presupuestos (categoria_id, monto_limite, mes)
    select id, 80, '2026-10' from categorias where nombre = 'Comida' and usuario_id is null;
  insert into resultados values ('P8 B crea su presupuesto para la misma categoría/mes', true, 'ok');
end $$;
commit;

-- ---------------------------------------------------------------------
-- Límites de texto y factura
-- ---------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$ begin
  insert into gastos (monto, descripcion) values (1, repeat('x', 201));
  insert into resultados values ('L1 descripción de 201 caracteres rechazada', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('L1 descripción de 201 caracteres rechazada', true, sqlerrm);
end $$;

do $$ begin
  insert into gastos (monto, descripcion) values (1, '    ');
  insert into resultados values ('L2 descripción en blanco rechazada', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('L2 descripción en blanco rechazada', true, sqlerrm);
end $$;

do $$ begin
  insert into gastos (monto, descripcion, factura_path) values (1, 'x', 'b0000000-0000-4000-8000-000000000002/robada.pdf');
  insert into resultados values ('L3 factura en carpeta ajena rechazada', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('L3 factura en carpeta ajena rechazada', true, sqlerrm);
end $$;

do $$ begin
  insert into gastos (monto, descripcion, factura_path) values (1, 'x', 'a0000000-0000-4000-8000-000000000001/mia.pdf');
  insert into resultados values ('L4 factura en carpeta propia aceptada', true, 'ok');
end $$;

do $$ begin
  insert into cuentas (nombre, tipo, disponible, identificador) values ('x', 'debito', 0, '12a4');
  insert into resultados values ('L5 identificador no numérico rechazado', false, 'se permitió');
exception when check_violation then
  insert into resultados values ('L5 identificador no numérico rechazado', true, sqlerrm);
end $$;
commit;

-- ---------------------------------------------------------------------
-- Configuración: search_path, timeouts y bucket
-- ---------------------------------------------------------------------
do $$ declare sin_path text; begin
  select string_agg(p.proname, ', ') into sin_path
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  insert into resultados values ('C1 toda función security definer fija search_path', sin_path is null, coalesce(sin_path, 'todas fijadas'));
end $$;

do $$ declare auth_cfg text[]; anon_cfg text[]; begin
  select rolconfig into auth_cfg from pg_roles where rolname = 'authenticated';
  select rolconfig into anon_cfg from pg_roles where rolname = 'anon';
  insert into resultados values ('C2 statement_timeout por rol',
    'statement_timeout=8s' = any(auth_cfg) and 'statement_timeout=3s' = any(anon_cfg),
    'authenticated ' || coalesce(auth_cfg::text, '{}') || ' / anon ' || coalesce(anon_cfg::text, '{}'));
end $$;

do $$ declare b record; begin
  select * into b from storage.buckets where id = 'facturas';
  insert into resultados values ('C3 bucket facturas privado, 10 MB, solo PDF/imágenes',
    not b.public and b.file_size_limit = 10485760 and 'application/pdf' = any(b.allowed_mime_types) and not ('text/html' = any(b.allowed_mime_types)),
    b.file_size_limit || ' bytes, ' || array_to_string(b.allowed_mime_types, ','));
end $$;

-- Timeout real: una consulta que pasa del límite se cancela.
begin;
set local statement_timeout = '1s';
do $$ begin
  perform pg_sleep(3);
  insert into resultados values ('C4 consulta lenta se cancela por timeout', false, 'no se canceló');
exception when query_canceled then
  insert into resultados values ('C4 consulta lenta se cancela por timeout', true, sqlerrm);
end $$;
commit;

-- ---------------------------------------------------------------------
select case when ok then 'PASS' else 'FAIL' end as estado, prueba, detalle from resultados order by prueba;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from resultados;
