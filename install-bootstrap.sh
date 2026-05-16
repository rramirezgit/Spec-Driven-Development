#!/bin/bash
set -e

# =============================================================
# Spec-Driven Development — Bootstrap Installer
# Repo: github.com/rramirezgit/Spec-Driven-Development (privado)
# =============================================================

REPO="rramirezgit/Spec-Driven-Development"
BRANCH="main"

# Formato: "ruta_en_repo|ruta_destino_local"
FILES=(
  "phase-0-detect.md|.ai-internal/phases/phase-0-detect.md"
  "phase-0a-mcps-tracker.md|.ai-internal/phases/phase-0a-mcps-tracker.md"
  "phase-0b-codebase.md|.ai-internal/phases/phase-0b-codebase.md"
  "phase-0c-confirm.md|.ai-internal/phases/phase-0c-confirm.md"
  "phase-1-reusables.md|.ai-internal/phases/phase-1-reusables.md"
  "CHANGELOG.md|.ai-internal/CHANGELOG.md"
  "phase-2-adapted.md|.ai-internal/phases/phase-2-adapted.md"
  "phase-3-finalize.md|.ai-internal/phases/phase-3-finalize.md"
  "bootstrap.md|.claude/commands/bootstrap.md"
  "mcp-server/package.json|.ai-internal/mcp-server/package.json"
  "mcp-server/tsconfig.json|.ai-internal/mcp-server/tsconfig.json"
  "mcp-server/src/types.ts|.ai-internal/mcp-server/src/types.ts"
  "mcp-server/src/config.ts|.ai-internal/mcp-server/src/config.ts"
  "mcp-server/src/pipeline.ts|.ai-internal/mcp-server/src/pipeline.ts"
  "mcp-server/src/jira.ts|.ai-internal/mcp-server/src/jira.ts"
  "mcp-server/src/notion.ts|.ai-internal/mcp-server/src/notion.ts"
  "mcp-server/src/tracker.ts|.ai-internal/mcp-server/src/tracker.ts"
  "mcp-server/src/index.ts|.ai-internal/mcp-server/src/index.ts"
  "menu-template.md|.ai-internal/templates/menu-template.md"
  "enrich-ticket-template.md|.ai-internal/templates/enrich-ticket-template.md"
  "plan-ticket-template.md|.ai-internal/templates/plan-ticket-template.md"
  "create-tickets-template.md|.ai-internal/templates/create-tickets-template.md"
  "create-tickets-template-notion.md|.ai-internal/templates/create-tickets-template-notion.md"
  "doc-standards-template.mdc|.ai-internal/templates/doc-standards-template.mdc"
  "reusables/opsx/new.md|.ai-internal/reusables/opsx/new.md"
  "reusables/opsx/ff.md|.ai-internal/reusables/opsx/ff.md"
  "reusables/opsx/continue.md|.ai-internal/reusables/opsx/continue.md"
  "reusables/opsx/apply.md|.ai-internal/reusables/opsx/apply.md"
  "reusables/opsx/verify.md|.ai-internal/reusables/opsx/verify.md"
  "reusables/opsx/archive.md|.ai-internal/reusables/opsx/archive.md"
  "reusables/opsx/explore.md|.ai-internal/reusables/opsx/explore.md"
  "reusables/opsx/sync.md|.ai-internal/reusables/opsx/sync.md"
  "reusables/opsx/bulk-archive.md|.ai-internal/reusables/opsx/bulk-archive.md"
  "reusables/opsx/onboard.md|.ai-internal/reusables/opsx/onboard.md"
  "reusables/commands/explain.md|.ai-internal/reusables/commands/explain.md"
  "reusables/commands/commit.md|.ai-internal/reusables/commands/commit.md"
  "reusables/commands/review-pr.md|.ai-internal/reusables/commands/review-pr.md"
  "reusables/commands/test-plan.md|.ai-internal/reusables/commands/test-plan.md"
  "reusables/commands/evidence.md|.ai-internal/reusables/commands/evidence.md"
  "reusables/commands/generate-docs.md|.ai-internal/reusables/commands/generate-docs.md"
  "reusables/commands/update-docs.md|.ai-internal/reusables/commands/update-docs.md"
  "reusables/commands/release-to-main.md|.ai-internal/reusables/commands/release-to-main.md"
  "reusables/agents/product-strategy-analyst.md|.ai-internal/reusables/agents/product-strategy-analyst.md"
  "hooks/pre-compact-marker.sh|.ai-internal/hooks/pre-compact-marker.sh"
  "hooks/post-compact-reminder.sh|.ai-internal/hooks/post-compact-reminder.sh"
  "hooks/guard-dangerous-ops.sh|.ai-internal/hooks/guard-dangerous-ops.sh"
)

