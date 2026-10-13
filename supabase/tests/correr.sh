#!/usr/bin/env bash
# Corre las pruebas de base de datos sobre un Postgres DESECHABLE (nunca
# sobre tu Supabase local ni el de producción):
#   1. levanta un contenedor con la misma imagen de Postgres de Supabase,
#   2. crea lo mínimo de `storage` y el `auth.uid()` de GoTrue (en el stack
#      real los crean storage-api y GoTrue),
#   3. aplica TODAS las migraciones en orden + seed,
#   4. corre todos los tests/*.sql y la prueba de concurrencia, y borra el
#      contenedor.
#
# Uso (desde la raíz del repo, con Docker abierto):
#   bash supabase/tests/correr.sh
set -euo pipefail

IMAGEN="public.ecr.aws/supabase/postgres:17.11.0.004"
NOMBRE="gastos-pruebas-$$"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

trap 'docker rm -f "$NOMBRE" >/dev/null 2>&1 || true' EXIT

psql_admin() { docker exec -i "$NOMBRE" psql -U supabase_admin -d postgres "$@"; }

docker run -d --name "$NOMBRE" -e POSTGRES_PASSWORD=postgres "$IMAGEN" >/dev/null
until docker exec "$NOMBRE" pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 2; done
sleep 8 # la imagen corre sus scripts de inicio después del primer "ready"

psql_admin -v ON_ERROR_STOP=1 -q <<'SQL'
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

for prueba in "$DIR"/tests/*.sql; do
  echo "== $(basename "$prueba")"
  psql_admin -q -P pager=off < "$prueba" | grep -E "PASS|FAIL|pasan|^ +[0-9]+ \|"
done

# Concurrencia: dos abonos de 70 a la vez sobre una deuda de 100. Con el
# bloqueo de fila, el segundo espera al primero y se recorta a 30: la deuda
# queda en 0 y la cuenta pierde exactamente 100 (no 140).
echo "== concurrencia (dos sesiones simultáneas)"
psql_admin -q -v ON_ERROR_STOP=1 <<'SQL'
insert into cuentas (id, usuario_id, nombre, tipo, disponible)
  values ('c1000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'Ahorro concurrencia', 'ahorro', 1000);
insert into deudas (id, usuario_id, nombre, tipo, monto_total, saldo_pendiente, cuota_mensual)
  values ('c3000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'Concurrencia', 'otro', 100, 100, 0);
SQL

abonar() {
  psql_admin -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select registrar_abono_deuda('c3000000-0000-4000-8000-000000000009', 70, 'c1000000-0000-4000-8000-000000000009');
select pg_sleep(2);
commit;
SQL
}
abonar & abonar & wait

psql_admin -tA <<'SQL'
select case when d.saldo_pendiente = 0 and c.disponible = 900 and s.total = 100 then 'PASS' else 'FAIL' end
  || ' | C1 dos abonos simultáneos no se pisan | saldo ' || d.saldo_pendiente
  || ', ahorro ' || c.disponible || ', abonado ' || s.total
from deudas d, cuentas c,
  (select sum(monto) as total from abonos_deuda where deuda_id = 'c3000000-0000-4000-8000-000000000009') s
where d.id = 'c3000000-0000-4000-8000-000000000009' and c.id = 'c1000000-0000-4000-8000-000000000009';
SQL
