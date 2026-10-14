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