echo ""
echo "🔧 Spec-Driven Development — Bootstrap V4.18"
echo "============================================="
echo ""

# ── Prereqs ──────────────────────────────────────
ERRORS=0

if ! command -v openspec >/dev/null 2>&1; then
  echo "❌ openspec-cli no instalado"
  echo "   → npm install -g openspec-cli"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ openspec $(openspec --version 2>/dev/null)"
fi

PROJECT_DETECTED=false
# Check root-level manifests
for MANIFEST in package.json go.mod requirements.txt Cargo.toml pom.xml build.gradle composer.json pubspec.yaml Gemfile; do
  [ -f "$MANIFEST" ] && PROJECT_DETECTED=true && break
done
# Check for monorepo: manifests in immediate subdirectories
if [ "$PROJECT_DETECTED" = false ]; then
  for SUB in */; do
    for MANIFEST in package.json go.mod requirements.txt Cargo.toml pom.xml build.gradle composer.json pubspec.yaml Gemfile; do
      [ -f "${SUB}${MANIFEST}" ] && PROJECT_DETECTED=true && break 2
    done
  done
fi
# Fallback: .git/ or Makefile/Dockerfile at root
if [ "$PROJECT_DETECTED" = false ]; then
  [ -d .git ] || [ -f Makefile ] || [ -f Dockerfile ] && PROJECT_DETECTED=true
fi

if [ "$PROJECT_DETECTED" = false ]; then
  echo "❌ No parece un proyecto. Ejecutá desde la raíz."
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Proyecto: $(basename "$(pwd)")"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Corregí los errores y volvé a ejecutar."
  exit 1
fi

# ── Auth ─────────────────────────────────────────
echo ""
DOWNLOAD_METHOD=""

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    DOWNLOAD_METHOD="gh"
    echo "✅ GitHub CLI autenticado"
  else
    echo "⚠️  gh CLI instalado pero no autenticado"
  fi
fi

if [ -z "$DOWNLOAD_METHOD" ] && [ -n "$GITHUB_TOKEN" ]; then
  DOWNLOAD_METHOD="curl"
  echo "✅ Usando GITHUB_TOKEN"
fi

if [ -z "$DOWNLOAD_METHOD" ]; then
  echo "❌ Necesitás autenticación con GitHub:"
  echo ""
  echo "   Opción 1 (recomendada):"
  echo "     brew install gh"
  echo "     gh auth login"
  echo ""
  echo "   Opción 2:"
  echo "     export GITHUB_TOKEN=ghp_xxxxx"
  echo ""
  exit 1
fi

# ── Crear directorios ────────────────────────────
mkdir -p .ai-internal/phases
mkdir -p .ai-internal/mcp-server/src
mkdir -p .ai-internal/templates
mkdir -p .ai-internal/reusables/opsx
mkdir -p .ai-internal/reusables/commands
mkdir -p .ai-internal/reusables/agents
mkdir -p .ai-internal/hooks
mkdir -p .claude/commands

# Agregar .ai-internal/ a .gitignore
if [ -f .gitignore ]; then
  grep -q "^\.ai-internal/" .gitignore 2>/dev/null || echo ".ai-internal/" >> .gitignore
