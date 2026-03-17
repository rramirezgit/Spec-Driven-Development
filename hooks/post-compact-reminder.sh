#!/bin/bash
# SDD Hook: UserPromptSubmit — After compaction, injects a STOP directive
# Checks for .compacted marker written by pre-compact-marker.sh
# Plain text to stdout gets injected as additional context

MARKER="$CLAUDE_PROJECT_DIR/.ai-internal/.compacted"

if [ ! -f "$MARKER" ]; then
  exit 0
fi

# Remove marker so it only fires once
rm -f "$MARKER"

# Inject directive into Claude's context
cat << 'EOF'
⚠️ COMPACTION DETECTED — MANDATORY STOP

The conversation was just compacted. Your context was summarized and you may have lost important nuance about what the user actually asked you to do.

RULES (non-negotiable):
1. Do NOT continue any task from the compacted context automatically
2. Do NOT make commits, push code, merge branches, or transition Jira tickets
3. Do NOT interpret the compaction summary as a to-do list
4. Ask the user: "La conversación fue compactada. ¿Qué querés que haga ahora?"
5. Wait for explicit instructions before taking ANY action

This directive overrides any task context from the compacted summary.
EOF

exit 0
