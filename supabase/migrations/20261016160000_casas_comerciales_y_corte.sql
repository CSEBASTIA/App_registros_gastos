-- Migración de casas comerciales y fecha de corte (fases A y B del plan de
-- cuentas, avisos y resumen).
--
-- 1) Casas comerciales y créditos directos (Comandato, Artefacta, Marcimex,
--    La Ganga, Japón, De Prati, Créditos Económicos u otra): se guardan como
--    una tarjeta de crédito (`tipo = 'credito'`, con cupo). Así las compras a
--    cuotas usan el diferido que ya existe, con su deuda, su cupo y su interés.
-- 2) Día de corte y día máximo de pago de una tarjeta (1-31; en meses más
--    cortos, el último día). Solo para crédito.

alter table public.cuentas drop constraint if exists cuentas_banco_check;
alter table public.cuentas
  add constraint cuentas_banco_check
  check (banco in (
    'banco_guayaquil',
    'pichincha',
    'produbanco',
    'diners_club',
    'banco_pacifico',
    'banco_austro',
    'otro',
    'comandato',
    'artefacta',
    'marcimex',
    'la_ganga',
    'japon',
    'de_prati',
    'creditos_economicos',
    'otra_casa_comercial'
  ));

-- Una casa comercial da crédito: no hay "cuenta de ahorros de Comandato".
alter table public.cuentas drop constraint if exists cuentas_casa_comercial_es_credito;
alter table public.cuentas
  add constraint cuentas_casa_comercial_es_credito
  check (
    tipo = 'credito'
    or banco not in ('comandato', 'artefacta', 'marcimex', 'la_ganga', 'japon', 'de_prati', 'creditos_economicos', 'otra_casa_comercial')
  );

alter table public.cuentas
  add column if not exists dia_corte smallint,
  add column if not exists dia_pago smallint;

alter table public.cuentas drop constraint if exists cuentas_fechas_tarjeta_validas;
alter table public.cuentas
  add constraint cuentas_fechas_tarjeta_validas
  check (
    (dia_corte is null or dia_corte between 1 and 31)
    and (dia_pago is null or dia_pago between 1 and 31)
    and (tipo = 'credito' or (dia_corte is null and dia_pago is null))
  );

notify pgrst, 'reload schema';
