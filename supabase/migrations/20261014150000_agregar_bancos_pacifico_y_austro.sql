-- Permite guardar cuentas y tarjetas de Banco del Pacífico y Banco del Austro.
alter table cuentas drop constraint if exists cuentas_banco_check;
alter table cuentas
  add constraint cuentas_banco_check
  check (banco in (
    'banco_guayaquil',
    'pichincha',
    'produbanco',
    'diners_club',
    'banco_pacifico',
    'banco_austro',
    'otro'
  ));
