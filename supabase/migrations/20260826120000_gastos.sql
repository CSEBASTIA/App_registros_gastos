create extension if not exists "pgcrypto";

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  color text not null default '#999999'
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  monto numeric(12, 2) not null check (monto > 0),
  descripcion text not null,
  categoria_id uuid references categorias(id),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id),
  monto_limite numeric(12, 2) not null,
  mes text not null
);

alter table categorias enable row level security;
alter table gastos enable row level security;
alter table presupuestos enable row level security;