else
  echo ".ai-internal/" > .gitignore
fi

# ── Descargar (atomic: staging dir + commit al final) ──────────
echo ""
echo "📥 Descargando archivos..."
echo ""

# Limpiar staging dirs huérfanos de ejecuciones previas que fueron interrumpidas
# antes de poder limpiar (ej. Ctrl+C muy temprano, kernel panic, etc).
for OLD_STAGING in "${PWD}"/.bootstrap-staging.*/; do
  [ -d "$OLD_STAGING" ] || continue
  rm -rf "$OLD_STAGING"
  echo "🧹 Limpiado staging huérfano: $OLD_STAGING"
done

# Staging area: descargas van acá primero; si todo OK, se mueven al destino final.
# Si algo falla, el trap limpia y la instalación previa queda intacta.
#
# IMPORTANTE: el trap se REGISTRA antes de mktemp con un placeholder vacío, y
# luego se actualiza cuando STAGING tiene valor. Así si Ctrl+C llega entre
# mktemp y trap setup tradicional, no queda huérfano.
STAGING=""
cleanup_staging() {
  [ -n "$STAGING" ] && [ -d "$STAGING" ] && rm -rf "$STAGING"
}
trap cleanup_staging EXIT INT TERM
STAGING=$(mktemp -d "${PWD}/.bootstrap-staging.XXXXXX")

# ── Descargar manifest primero (defensa contra MITM y corrupción de transit) ──
# El manifest contiene SHA-256 esperado de cada archivo. Si falta, seguimos
# en modo "best effort" (compatibilidad con repos pre-V4.9 sin manifest).
MANIFEST_AVAILABLE=false
MANIFEST_FILE="$STAGING/.bootstrap-manifest.json"
echo "  ⏳ bootstrap-manifest.json..."
if [ "$DOWNLOAD_METHOD" = "gh" ]; then
  gh api "repos/${REPO}/contents/bootstrap-manifest.json" \
    -H "Accept: application/vnd.github.raw+json" \
    --method GET 2>/dev/null > "$MANIFEST_FILE" \
    && MANIFEST_AVAILABLE=true || true
else
  curl -sSf -o "$MANIFEST_FILE" \
    -H "Authorization: token $GITHUB_TOKEN" \
    "https://raw.githubusercontent.com/${REPO}/${BRANCH}/bootstrap-manifest.json" 2>/dev/null \
    && MANIFEST_AVAILABLE=true || true
fi

if [ "$MANIFEST_AVAILABLE" = "true" ] && command -v jq >/dev/null 2>&1; then
  MANIFEST_VERSION=$(jq -r '.version // "unknown"' "$MANIFEST_FILE" 2>/dev/null)
  MANIFEST_COUNT=$(jq -r '.files | length' "$MANIFEST_FILE" 2>/dev/null)
  echo "  ✅ Manifest cargado (versión $MANIFEST_VERSION, $MANIFEST_COUNT archivos con hash)"
else
  echo "  ⚠️  Manifest no disponible — se continúa sin verificación de hash"
  MANIFEST_AVAILABLE=false
fi

DOWNLOADED=0
FAILED=0
HASH_MISMATCHES=0

