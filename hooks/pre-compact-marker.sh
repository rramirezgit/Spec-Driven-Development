#!/bin/bash
# SDD Hook: PreCompact — Writes a marker file so post-compact reminder fires
# Installed by bootstrap to .ai-internal/hooks/

MARKER="$CLAUDE_PROJECT_DIR/.ai-internal/.compacted"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$MARKER" << EOF
{"timestamp":"$TIMESTAMP","trigger":"$(cat | jq -r '.trigger // "unknown"')"}
EOF

exit 0
