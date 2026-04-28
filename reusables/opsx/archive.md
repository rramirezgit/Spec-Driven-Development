---
name: "OPSX: Archive"
description: Archive a completed change
category: Workflow
tags: [workflow, archive]
sdd_version: "1.0"
---

**Input**: Optional change name. If omitted, prompt.

**Steps**

1. **Select change** — prompt if not provided.
2. **Check artifact completion** — warn if incomplete, ask confirmation.
3. **Check task completion** — warn if tasks pending, ask confirmation.
4. **Assess delta spec sync** — if delta specs exist, offer sync before archive.
5. **Archive**:
   ```bash
   mkdir -p openspec/changes/archive
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```
   Use actual current date.
6. **Summary**: archive location, sync status, warnings.

**Guardrails**
- Don't block on warnings — inform and confirm
- If archive target already exists: fail with error, stop
- Preserve .openspec.yaml
