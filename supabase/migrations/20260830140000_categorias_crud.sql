-- Categorías pasa de "catálogo compartido de solo lectura" a poder
-- administrarse por el usuario (CRUD completo):
--   - `tipo`: separa categorías de gasto vs. de ingreso, para no
--     mezclarlas en los selectores de cada formulario.
--   - `usuario_id` (nullable): NULL = categoría global/compartida (las 4
--     que ya existían siguen así, visibles para todos); con dueño = la
--     creó ese usuario, y solo él la ve/edita/borra.
--   - políticas de insert/update/delete, que hoy no existían (por eso el
--     CRUD estaba bloqueado a nivel de base de datos).
--
-- También se agrega el soporte para "Otros + detalle": una categoría
-- "Otros" (una por tipo) y una columna `categoria_detalle` en gastos e
-- ingresos para guardar el texto libre que el usuario escribe al elegirla.
-- Ingresos además gana `categoria_id` (hoy no tenía ninguna).

alter table categorias add column if not exists tipo text not null default 'gasto' check (tipo in ('gasto', 'ingreso'));
alter table categorias add column if not exists usuario_id uuid references auth.users(id) on delete cascade;

alter table gastos add column if not exists categoria_detalle text;
alter table ingresos add column if not exists categoria_id uuid references categorias(id);
alter table ingresos add column if not exists categoria_detalle text;

-- Semilla: "Otros" por tipo (si no existe ya) + un par de categorías de
-- ingreso básicas, para que el selector de Ingresos no arranque vacío.
insert into categorias (nombre, color, tipo)
select 'Otros', '#6b7280', 'gasto'
where not exists (select 1 from categorias where nombre = 'Otros' and tipo = 'gasto');

insert into categorias (nombre, color, tipo)
select v.nombre, v.color, 'ingreso'
from (values
  ('Sueldo', '#16a34a'),
  ('Freelance', '#0891b2'),
  ('Regalo', '#db2777'),
  ('Otros', '#6b7280')
) as v(nombre, color)
where not exists (select 1 from categorias c where c.nombre = v.nombre and c.tipo = 'ingreso');

-- Reemplaza la policy de solo-lectura por una que también deja ver las
-- categorías propias (además de las globales).
drop policy if exists "categorias: lectura para autenticados" on categorias;

create policy "categorias: select propias o globales"
  on categorias for select
  to authenticated
  using (usuario_id is null or usuario_id = auth.uid());

create policy "categorias: insert propia"
  on categorias for insert
  to authenticated
  with check (usuario_id = auth.uid());

create policy "categorias: update propia"
  on categorias for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "categorias: delete propia"
  on categorias for delete
  to authenticated
  using (usuario_id = auth.uid());
