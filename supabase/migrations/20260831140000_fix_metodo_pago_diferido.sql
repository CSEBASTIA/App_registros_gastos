-- Bug: la migración que agregó "diferido" como método de pago (gasto
-- diferido) nunca actualizó el check constraint de `gastos.metodo_pago`,
-- que seguía sin incluir ese valor — todo gasto diferido fallaba al
-- guardarse. Detectado probando la app con datos reales.

alter table gastos drop constraint if exists gastos_metodo_pago_check;
alter table gastos
  add constraint gastos_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('efectivo', 'debito', 'credito', 'transferencia', 'diferido', 'otro'));
