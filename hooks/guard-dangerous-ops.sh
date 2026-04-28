#!/bin/bash
# SDD Hook: PreToolUse — Blocks dangerous git and Jira operations
# Matches: Bash and MCP Atlassian tools
# Exit 2 + stderr = block the tool call

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# ─── Guard 1: Git operations via Bash ───────────────────
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

  # Block push to protected branches (main / master). Push a dev y feature
  # branches está permitido — la confirmación previa al push se hace en /commit
  # vía AskUserQuestion (V4.11+).
  # Regex exige espacio antes y espacio/EOL/&&/;/| después del nombre de la rama
  # para no matchear substrings como "feature/main-rewrite".
  if echo "$COMMAND" | grep -qE 'git\s+push\b.*\s(main|master)(\s|$|&|;|\|)'; then
    echo "🛑 git push a main/master bloqueado por SDD guardrail. Releases van solo via /release-to-main (PR dev→main)." >&2
    exit 2
  fi

  # Block git merge to protected branches
  if echo "$COMMAND" | grep -qE 'git\s+merge\b'; then
    # Extract target or current context — block merges to main/master
    if echo "$COMMAND" | grep -qE 'git\s+(checkout|switch)\s+(main|master)\s*&&\s*git\s+merge'; then
      echo "🛑 merge a main/master bloqueado por SDD guardrail. Pedí confirmación al usuario." >&2
      exit 2
    fi
  fi

  # Block destructive git operations
  if echo "$COMMAND" | grep -qE 'git\s+(reset\s+--hard|push\s+--force|push\s+-f|clean\s+-f)'; then
    echo "🛑 Operación git destructiva bloqueada por SDD guardrail. Pedí confirmación al usuario." >&2
    exit 2
  fi
fi

# ─── Guard 2: Jira bulk edits via MCP (transitions allowed) ──────────────────
# Jira transitions are allowed — Claude Code's own permission system handles approval.
# Only block bulk edit operations that could affect multiple tickets at once.
if echo "$TOOL_NAME" | grep -qiE 'atlassian.*bulkEdit|atlassian.*deleteIssue|notion.*delete'; then
  echo "🛑 Operación masiva/destructiva de tracker bloqueada por SDD guardrail. Pedí confirmación al usuario." >&2
  exit 2
fi

exit 0
