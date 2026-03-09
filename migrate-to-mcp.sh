#!/bin/bash
set -e

# =============================================================
# SDD Pipeline — Migrar a MCP Server
# Para proyectos que ya hicieron bootstrap con el sistema anterior
# =============================================================

# ⚙️ CONFIGURACIÓN — misma que install-bootstrap.sh
REPO="tu-org/ai-bootstrap"          # ← tu repo privado en GitHub
BRANCH="main"
# =============================================================

MCP_FILES=(
  "mcp-server/package.json"
  "mcp-server/tsconfig.json"
  "mcp-server/src/types.ts"
  "mcp-server/src/config.ts"
  "mcp-server/src/pipeline.ts"
  "mcp-server/src/jira.ts"
  "mcp-server/src/index.ts"
)

echo ""
echo "🔄 SDD Pipeline — Migración a MCP Server"
echo "=========================================="
echo ""

# ── Pre-checks ──────────────────────────────────────────────

ERRORS=0

# Verificar que es un proyecto con bootstrap previo
if [ ! -d .ai-internal ]; then
  echo "❌ No se encontró .ai-internal/ — este proyecto no tiene bootstrap."
  echo "   Usá install-bootstrap.sh para proyectos nuevos."
  exit 1
fi

if [ ! -f .ai-internal/project-profile.md ]; then
  echo "❌ No se encontró project-profile.md — el bootstrap no está completo."
  echo "   Ejecutá /bootstrap primero."
  exit 1
fi

if [ -f .ai-internal/mcp-server/dist/index.js ]; then
  echo "⚠️  MCP server ya existe y está compilado."
  read -p "   ¿Reinstalar? (s/N) " REINSTALL
  if [ "$REINSTALL" != "s" ] && [ "$REINSTALL" != "S" ]; then
    echo "   Saltando instalación del MCP server."
    SKIP_MCP_INSTALL=true
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js no encontrado. Es necesario para el MCP server."
  ERRORS=$((ERRORS + 1))
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm no encontrado. Es necesario para compilar el MCP server."
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Corregí los errores y volvé a ejecutar."
  exit 1
fi

echo "✅ Pre-checks OK"
echo ""

# ── Determinar método de descarga ───────────────────────────

DOWNLOAD_METHOD=""

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    DOWNLOAD_METHOD="gh"
    echo "✅ Usando GitHub CLI (autenticado)"
  fi
fi

if [ -z "$DOWNLOAD_METHOD" ] && [ -n "$GITHUB_TOKEN" ]; then
  DOWNLOAD_METHOD="curl"
  echo "✅ Usando GITHUB_TOKEN"
fi

if [ -z "$DOWNLOAD_METHOD" ]; then
  echo "❌ Necesitás GitHub CLI autenticado o GITHUB_TOKEN para descargar."
  echo "   gh auth login  ó  export GITHUB_TOKEN=ghp_xxxxx"
  exit 1
fi

# ── Paso 1: Descargar MCP server ────────────────────────────

if [ "$SKIP_MCP_INSTALL" != "true" ]; then
  echo ""
  echo "📥 Paso 1/5: Descargando MCP server..."
  echo ""

  mkdir -p .ai-internal/mcp-server/src

  DOWNLOADED=0
  FAILED=0

  for FILE_PATH in "${MCP_FILES[@]}"; do
    FILENAME=$(basename "$FILE_PATH")
    DEST=".ai-internal/$FILE_PATH"
    mkdir -p "$(dirname "$DEST")"

    if [ "$DOWNLOAD_METHOD" = "gh" ]; then
      CONTENT=$(gh api "repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}" \
        --jq '.content' 2>/dev/null | base64 -d 2>/dev/null)
    else
      CONTENT=$(curl -sf -H "Authorization: token $GITHUB_TOKEN" \
        "https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE_PATH}" 2>/dev/null)
    fi

    if [ -n "$CONTENT" ]; then
      echo "$CONTENT" > "$DEST"
      echo "  ✅ $FILENAME"
      DOWNLOADED=$((DOWNLOADED + 1))
    else
      echo "  ❌ $FILENAME — no se pudo descargar"
      FAILED=$((FAILED + 1))
    fi
  done

  if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo "❌ $FAILED archivos fallaron. Verificá acceso al repo: $REPO"
    exit 1
  fi

  echo "  $DOWNLOADED archivos descargados"

  # ── Paso 2: Compilar MCP server ─────────────────────────────

  echo ""
  echo "📦 Paso 2/5: Compilando MCP server..."

  cd .ai-internal/mcp-server
  npm install --silent 2>&1
  npm run build --silent 2>&1

  if [ -f dist/index.js ]; then
    echo "  ✅ MCP server compilado"
  else
    echo "  ❌ Error compilando. Revisá los logs arriba."
    exit 1
  fi

  cd - >/dev/null
