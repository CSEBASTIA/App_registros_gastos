#!/usr/bin/env bash
# Genera supabase/base-completa.sql: TODAS las migraciones en orden + seed.sql
# en un solo archivo, para crear la base entera en un proyecto de Supabase
# nuevo pegándolo en el SQL Editor. Volver a correrlo cada vez que se agregue
# una migración (el archivo generado no se edita a mano).
#
# Uso (desde la raíz del repo):
#   bash supabase/generar-base-completa.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SALIDA="$DIR/base-completa.sql"
MIGRACIONES=("$DIR"/migrations/*.sql)

{
  cat <<EOF
-- =====================================================================
-- gastos-app — BASE DE DATOS COMPLETA
-- Generado por supabase/generar-base-completa.sh el $(date +%Y-%m-%d) con las
-- ${#MIGRACIONES[@]} migraciones de supabase/migrations + seed.sql. No editar a mano.
--
-- Cómo usarlo en Supabase (web):
--   1. Proyecto nuevo → SQL Editor → New query.
--   2. Pegar TODO este archivo y pulsar Run.
--   3. Debe terminar mostrando "migraciones_registradas = ${#MIGRACIONES[@]}".
--
-- Es para un proyecto VACÍO. Corre en una sola transacción: si algo falla
-- (por ejemplo, si la base ya existía), se detiene sin cambiar nada.
-- Al final marca las migraciones como aplicadas, para que
-- \`supabase db push\` no las repita.
-- No contiene datos de ninguna persona: solo estructura, reglas, seguridad
-- (RLS) y las categorías globales.
-- =====================================================================

begin;

EOF

  for f in "${MIGRACIONES[@]}"; do
    printf -- '-- >>> %s\n' "$(basename "$f")"
    sed 's/\r$//' "$f"
    printf '\n\n'
  done

  printf -- '-- >>> seed.sql (categorías globales)\n'
  sed 's/\r$//' "$DIR/seed.sql"
  printf '\n\n'

  cat <<'EOF'
-- >>> Registro de migraciones (lo mismo que crea la CLI de Supabase)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
insert into supabase_migrations.schema_migrations (version, name) values
EOF

  primero=1
  for f in "${MIGRACIONES[@]}"; do
    base="$(basename "$f" .sql)"
    [ "$primero" = 1 ] && primero=0 || printf ',\n'
    printf "  ('%s', '%s')" "${base%%_*}" "${base#*_}"
  done
  printf '\non conflict (version) do nothing;\n\ncommit;\n\n'
  printf 'select count(*) as migraciones_registradas from supabase_migrations.schema_migrations;\n'
} > "$SALIDA"

echo "generado $SALIDA (${#MIGRACIONES[@]} migraciones, $(wc -l < "$SALIDA") líneas)"
