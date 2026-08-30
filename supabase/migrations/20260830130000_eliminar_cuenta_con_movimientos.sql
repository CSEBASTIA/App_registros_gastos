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
