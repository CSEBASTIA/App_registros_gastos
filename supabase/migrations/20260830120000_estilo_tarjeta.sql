-- Agrega el "estilo" de tarjeta: el id del producto específico dentro del
-- catálogo de diseños (ej. "visa-oro-lifemiles", "amex-platinum-metal"),
-- que la UI de desktop usa para mostrar la imagen real de la tarjeta.
-- `banco`/`marca` siguen existiendo para el degradado de respaldo cuando
-- no hay estilo (débito/ahorro/efectivo, o un producto fuera de catálogo).

alter table cuentas add column if not exists estilo text;
