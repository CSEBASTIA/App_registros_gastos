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
