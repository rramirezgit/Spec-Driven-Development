---
name: "OPSX: Sync"
description: Sync delta specs from a change to main specs
category: Workflow
tags: [workflow, specs]
---

**Input**: Optional change name. If omitted, prompt.

**Steps**

1. **Select change** — prompt if not provided.
2. **Find delta specs** in `openspec/changes/<name>/specs/*/spec.md`.
   Sections: ADDED, MODIFIED, REMOVED, RENAMED.
3. **Apply to main specs** at `openspec/specs/<capability>/spec.md`:
   - ADDED → add new requirements
   - MODIFIED → apply partial updates (add scenarios, modify descriptions)
   - REMOVED → remove requirement blocks
   - RENAMED → find FROM, rename to TO
4. **Show summary** of changes applied.

**Key principle**: Delta = intent, not wholesale replacement. Read both delta and main before making changes.

**Guardrails**
- Preserve existing content not in delta
- Operation must be idempotent
