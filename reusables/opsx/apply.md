---
name: "OPSX: Apply"
description: Implement tasks from an OpenSpec change
category: Workflow
tags: [workflow, artifacts, experimental]
---

**Input**: Optional change name. If omitted, infer or prompt.

**Steps**

1. **Select change** — provided name, infer from context, auto-select if only one, or prompt.

2. **Check status**: `openspec status --change "<name>" --json`

3. **Get apply instructions**: `openspec instructions apply --change "<name>" --json`
   - If `blocked`: suggest `/opsx:continue`
   - If `all_done`: suggest archive
   - Otherwise: proceed

4. **Read context files** from `contextFiles`.

5. **Show progress** — Schema, N/M tasks, remaining.

6. **Implement tasks (loop)**:
   - Show which task is active
   - Make code changes (minimal, focused)
   - Mark complete: `- [ ]` → `- [x]` immediately after completing
   - Continue to next task
   - Pause if: task unclear, blocker, or user interrupts

7. **On complete or pause**: show final status.

**Guardrails**
- Always read context files before starting
- Minimal code changes per task
- Update checkbox immediately after each task
- Pause and ask if task is ambiguous
