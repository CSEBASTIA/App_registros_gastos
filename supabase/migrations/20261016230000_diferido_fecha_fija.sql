-- Migración de fecha fija en diferidos.
--
-- Al editar gastos desde el teléfono: un diferido ya no puede cambiar de
-- fecha. Su deuda empieza ese día y sus recordatorios de cuotas caen ese día
-- de cada mes; moverlo dejaría la deuda y los recordatorios con otra fecha.
-- Igual que con el monto, la tarjeta, el método y el plazo: se elimina y se
-- registra de nuevo. Descripción y categoría se siguen pudiendo cambiar.
--
-- Igual que en 20261014130000_saldos_confiables, más la fecha.
-- Sin SQL dinámico.

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
    or new.fecha is distinct from old.fecha
    -- Soltar la cuenta (null) sí se permite: es lo que hace la base cuando
    -- se borra la tarjeta (ON DELETE SET NULL). Cambiarla por otra, no.
    or (new.cuenta_id is not null and new.cuenta_id is distinct from old.cuenta_id)
  ) then
    raise exception 'Un gasto diferido no se puede editar en monto, cuenta, método de pago, plazo o fecha: elimínalo y regístralo de nuevo.'
      using errcode = '22023';
  end if;

  if new.metodo_pago = 'diferido' and old.metodo_pago is distinct from 'diferido' then
    raise exception 'Un gasto no se puede convertir en diferido al editarlo: regístralo de nuevo como diferido.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
