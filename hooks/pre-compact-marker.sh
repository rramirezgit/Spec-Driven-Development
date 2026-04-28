#!/bin/bash
# SDD Hook: PreCompact — Writes a marker file so post-compact reminder fires
# Installed by bootstrap to .ai-internal/hooks/

if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
  exit 0
fi

MARKER="$CLAUDE_PROJECT_DIR/.ai-internal/.compacted"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TRIGGER=$(jq -r '.trigger // "unknown"' 2>/dev/null || echo "unknown")

mkdir -p "$(dirname "$MARKER")"

# Build JSON safely with jq -n so quotes/special chars in trigger can't corrupt it.
jq -n --arg ts "$TIMESTAMP" --arg trig "$TRIGGER" \
  '{timestamp: $ts, trigger: $trig}' > "$MARKER"

exit 0
