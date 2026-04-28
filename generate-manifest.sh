#!/bin/bash
# =============================================================
# Spec-Driven Development — Manifest Generator
#
# Calcula SHA-256 de cada archivo listado en FILES (install-bootstrap.sh)
# y produce bootstrap-manifest.json. Correr este script desde la raíz
# del repo antes de cada release/push de cambios.
#
# Uso:
#   ./generate-manifest.sh
#
# Output:
#   bootstrap-manifest.json (commitear al repo)
# =============================================================
set -e

cd "$(dirname "$0")"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq es requerido para generar el manifest"
  exit 1
fi

if ! command -v shasum >/dev/null 2>&1; then
  echo "❌ shasum es requerido para generar el manifest"
  exit 1
fi

# Extraer lista de paths del repo desde el array FILES de install-bootstrap.sh.
# El parser busca líneas tipo: '  "src_path|dst_path"' dentro del bloque FILES=( ... ).
FILES_LIST=()
while IFS= read -r line; do
  ENTRY=$(echo "$line" | sed -E 's/^[[:space:]]*"([^"]+)".*$/\1/')
  REPO_PATH="${ENTRY%%|*}"
  [ -z "$REPO_PATH" ] && continue
  if [ -f "$REPO_PATH" ]; then
    FILES_LIST+=("$REPO_PATH")
  else
    echo "⚠️  Listado en FILES pero no existe en disco: $REPO_PATH" >&2
  fi
done < <(awk '/^FILES=\(/,/^\)/' install-bootstrap.sh | grep -E '^[[:space:]]*"[^"]+"')

if [ "${#FILES_LIST[@]}" -eq 0 ]; then
  echo "❌ No se pudo extraer la lista de archivos de install-bootstrap.sh"
  exit 1
fi

# Construir el objeto JSON {path: sha256}
JSON='{}'
for f in "${FILES_LIST[@]}"; do
  HASH=$(shasum -a 256 "$f" | awk '{print $1}')
  JSON=$(echo "$JSON" | jq --arg k "$f" --arg v "$HASH" '. + {($k): $v}')
done

# Detectar versión del bootstrap del propio script
VERSION=$(grep -oE 'Bootstrap V[0-9]+\.[0-9]+' install-bootstrap.sh | head -1 | sed 's/^Bootstrap V//')
[ -z "$VERSION" ] && VERSION="unknown"

jq -n \
  --arg version "$VERSION" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson files "$JSON" \
  '{version: $version, generated_at: $ts, files: $files}' > bootstrap-manifest.json

echo "✅ bootstrap-manifest.json generado"
echo "   versión: $VERSION"
echo "   archivos: ${#FILES_LIST[@]}"
echo "   timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