else
  echo "📥 Paso 1/5: Saltado (MCP server ya existe)"
  echo "📦 Paso 2/5: Saltado (ya compilado)"
fi

# ── Paso 3: Generar .mcp.json ───────────────────────────────

echo ""
echo "⚙️  Paso 3/5: Configurando .mcp.json..."

if [ -f .mcp.json ]; then
  # Verificar si ya tiene sdd-pipeline
  if grep -q "sdd-pipeline" .mcp.json 2>/dev/null; then
    echo "  ✅ .mcp.json ya tiene sdd-pipeline configurado"
  else
    echo "  ⚠️  .mcp.json existe pero sin sdd-pipeline."
    echo "  Agregá manualmente al objeto mcpServers:"
    echo '    "sdd-pipeline": {'
    echo '      "command": "node",'
    echo '      "args": [".ai-internal/mcp-server/dist/index.js"],'
    echo '      "env": {'
    echo '        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}",'
    echo '        "JIRA_EMAIL": "${JIRA_EMAIL}"'
    echo '      }'
    echo '    }'
  fi
else
  cat > .mcp.json << 'MCPEOF'
{
  "mcpServers": {
    "sdd-pipeline": {
      "command": "node",
      "args": [".ai-internal/mcp-server/dist/index.js"],
      "env": {
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}",
        "JIRA_EMAIL": "${JIRA_EMAIL}"
      }
    }
  }
}
MCPEOF
  echo "  ✅ .mcp.json creado"
fi

# ── Paso 4: Migrar pipeline-tracker.md → pipeline-state.json ─

echo ""
echo "🔄 Paso 4/5: Migrando estado del pipeline..."

if [ -f .ai-internal/pipeline-tracker.md ]; then
  # Parsear el tracker viejo
  TRACKER_CONTENT=$(cat .ai-internal/pipeline-tracker.md)

  # Extraer estado
  STATE=$(echo "$TRACKER_CONTENT" | grep -oP '(?<=\*\*Estado\*\*:\s)(\w+)' 2>/dev/null || echo "")
  if [ -z "$STATE" ]; then
    STATE=$(echo "$TRACKER_CONTENT" | grep -i "Estado:" | head -1 | sed 's/.*Estado[^:]*:\s*//' | tr -d '[:space:]' 2>/dev/null || echo "")
  fi

  # Extraer change
  CHANGE=$(echo "$TRACKER_CONTENT" | grep -oP '(?<=\*\*Change\*\*:\s)(.+)' 2>/dev/null || echo "")
  if [ -z "$CHANGE" ]; then
    CHANGE=$(echo "$TRACKER_CONTENT" | grep -i "Change:" | head -1 | sed 's/.*Change[^:]*:\s*//' | xargs 2>/dev/null || echo "")
  fi

  # Extraer ticket activo
  ACTIVE_TICKET=$(echo "$TRACKER_CONTENT" | grep -oP '(?<=\*\*Ticket activo\*\*:\s)(.+)' 2>/dev/null || echo "")
  if [ -z "$ACTIVE_TICKET" ] || [ "$ACTIVE_TICKET" = "ninguno" ]; then
    ACTIVE_TICKET="null"
  else
    ACTIVE_TICKET="\"$ACTIVE_TICKET\""
  fi

  # Extraer tickets de la tabla
  TICKETS_JSON="[]"
  TICKET_LINES=$(echo "$TRACKER_CONTENT" | grep -E '^\| [A-Z]+-[0-9]+' 2>/dev/null || echo "")
  if [ -n "$TICKET_LINES" ]; then
    TICKETS_JSON="["
    FIRST=true
    while IFS= read -r line; do
      TICKET_ID=$(echo "$line" | awk -F'|' '{print $2}' | xargs 2>/dev/null)
      TICKET_TITLE=$(echo "$line" | awk -F'|' '{print $3}' | xargs 2>/dev/null)
      if [ -n "$TICKET_ID" ]; then
        if [ "$FIRST" = true ]; then
          FIRST=false
        else
          TICKETS_JSON="$TICKETS_JSON,"
        fi
        TICKETS_JSON="$TICKETS_JSON{\"id\":\"$TICKET_ID\",\"title\":\"$TICKET_TITLE\",\"qaTransition\":null}"
      fi
    done <<< "$TICKET_LINES"
    TICKETS_JSON="$TICKETS_JSON]"
  fi

  # Validar estado
  VALID_STATES="IDLE ARTEFACTOS TICKETS PLAN IMPLEMENTACION EVIDENCIA COMMIT COMPLETADO"
  if echo "$VALID_STATES" | grep -qw "$STATE"; then
    FINAL_STATE="$STATE"
  else
    FINAL_STATE="IDLE"
    echo "  ⚠️  Estado '$STATE' no reconocido, usando IDLE"
  fi

  # Generar change value
  if [ -n "$CHANGE" ] && [ "$CHANGE" != "ninguno" ] && [ "$CHANGE" != "-" ]; then
    CHANGE_JSON="\"$CHANGE\""
  else
    CHANGE_JSON="null"
  fi

  # Escribir pipeline-state.json
  cat > .ai-internal/pipeline-state.json << STATEEOF
{
  "state": "$FINAL_STATE",
  "change": $CHANGE_JSON,
  "activeTicket": $ACTIVE_TICKET,
  "tickets": $TICKETS_JSON,
  "mcpAvailable": true,
  "log": [
    {
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "action": "MIGRATED_FROM_TRACKER_MD",
      "detail": "Estado migrado desde pipeline-tracker.md"
    }
  ]
}
STATEEOF

  # Backup del tracker viejo
  mv .ai-internal/pipeline-tracker.md .ai-internal/pipeline-tracker.md.bak
  echo "  ✅ Estado migrado: $FINAL_STATE"
  echo "  ✅ Backup: pipeline-tracker.md.bak"

