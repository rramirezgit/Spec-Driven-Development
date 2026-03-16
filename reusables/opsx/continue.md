---
name: "OPSX: Continue"
description: Continue working on a change - create the next artifact
category: Workflow
tags: [workflow, artifacts, experimental]
---

**Input**: Optional change name. If omitted, infer from context or prompt.

**Steps**

1. **If no name, prompt**: `openspec list --json` → AskUserQuestion with top 3-4 recent changes (mark most recent as "Recommended"). Never auto-select.

2. **Check status**: `openspec status --change "<name>" --json`

3. **Act based on status**:
   - `isComplete: true` → "All done! Run `/opsx:apply` or `/opsx:archive`." STOP.
   - Has `ready` artifacts → pick FIRST ready, get instructions:
     `openspec instructions <artifact-id> --change "<name>" --json`
     Parse `context`/`rules` (constraints), `template` (structure), `outputPath`, `dependencies`.
     Read dependencies. Write artifact. Show what was created and what's now unlocked.
   - Nothing ready → Show status and suggest checking for issues.

4. **Show updated progress**: `openspec status --change "<name>"`

**Output**: Artifact created, N/M progress, "Run `/opsx:continue` for next."

**Guardrails**
- ONE artifact per invocation
- Never skip or create out of order
- `context` and `rules` are for YOU, not the output file
