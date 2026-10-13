#!/usr/bin/env bash
# Corre las pruebas de base de datos sobre un Postgres DESECHABLE (nunca
# sobre tu Supabase local ni el de producción):
#   1. levanta un contenedor con la misma imagen de Postgres de Supabase,
#   2. crea lo mínimo de `storage` y el `auth.uid()` de GoTrue (en el stack
#      real los crean storage-api y GoTrue),
#   3. aplica TODAS las migraciones en orden + seed,
#   4. corre tests/seguridad_y_presupuestos.sql y borra el contenedor.
#
# Uso (desde la raíz del repo, con Docker abierto):
#   bash supabase/tests/correr.sh
set -euo pipefail

IMAGEN="public.ecr.aws/supabase/postgres:17.11.0.004"
NOMBRE="gastos-pruebas-$$"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

trap 'docker rm -f "$NOMBRE" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NOMBRE" -e POSTGRES_PASSWORD=postgres "$IMAGEN" >/dev/null
until docker exec "$NOMBRE" pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 2; done
sleep 8 # la imagen corre sus scripts de inicio después del primer "ready"

docker exec -i "$NOMBRE" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -q <<'SQL'
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $f$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
grant usage on schema storage to postgres, authenticated, anon;
create or replace function auth.uid() returns uuid language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
SQL

for f in "$DIR"/migrations/*.sql "$DIR"/seed.sql; do
  echo "aplicando $(basename "$f")"
  docker exec -i "$NOMBRE" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -q < "$f"
done

docker exec -i "$NOMBRE" psql -U supabase_admin -d postgres -q -P pager=off \
  < "$DIR/tests/seguridad_y_presupuestos.sql" | grep -E "PASS|FAIL|pasan|^ +[0-9]+ \|"
