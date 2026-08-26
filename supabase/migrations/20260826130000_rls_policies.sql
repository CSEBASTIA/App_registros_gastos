-- La migración anterior activó RLS en las 3 tablas pero no creó policies,
-- lo que en la práctica bloqueaba todo select/insert/delete desde el
-- cliente (anon/authenticated). Esta migración:
--   1) agrega el dueño de cada gasto/presupuesto (usuario_id), para
--      poder aislar los datos por usuario autenticado.
--   2) crea las policies necesarias para que la app funcione.

alter table gastos
  add column if not exists usuario_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

alter table presupuestos
  add column if not exists usuario_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

-- Categorías: catálogo compartido, de solo lectura para la app.
-- Se administra desde el backend (service_role / seed), por eso no
-- tiene policies de insert/update/delete.
create policy "categorias: lectura para autenticados"
  on categorias for select
  to authenticated
  using (true);

-- Gastos: cada usuario ve y modifica únicamente los suyos.
create policy "gastos: select propio"
  on gastos for select
  to authenticated
  using (auth.uid() = usuario_id);

create policy "gastos: insert propio"
  on gastos for insert
  to authenticated
  with check (auth.uid() = usuario_id);

create policy "gastos: update propio"
  on gastos for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "gastos: delete propio"
  on gastos for delete
  to authenticated
  using (auth.uid() = usuario_id);

-- Presupuestos: mismo criterio que gastos.
create policy "presupuestos: select propio"
  on presupuestos for select
  to authenticated
  using (auth.uid() = usuario_id);

create policy "presupuestos: insert propio"
  on presupuestos for insert
  to authenticated
  with check (auth.uid() = usuario_id);

create policy "presupuestos: update propio"
  on presupuestos for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "presupuestos: delete propio"
  on presupuestos for delete
  to authenticated
  using (auth.uid() = usuario_id);