elif [ -f .ai-internal/pipeline-state.json ]; then
  echo "  ✅ pipeline-state.json ya existe (no se necesita migración)"
else
  # No hay pipeline activo — crear estado IDLE
  cat > .ai-internal/pipeline-state.json << 'STATEEOF'
{
  "state": "IDLE",
  "change": null,
  "activeTicket": null,
  "tickets": [],
  "mcpAvailable": true,
  "log": []
}
STATEEOF
  echo "  ✅ pipeline-state.json creado (estado: IDLE)"
fi

# ── Paso 5: Actualizar menu.md ──────────────────────────────

echo ""
echo "📝 Paso 5/5: Actualizando menu.md..."

if [ -f .claude/commands/menu.md ]; then
  # Verificar si ya usa MCP tools
  if grep -q "sdd_check_config" .claude/commands/menu.md 2>/dev/null; then
    echo "  ✅ menu.md ya usa herramientas MCP"
  else
    # Backup
    cp .claude/commands/menu.md .claude/commands/menu.md.bak
    echo "  ✅ Backup: menu.md.bak"
    echo ""
    echo "  ⚠️  menu.md necesita ser regenerado con el template nuevo."
    echo "  Opciones:"
    echo "    a) Re-ejecutar /bootstrap (recomendado — regenera todo)"
    echo "    b) Ejecutar en Claude Code: lee .ai-internal/phases/phase-2-adapted.md"
    echo "       y regenerá solo menu.md con el template de MCP"
    echo ""
    echo "  El template viejo fue guardado en menu.md.bak"
    MENU_NEEDS_UPDATE=true
  fi
else
  echo "  ⚠️  menu.md no encontrado — se creará en el próximo /bootstrap"
fi

# ── Resumen ──────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Migración completada!"
echo ""
echo "  Lo que se hizo:"
echo "    ✅ MCP server instalado en .ai-internal/mcp-server/"
echo "    ✅ .mcp.json configurado con sdd-pipeline"
echo "    ✅ Estado del pipeline migrado a pipeline-state.json"
if [ "$MENU_NEEDS_UPDATE" = "true" ]; then
echo "    ⚠️  menu.md necesita regenerarse (ver arriba)"
fi
echo ""
echo "  Próximos pasos:"
if [ "$MENU_NEEDS_UPDATE" = "true" ]; then
echo "    1. Abrir Claude Code"
echo "    2. Ejecutar /bootstrap (o regenerar solo menu.md)"
echo "    3. Verificar que /menu funciona con herramientas MCP"
else
echo "    1. Abrir Claude Code"
echo "    2. Ejecutar /menu — debería usar sdd_check_config"
fi
echo ""
echo "  Variables de entorno necesarias para Jira:"
echo "    export JIRA_API_TOKEN=tu_token"
echo "    export JIRA_EMAIL=tu_email@empresa.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
