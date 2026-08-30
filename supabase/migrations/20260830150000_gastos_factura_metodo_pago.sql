-- Gastos gana "método de pago" y factura adjunta (PDF o imagen, en
-- Supabase Storage). Se guarda solo la RUTA dentro del bucket
-- (`factura_path`), no una URL pública — el bucket es privado y la app
-- pide una signed URL al momento de abrir/descargar el archivo.

alter table gastos add column if not exists metodo_pago text
  check (metodo_pago is null or metodo_pago in ('efectivo', 'debito', 'credito', 'transferencia', 'otro'));
alter table gastos add column if not exists factura_path text;

-- Los triggers de finanzas_completas solo ajustan `cuentas.disponible` en
-- INSERT/DELETE de gastos. Ahora que un gasto se puede editar (monto o
-- cuenta), hace falta el mismo ajuste en UPDATE: revierte el efecto del
-- monto/cuenta viejos y aplica el nuevo, para que el cupo no quede
-- desincronizado al corregir un gasto.
create or replace function ajustar_gasto_actualizado()
returns trigger as $$
begin
  if old.cuenta_id is not null then
    update cuentas
    set disponible = case
      when cupo_total is not null then least(cupo_total, disponible + old.monto)
      else disponible + old.monto
    end
    where id = old.cuenta_id;
  end if;
  if new.cuenta_id is not null then
    update cuentas set disponible = disponible - new.monto where id = new.cuenta_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ajustar_gasto_actualizado on gastos;
create trigger trg_ajustar_gasto_actualizado
  after update of monto, cuenta_id on gastos
  for each row execute function ajustar_gasto_actualizado();

-- Bucket privado para facturas. Cada archivo vive en
-- "<usuario_id>/<archivo>" dentro del bucket, y las policies de abajo
-- usan ese primer segmento de la ruta para que cada quien solo pueda
-- subir/ver/borrar lo suyo.
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

drop policy if exists "facturas: select propio" on storage.objects;
create policy "facturas: select propio"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "facturas: insert propio" on storage.objects;
create policy "facturas: insert propio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "facturas: delete propio" on storage.objects;
create policy "facturas: delete propio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);
