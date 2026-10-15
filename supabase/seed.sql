-- Categorías globales de gasto. Se puede correr más de una vez sin duplicar
-- (va también dentro de base-completa.sql).
insert into categorias (nombre, color)
select v.nombre, v.color
from (values
  ('Comida', '#f97316'),
  ('Transporte', '#3b82f6'),
  ('Ocio', '#a855f7'),
  ('Servicios', '#22c55e')
) as v(nombre, color)
where not exists (
  select 1 from categorias c where c.nombre = v.nombre and c.usuario_id is null and c.tipo = 'gasto'
);
