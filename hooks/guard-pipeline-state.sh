#!/bin/bash
# SDD Hook: PreToolUse — Pipeline write guard (V4.22)
# Matches: Edit | Write | MultiEdit | NotebookEdit
#
# Bloquea escritura de código fuente cuando el pipeline SDD NO está en
# IMPLEMENTACION. Esto convierte el state machine de "protocolo sugerido"
# a enforcement real: aunque el contexto diluya las instrucciones del menú
# (documentación masiva, compaction), el harness rechaza la escritura.
#
# Exit 2 + stderr = block. Exit 0 = allow.
#
# Diseño fail-open: si falta jq, no hay state file, o el state es ilegible,
# el hook permite — nunca debe brickear un proyecto.

INPUT=$(cat)

# Sin jq no podemos parsear el input del hook — permitir.
command -v jq >/dev/null 2>&1 || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_FILE="$PROJECT_DIR/.ai-internal/pipeline-state.json"

# Sin pipeline-state.json el SDD no está activo en este proyecto — permitir.
[ -f "$STATE_FILE" ] || exit 0

# Kill switch del USUARIO para trabajo legítimo fuera del pipeline.
# Solo el humano debe crear este archivo (touch .ai-internal/sdd-guard-off).
[ -f "$PROJECT_DIR/.ai-internal/sdd-guard-off" ] && exit 0

STATE=$(jq -r '.state // empty' "$STATE_FILE" 2>/dev/null)
[ -n "$STATE" ] || exit 0

# En IMPLEMENTACION el código se escribe libremente — es el único estado
# cuyo propósito es implementar.
[ "$STATE" = "IMPLEMENTACION" ] && exit 0

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
[ -n "$FILE_PATH" ] || exit 0

# Escrituras fuera del proyecto (memoria de Claude, /tmp, etc.) no son
# jurisdicción de este guard.
case "$FILE_PATH" in
  "$PROJECT_DIR"/*) REL="${FILE_PATH#"$PROJECT_DIR"/}" ;;
  /*) exit 0 ;;
  *) REL="$FILE_PATH" ;;
esac

# Allowlist por directorio: artefactos de planificación, docs, specs y
# config del propio sistema SDD. Los estados ARTEFACTOS/PLAN/EVIDENCIA
# escriben acá legítimamente.
case "$REL" in
  .ai-internal/*|.claude/*|docs/*|ai-specs/*|openspec/*|.bootstrap-meta.json|.mcp.json|CLAUDE.md)
    exit 0 ;;
esac

# Markdown y texto plano son material de planificación/documentación,
# nunca código ejecutable — permitir en cualquier estado.
case "$REL" in
  *.md|*.mdc|*.mdx|*.txt)
    exit 0 ;;
esac

cat >&2 <<EOF
🛑 SDD write guard: el pipeline está en estado $STATE — el código solo se implementa en estado IMPLEMENTACION.

Archivo bloqueado: $REL

Flujo correcto: /menu → crear/seleccionar ticket → plan técnico → sdd_register_branch → sdd_advance(IMPLEMENTACION) → recién ahí escribir código. Llamá sdd_get_state para ver qué paso sigue.

Si este trabajo es legítimamente ajeno al pipeline SDD, NO crees el bypass vos mismo: explicale al usuario y pedile que ejecute manualmente:
  touch .ai-internal/sdd-guard-off
(y que lo borre al terminar el trabajo fuera del pipeline).
EOF
exit 2
