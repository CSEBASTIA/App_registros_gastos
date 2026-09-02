-- Diners Club Ecuador es un emisor de tarjetas aparte (no un producto de
-- Banco Guayaquil), así que se agrega como valor propio de `banco` en
-- cuentas, para poder tener su catálogo de diseños de tarjeta igual que
-- Banco Guayaquil.

alter table cuentas drop constraint if exists cuentas_banco_check;
alter table cuentas
  add constraint cuentas_banco_check
  check (banco in ('banco_guayaquil', 'pichincha', 'produbanco', 'diners_club', 'otro'));
