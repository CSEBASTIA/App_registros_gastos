-- Categoría global de gasto para consumos médicos detectados en estados de cuenta.
insert into categorias (nombre, color, tipo)
select 'Salud', '#ef4444', 'gasto'
where not exists (
  select 1 from categorias where nombre = 'Salud' and tipo = 'gasto' and usuario_id is null
);