for ENTRY in "${FILES[@]}"; do
  REPO_PATH="${ENTRY%%|*}"
  DEST="${ENTRY##*|}"
  FILENAME=$(basename "$REPO_PATH")

  # Sandbox check: DEST must be relative, must not contain ".." segments,
  # and must stay within the project directory. Rejects path traversal.
  case "$DEST" in
    /*|*..*)
      printf "  ❌ %-28s — ruta inválida (path traversal): %s\n" "$FILENAME" "$DEST"
      FAILED=$((FAILED + 1))
      continue
      ;;
  esac

  STAGED="$STAGING/$DEST"
  mkdir -p "$(dirname "$STAGED")"

  printf "  ⏳ %s..." "$FILENAME"

  DL_ERROR=""
  HTTP_STATUS=""

  # Descargar DIRECTO al archivo de staging — nunca a una variable.
  # Bash command substitution strip trailing newlines, lo que rompe el SHA-256
  # respecto al archivo original en el repo.
  if [ "$DOWNLOAD_METHOD" = "gh" ]; then
    if ! gh api "repos/${REPO}/contents/${REPO_PATH}" \
         -H "Accept: application/vnd.github.raw+json" \
         --method GET > "$STAGED" 2>/dev/null; then
      DL_ERROR="gh api failed"
    fi
  else
    HTTP_STATUS=$(curl -sS -o "$STAGED" -w "%{http_code}" \
      -H "Authorization: token $GITHUB_TOKEN" \
      "https://raw.githubusercontent.com/${REPO}/${BRANCH}/${REPO_PATH}" 2>/dev/null) \
      || DL_ERROR="curl failed"
    if [ -z "$DL_ERROR" ] && [ "$HTTP_STATUS" != "200" ]; then
      DL_ERROR="HTTP $HTTP_STATUS"
    fi
  fi

  # Validar leyendo del archivo en disco (no via variable, que strip newlines).
  if [ -z "$DL_ERROR" ] && [ -s "$STAGED" ]; then
    FILE_BYTES=$(wc -c < "$STAGED" | tr -d ' ')
    HEAD_BLOB=$(head -c 1024 "$STAGED" 2>/dev/null)
    IS_HTML_ERROR=false
    IS_API_ERROR=false
    if [ "$FILE_BYTES" -lt 50 ]; then
      DL_ERROR="contenido demasiado corto ($FILE_BYTES bytes)"
    elif printf '%s' "$HEAD_BLOB" | head -c 200 | grep -qi '<!doctype\|<html'; then
      IS_HTML_ERROR=true
      DL_ERROR="recibido HTML (probable página de error)"
    elif printf '%s' "$HEAD_BLOB" | grep -q '"documentation_url"'; then
      IS_API_ERROR=true
      DL_ERROR="recibido GitHub API error JSON"
    fi
  elif [ -z "$DL_ERROR" ]; then
    DL_ERROR="archivo vacío o no creado"
  fi

  if [ -z "$DL_ERROR" ]; then
    # Verificar SHA-256 contra manifest (si disponible)
    HASH_OK=true
    if [ "$MANIFEST_AVAILABLE" = "true" ] && command -v jq >/dev/null 2>&1 && command -v shasum >/dev/null 2>&1; then
      EXPECTED_HASH=$(jq -r --arg k "$REPO_PATH" '.files[$k] // empty' "$MANIFEST_FILE" 2>/dev/null)
      if [ -n "$EXPECTED_HASH" ]; then
        ACTUAL_HASH=$(shasum -a 256 "$STAGED" | awk '{print $1}')
        if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
          HASH_OK=false
          printf "\r  ❌ %-28s — hash mismatch\n" "$FILENAME"
          echo "     Esperado: $EXPECTED_HASH"
          echo "     Recibido: $ACTUAL_HASH"
          rm -f "$STAGED"
          HASH_MISMATCHES=$((HASH_MISMATCHES + 1))
          FAILED=$((FAILED + 1))
        fi
      fi
    fi

    if [ "$HASH_OK" = "true" ]; then
      LINES=$(wc -l < "$STAGED" | tr -d ' ')
      printf "\r  ✅ %-28s → %s (%s líneas)\n" "$FILENAME" "$DEST" "$LINES"
      DOWNLOADED=$((DOWNLOADED + 1))
    fi
  else
    printf "\r  ❌ %-28s — falló\n" "$FILENAME"
    if [ -n "$DL_ERROR" ]; then
      echo "     Error: $(echo "$DL_ERROR" | head -2)"
    fi
    rm -f "$STAGED"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️  $FAILED archivos fallaron."
  if [ "$HASH_MISMATCHES" -gt 0 ]; then
    echo "   $HASH_MISMATCHES de ellos por hash mismatch (contenido descargado no coincide con manifest)."
    echo "   Esto puede indicar: (a) MITM/proxy modificando contenido, (b) repo en estado inconsistente,"
    echo "   (c) manifest desactualizado respecto al branch. Reportar al mantenedor."
  fi
  echo "   Instalación abortada — la versión previa queda intacta (staging descartado)."
  echo ""
  echo "   Debug: gh api repos/${REPO}/contents --jq '.[].path'"
  echo ""
  exit 1
fi

# ── Commit atomic: mover archivos del staging a sus destinos finales ────
# A esta altura todas las descargas tuvieron éxito. Se promueven en bloque.
echo "📦 Promoviendo archivos del staging a su destino final..."
PROMOTED=0
PROMOTE_FAILED=0
for ENTRY in "${FILES[@]}"; do
  DEST="${ENTRY##*|}"
  STAGED="$STAGING/$DEST"
  if [ ! -f "$STAGED" ]; then
    # Defensive: si por alguna razón no quedó staged, abortamos.
    echo "  ❌ Falta en staging: $DEST"
    PROMOTE_FAILED=$((PROMOTE_FAILED + 1))
    continue
  fi
  mkdir -p "$(dirname "$DEST")"
  if mv -f "$STAGED" "$DEST"; then
    PROMOTED=$((PROMOTED + 1))
  else
    echo "  ❌ Falló mv: $DEST"
    PROMOTE_FAILED=$((PROMOTE_FAILED + 1))
  fi
done

if [ "$PROMOTE_FAILED" -gt 0 ]; then
  echo ""
  echo "⚠️  $PROMOTE_FAILED archivos no se pudieron promover desde staging."
  echo "   La instalación quedó parcial — revisar permisos y reintentar."
  exit 1
fi
echo "  ✅ $PROMOTED archivos promovidos."
echo ""

# ── Configurar hooks de protección ───────────────
echo "🛡️  Configurando hooks de protección..."
chmod +x .ai-internal/hooks/*.sh 2>/dev/null

# Merge hooks config into .claude/settings.local.json
SETTINGS_FILE=".claude/settings.local.json"
HOOKS_CONFIG='{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/pre-compact-marker.sh"}]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/post-compact-reminder.sh"}]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/guard-dangerous-ops.sh"}]
      },
      {
        "matcher": "mcp__.*[Aa]tlassian.*transition|mcp__.*[Aa]tlassian.*edit|mcp__.*[Nn]otion.*delete",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/guard-dangerous-ops.sh"}]
      }
    ]
  }
}'

if command -v jq >/dev/null 2>&1; then
  if [ -f "$SETTINGS_FILE" ]; then
    # Merge: preserve existing permissions, add hooks
    EXISTING=$(cat "$SETTINGS_FILE")
    echo "$EXISTING" | jq --argjson hooks "$(echo "$HOOKS_CONFIG" | jq '.hooks')" '. + {hooks: $hooks}' > "$SETTINGS_FILE"
  else
    echo "$HOOKS_CONFIG" | jq '.' > "$SETTINGS_FILE"
  fi
  echo "  ✅ Hooks configurados en $SETTINGS_FILE"
else
  # No jq — write manually if file doesn't have hooks yet
  if [ -f "$SETTINGS_FILE" ]; then
    if ! grep -q '"hooks"' "$SETTINGS_FILE" 2>/dev/null; then
      echo "  ⚠️  jq no disponible. Agregá hooks manualmente a $SETTINGS_FILE"
      echo "     Hooks descargados en .ai-internal/hooks/"
    else
      echo "  ✅ Hooks ya configurados"
    fi
  else
    echo "$HOOKS_CONFIG" > "$SETTINGS_FILE"
    echo "  ✅ Hooks configurados en $SETTINGS_FILE"
  fi
fi

# ── Compilar MCP server ─────────────────────────
echo "📦 Compilando MCP server del pipeline..."
if [ -f .ai-internal/mcp-server/package.json ]; then
  cd .ai-internal/mcp-server
  if command -v npm >/dev/null 2>&1; then
    echo ""
    BUILD_OK=true
    npm install --silent 2>&1 || BUILD_OK=false
    if [ "$BUILD_OK" = true ]; then
      npm run build 2>&1 || BUILD_OK=false
    fi
    if [ "$BUILD_OK" = true ]; then
      echo "  ✅ MCP server compilado"
    else
      echo ""
      echo "  ❌ Error compilando MCP server. Output arriba."
      echo "     Para reintentar: cd .ai-internal/mcp-server && npm install && npm run build"
    fi
  else
    echo "  ⚠️  npm no encontrado. Instalá Node.js y ejecutá:"
    echo "     cd .ai-internal/mcp-server && npm install && npm run build"
  fi
  cd - >/dev/null
else
  echo "  ⚠️  MCP server no descargado — se compilará en /bootstrap"
fi

# ── Detectar upgrade pendiente ─────────────────

# Extraer versión del bootstrap.md recién descargado (ej: "V4.4" → "4.4")
NEW_VERSION=""
if [ -f .claude/commands/bootstrap.md ]; then
  NEW_VERSION=$(grep -o 'V[0-9][0-9]*\.[0-9][0-9]*' .claude/commands/bootstrap.md | head -1 | sed 's/^V//')
fi

# Computar SHA-256 de TODOS los archivos descargados (content fingerprint)
# IMPORTANTE: usar el MISMO comando que bootstrap.md y phase-3-finalize.md
# para que el hash almacenado coincida con el computado en la próxima ejecución
NEW_HASH=""
if [ "$DOWNLOADED" -gt 0 ]; then
  NEW_HASH=$(cat .ai-internal/phases/phase-*.md .claude/commands/bootstrap.md .ai-internal/mcp-server/src/*.ts .ai-internal/mcp-server/package.json .ai-internal/mcp-server/tsconfig.json .ai-internal/templates/* .ai-internal/reusables/opsx/*.md .ai-internal/reusables/commands/*.md .ai-internal/reusables/agents/*.md .ai-internal/hooks/*.sh 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
fi

# Leer versión y hash almacenados
CURRENT_VERSION=""
CURRENT_HASH=""
if [ -f .bootstrap-meta.json ]; then
  CURRENT_VERSION=$(grep -o '"bootstrap_version"[[:space:]]*:[[:space:]]*"[^"]*"' .bootstrap-meta.json | head -1 | cut -d'"' -f4)
  CURRENT_HASH=$(grep -o '"content_hash"[[:space:]]*:[[:space:]]*"[^"]*"' .bootstrap-meta.json | head -1 | cut -d'"' -f4)
fi

UPGRADE_PENDING=false
UPGRADE_TRIGGER=""

# Trigger 1: content hash diferente (archivos cambiaron)
if [ -n "$CURRENT_HASH" ] && [ -n "$NEW_HASH" ] && [ "$CURRENT_HASH" != "$NEW_HASH" ]; then
  UPGRADE_PENDING=true
  UPGRADE_TRIGGER="content_changed"
fi

# Trigger 2: versión diferente (bump explícito)
if [ -n "$CURRENT_VERSION" ] && [ -n "$NEW_VERSION" ] && [ "$CURRENT_VERSION" != "$NEW_VERSION" ]; then
  UPGRADE_PENDING=true
  UPGRADE_TRIGGER="version_changed"
fi

# Tier 0: Proyecto pre-meta (bootstrapped antes de V4.3, sin .bootstrap-meta.json)
if [ "$UPGRADE_PENDING" = false ] && [ ! -f .bootstrap-meta.json ]; then
  LEGACY_SIGNALS=0
  test -f .claude/commands/start.md && LEGACY_SIGNALS=$((LEGACY_SIGNALS + 1))
  test -d ai-specs && LEGACY_SIGNALS=$((LEGACY_SIGNALS + 1))
  test -f CLAUDE.md && LEGACY_SIGNALS=$((LEGACY_SIGNALS + 1))
  test -d .claude/commands/opsx && LEGACY_SIGNALS=$((LEGACY_SIGNALS + 1))

  if [ "$LEGACY_SIGNALS" -ge 2 ]; then
    UPGRADE_PENDING=true
    UPGRADE_TRIGGER="pre_meta_legacy"
  fi
fi

if [ "$UPGRADE_PENDING" = true ]; then
  if [ "$UPGRADE_TRIGGER" = "pre_meta_legacy" ]; then
    FROM_VERSION="pre-meta"
  else
    FROM_VERSION="${CURRENT_VERSION:-unknown}"
  fi
  TO_VERSION="${NEW_VERSION:-unknown}"
  FROM_HASH="${CURRENT_HASH:-none}"
  TO_HASH="${NEW_HASH:-none}"

  # Construir lista de archivos actualizados
  FILES_UPDATED="["
  for ENTRY in "${FILES[@]}"; do
    DEST="${ENTRY##*|}"
    FILES_UPDATED="${FILES_UPDATED}\"${DEST}\","
  done
  FILES_UPDATED="${FILES_UPDATED%,}]"

  cat > .ai-internal/.upgrade-pending << UPGEOF
{
  "from_version": "${FROM_VERSION}",
  "to_version": "${TO_VERSION}",
  "from_hash": "${FROM_HASH}",
  "to_hash": "${TO_HASH}",
  "trigger": "${UPGRADE_TRIGGER}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files_updated": ${FILES_UPDATED}
}
UPGEOF

  echo ""
  if [ "$UPGRADE_TRIGGER" = "content_changed" ]; then
    echo "🔄 Upgrade detectado (content_changed): archivos fuente modificados"
  elif [ "$UPGRADE_TRIGGER" = "pre_meta_legacy" ]; then
    echo "🔄 Upgrade detectado (pre_meta_legacy): proyecto legacy sin .bootstrap-meta.json"
  else
    echo "🔄 Upgrade detectado (version_changed): V${FROM_VERSION} → V${TO_VERSION}"
  fi
  echo "   Archivo: .ai-internal/.upgrade-pending"
fi

# ── Resultado ────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ✅ Instalación completa ($DOWNLOADED archivos)"
echo ""

if [ "$UPGRADE_PENDING" = true ]; then
  if [ "$UPGRADE_TRIGGER" = "content_changed" ]; then
    echo "  🔄 Upgrade pendiente: archivos fuente modificados (mismo V${TO_VERSION})"
  elif [ "$UPGRADE_TRIGGER" = "pre_meta_legacy" ]; then
    echo "  🔄 Upgrade pendiente: proyecto legacy (pre-meta) → V${TO_VERSION}"
  else
    echo "  🔄 Upgrade pendiente: V${FROM_VERSION} → V${TO_VERSION}"
  fi
  echo ""
  echo "  Abrí Claude Code y escribí:"
  echo ""
  echo "    /bootstrap"
  echo ""
  echo "  El bootstrap detectará el upgrade y regenerará"
  echo "  los archivos adaptados a tu proyecto."
else
  echo "  Ahora abrí Claude Code y escribí:"
  echo ""
  echo "    /bootstrap"
  echo ""
  echo "  Se ejecutan 4 fases (una por cada /bootstrap):"
  echo "    Fase 0-2 → Detecta el proyecto"
  echo "    Fase 3-4 → Crea comandos reusables"
  echo "    Fase 5   → Crea archivos adaptados"
  echo "    Fase 6-7 → Docs base + MCP server + verificación"
fi
echo ""
echo "  Estructura creada:"
echo "    .ai-internal/phases/      ← archivos de fase (gitignored)"
echo "    .ai-internal/mcp-server/  ← pipeline state machine (MCP)"
echo "    .claude/commands/         ← comando /bootstrap"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
