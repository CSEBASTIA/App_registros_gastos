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
