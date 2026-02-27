#!/bin/bash
set -e

# =============================================================
# AI Workflow Bootstrap — Installer
# Descarga las fases del repo privado y configura el comando
# =============================================================

# ⚙️ CONFIGURACIÓN — editá estos valores
REPO="tu-org/ai-bootstrap"          # ← tu repo privado en GitHub
BRANCH="main"
# =============================================================

FILES=(
  "phases/phase-0-detect.md"
  "phases/phase-1-reusables.md"
  "phases/phase-2-adapted.md"
  "phases/phase-3-finalize.md"
  "bootstrap.md"
)

echo ""
echo "🔧 AI Workflow Bootstrap V4.1 — Installer"
echo "==========================================="
echo ""

# Verificar prereqs
ERRORS=0

if ! command -v openspec >/dev/null 2>&1; then
  echo "❌ openspec-cli no instalado → npm install -g openspec-cli"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ openspec $(openspec --version 2>/dev/null)"
fi

# Verificar que estamos en un proyecto
if [ ! -f package.json ] && [ ! -f go.mod ] && [ ! -f requirements.txt ] && [ ! -f Cargo.toml ] && [ ! -f pom.xml ]; then
  echo "❌ No parece un proyecto. Ejecutá desde la raíz."
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Proyecto: $(basename $(pwd))"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Corregí los errores y volvé a ejecutar."
  exit 1
fi

echo ""

# Determinar método de descarga
DOWNLOAD_METHOD=""

if command -v gh >/dev/null 2>&1; then
  # Verificar que gh está autenticado
  if gh auth status >/dev/null 2>&1; then
    DOWNLOAD_METHOD="gh"
    echo "✅ Usando GitHub CLI (autenticado)"
  else
    echo "⚠️  gh CLI instalado pero no autenticado. Corré: gh auth login"
  fi
fi

if [ -z "$DOWNLOAD_METHOD" ] && [ -n "$GITHUB_TOKEN" ]; then
  DOWNLOAD_METHOD="curl"
  echo "✅ Usando GITHUB_TOKEN"
fi

if [ -z "$DOWNLOAD_METHOD" ]; then
  echo "❌ Necesitás una de estas opciones para descargar:"
  echo ""
  echo "   Opción 1 (recomendada): GitHub CLI"
  echo "     brew install gh"
  echo "     gh auth login"
  echo ""
  echo "   Opción 2: Token de GitHub"
  echo "     export GITHUB_TOKEN=ghp_xxxxx"
  echo ""
  exit 1
fi

# Crear directorios
mkdir -p .ai-internal/phases
mkdir -p .claude/commands

# Agregar a .gitignore si no está
if [ -f .gitignore ]; then
  grep -q ".ai-internal/" .gitignore || echo ".ai-internal/" >> .gitignore
else
  echo ".ai-internal/" > .gitignore
fi

echo ""
echo "📥 Descargando archivos..."
echo ""

# Descargar cada archivo
DOWNLOADED=0
FAILED=0

for FILE_PATH in "${FILES[@]}"; do
  FILENAME=$(basename "$FILE_PATH")

  # Determinar destino
  if [ "$FILENAME" = "bootstrap.md" ]; then
    DEST=".claude/commands/bootstrap.md"
  else
    DEST=".ai-internal/$FILE_PATH"
    mkdir -p "$(dirname "$DEST")"
  fi

  # Descargar
  if [ "$DOWNLOAD_METHOD" = "gh" ]; then
    CONTENT=$(gh api "repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}" \
      --jq '.content' 2>/dev/null | base64 -d 2>/dev/null)
  else
    CONTENT=$(curl -sf -H "Authorization: token $GITHUB_TOKEN" \
      "https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE_PATH}" 2>/dev/null)
  fi

  if [ -n "$CONTENT" ] && [ "$(echo "$CONTENT" | wc -l)" -gt 5 ]; then
    echo "$CONTENT" > "$DEST"
    LINES=$(echo "$CONTENT" | wc -l | tr -d ' ')
    echo "  ✅ $FILENAME → $DEST ($LINES líneas)"
    DOWNLOADED=$((DOWNLOADED + 1))
  else
    echo "  ❌ $FILENAME — no se pudo descargar"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️  $FAILED archivos fallaron. Verificá acceso al repo: $REPO"
  echo "   Podés copiar manualmente los archivos a .ai-internal/phases/"
  exit 1
fi

echo "✅ $DOWNLOADED archivos instalados"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Instalación completa!"
echo ""
echo "  Ahora:"
echo "    1. Abrí Claude Code en este proyecto"
echo "    2. Escribí: /bootstrap"
echo "    3. Seguí las instrucciones (4 fases)"
echo ""
echo "  Estructura creada:"
echo "    .ai-internal/phases/  ← archivos de fase (gitignored)"
echo "    .claude/commands/bootstrap.md ← comando /bootstrap"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
