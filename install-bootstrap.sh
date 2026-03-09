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
  "phase-1-reusables.md|.ai-internal/phases/phase-1-reusables.md"
  "phase-2-adapted.md|.ai-internal/phases/phase-2-adapted.md"
  "phase-3-finalize.md|.ai-internal/phases/phase-3-finalize.md"
  "bootstrap.md|.claude/commands/bootstrap.md"
  "mcp-server/package.json|.ai-internal/mcp-server/package.json"
  "mcp-server/tsconfig.json|.ai-internal/mcp-server/tsconfig.json"
  "mcp-server/src/types.ts|.ai-internal/mcp-server/src/types.ts"
  "mcp-server/src/config.ts|.ai-internal/mcp-server/src/config.ts"
  "mcp-server/src/pipeline.ts|.ai-internal/mcp-server/src/pipeline.ts"
  "mcp-server/src/jira.ts|.ai-internal/mcp-server/src/jira.ts"
  "mcp-server/src/index.ts|.ai-internal/mcp-server/src/index.ts"
)

echo ""
echo "🔧 Spec-Driven Development — Bootstrap V4.2"
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

if [ ! -f package.json ] && [ ! -f go.mod ] && [ ! -f requirements.txt ] && [ ! -f Cargo.toml ] && [ ! -f pom.xml ] && [ ! -f build.gradle ]; then
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
mkdir -p .claude/commands

# Agregar .ai-internal/ a .gitignore
if [ -f .gitignore ]; then
  grep -q "^\.ai-internal/" .gitignore 2>/dev/null || echo ".ai-internal/" >> .gitignore
else
  echo ".ai-internal/" > .gitignore
fi

# ── Descargar ────────────────────────────────────
echo ""
echo "📥 Descargando archivos..."
echo ""

DOWNLOADED=0
FAILED=0

for ENTRY in "${FILES[@]}"; do
  REPO_PATH="${ENTRY%%|*}"
  DEST="${ENTRY##*|}"
  FILENAME=$(basename "$REPO_PATH")

  mkdir -p "$(dirname "$DEST")"

  printf "  ⏳ %s..." "$FILENAME"

  CONTENT=""

  if [ "$DOWNLOAD_METHOD" = "gh" ]; then
    CONTENT=$(gh api "repos/${REPO}/contents/${REPO_PATH}" \
      -H "Accept: application/vnd.github.raw+json" \
      --method GET 2>/dev/null) || true
  else
    CONTENT=$(curl -sf -H "Authorization: token $GITHUB_TOKEN" \
      "https://raw.githubusercontent.com/${REPO}/${BRANCH}/${REPO_PATH}" 2>/dev/null) || true
  fi

  if [ -n "$CONTENT" ] && [ "$(printf '%s' "$CONTENT" | wc -l)" -gt 3 ]; then
    printf '%s' "$CONTENT" > "$DEST"
    LINES=$(wc -l < "$DEST" | tr -d ' ')
    printf "\r  ✅ %-28s → %s (%s líneas)\n" "$FILENAME" "$DEST" "$LINES"
    DOWNLOADED=$((DOWNLOADED + 1))
  else
    printf "\r  ❌ %-28s — falló\n" "$FILENAME"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️  $FAILED archivos fallaron."
  echo ""
  echo "   Debug: gh api repos/${REPO}/contents --jq '.[].path'"
  echo ""
  exit 1
fi

# ── Compilar MCP server ─────────────────────────
echo "📦 Compilando MCP server del pipeline..."
if [ -f .ai-internal/mcp-server/package.json ]; then
  cd .ai-internal/mcp-server
  if command -v npm >/dev/null 2>&1; then
    npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "  ✅ MCP server compilado"
    else
      echo "  ⚠️  Error compilando MCP server. Ejecutá manualmente:"
      echo "     cd .ai-internal/mcp-server && npm install && npm run build"
    fi
  else
    echo "  ⚠️  npm no encontrado. Instalá Node.js y ejecutá:"
    echo "     cd .ai-internal/mcp-server && npm install && npm run build"
  fi
  cd - >/dev/null
else
  echo "  ⚠️  MCP server no descargado — se compilará en /bootstrap"
fi

# ── Resultado ────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ✅ Instalación completa ($DOWNLOADED archivos)"
echo ""
echo "  Ahora abrí Claude Code y escribí:"
echo ""
echo "    /bootstrap"
echo ""
echo "  Se ejecutan 4 fases (una por cada /bootstrap):"
echo "    Fase 0-2 → Detecta el proyecto"
echo "    Fase 3-4 → Crea comandos reusables"
echo "    Fase 5   → Crea archivos adaptados"
echo "    Fase 6-7 → Docs base + MCP server + verificación"
echo ""
echo "  Estructura creada:"
echo "    .ai-internal/phases/      ← archivos de fase (gitignored)"
echo "    .ai-internal/mcp-server/  ← pipeline state machine (MCP)"
echo "    .claude/commands/         ← comando /bootstrap"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
