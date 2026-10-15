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
