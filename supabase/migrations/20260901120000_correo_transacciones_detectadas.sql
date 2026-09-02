-- Detección automática de gastos/ingresos desde el correo (mobile): un
-- lector de avisos bancarios en Outlook deja lo que encuentra acá, en una
-- cola de revisión — nada se guarda como gasto/ingreso real hasta que el
-- usuario lo confirma desde la app (que en ese momento llama a los mismos
-- crearGasto/crearIngreso de siempre; no hace falta ningún trigger nuevo).

alter table cuentas add column if not exists identificador text;

create table if not exists transacciones_detectadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- id del mensaje en el proveedor de correo: evita procesar el mismo aviso dos veces.
  mensaje_id text not null,
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  monto numeric(12, 2) not null check (monto > 0),
  descripcion text not null,
  -- null = no se pudo identificar el banco del remitente.
  banco text,
  -- null = no se pudo desambiguar la cuenta (ej. dos cuentas del mismo banco); el usuario la elige al revisar.
  cuenta_id uuid references cuentas(id) on delete set null,
  categoria_id uuid references categorias(id) on delete set null,
  fecha date not null,
  correo_asunto text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'descartado')),
  created_at timestamptz not null default now(),
  unique (usuario_id, mensaje_id)
);

alter table transacciones_detectadas enable row level security;

create policy "transacciones_detectadas: select propio" on transacciones_detectadas
  for select to authenticated using (auth.uid() = usuario_id);
create policy "transacciones_detectadas: insert propio" on transacciones_detectadas
  for insert to authenticated with check (auth.uid() = usuario_id);
create policy "transacciones_detectadas: update propio" on transacciones_detectadas
  for update to authenticated using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "transacciones_detectadas: delete propio" on transacciones_detectadas
  for delete to authenticated using (auth.uid() = usuario_id);
