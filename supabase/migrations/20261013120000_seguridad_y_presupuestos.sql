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
