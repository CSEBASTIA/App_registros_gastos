#!/usr/bin/env bash
# Prepara una o varias migraciones para pegarlas en el SQL Editor de Supabase
# (web), con un nombre legible. Junta los archivos en orden, en una sola
# transacción, y los marca como aplicados (para que `supabase db push` no
# los repita).
#
# Uso (desde la raíz del repo):
#   bash supabase/preparar-migracion-web.sh "Migración de interés diferido" 20261015170000 20261015180000
# Crea: supabase/para-supabase-web/migracion-de-interes-diferido.sql
set -euo pipefail

TITULO="$1"; shift
DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR/para-supabase-web"
# Nombre de archivo sin tildes ("Migración de interés" → "migracion-de-interes").
NOMBRE="$(echo "$TITULO" | sed 's/á/a/g; s/Á/a/g; s/é/e/g; s/É/e/g; s/í/i/g; s/Í/i/g; s/ó/o/g; s/Ó/o/g; s/ú/u/g; s/Ú/u/g; s/ü/u/g; s/ñ/n/g; s/Ñ/n/g' | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g')"
SALIDA="$DIR/para-supabase-web/$NOMBRE.sql"

ARCHIVOS=()
for version in "$@"; do
  f=$(ls "$DIR"/migrations/"$version"_*.sql 2>/dev/null | head -1)
  [ -n "$f" ] || { echo "No existe la migración $version" >&2; exit 1; }
  ARCHIVOS+=("$f")
done

{
  cat <<EOF
-- =====================================================================
-- gastos-app — ${TITULO}
-- Para un proyecto que ya tiene la base anterior. Incluye ${#ARCHIVOS[@]} archivo(s):
EOF
  for f in "${ARCHIVOS[@]}"; do printf -- '--   - %s\n' "$(basename "$f")"; done
  cat <<EOF
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Debe terminar mostrando "aplicada = sí". Corre en una sola transacción:
-- si algo falla, no cambia nada. Generado por preparar-migracion-web.sh.
-- =====================================================================

begin;

EOF
  for f in "${ARCHIVOS[@]}"; do
    printf -- '-- >>> %s\n' "$(basename "$f")"
    sed 's/\r$//' "$f"
    printf '\n\n'
  done
  printf -- '-- >>> Registro de migraciones\ninsert into supabase_migrations.schema_migrations (version, name) values\n'
  primero=1
  for f in "${ARCHIVOS[@]}"; do
    base="$(basename "$f" .sql)"
    [ "$primero" = 1 ] && primero=0 || printf ',\n'
    printf "  ('%s', '%s')" "${base%%_*}" "${base#*_}"
  done
  printf '\non conflict (version) do nothing;\n\ncommit;\n\n'
  ultima="$(basename "${ARCHIVOS[-1]}" .sql)"
  printf "select case when exists (select 1 from supabase_migrations.schema_migrations where version = '%s') then 'sí' else 'no' end as aplicada;\n" "${ultima%%_*}"
} > "$SALIDA"

echo "generado $SALIDA"
