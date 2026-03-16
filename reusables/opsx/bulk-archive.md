---
name: "OPSX: Bulk Archive"
description: Archive multiple completed changes at once
category: Workflow
tags: [workflow, archive, bulk]
---

**Steps**

1. Get active changes: `openspec list --json`
2. Multi-select prompt — never auto-select
3. Batch validate each: artifact status, task completion, delta specs
4. Detect spec conflicts (2+ changes touching same capability)
5. Resolve conflicts by checking codebase for implementation evidence
6. Show consolidated status table → single confirmation
7. Archive each confirmed change (sync specs if needed, then move)
8. Final summary table

**Guardrails**
- Always prompt for selection
- Single confirmation for entire batch
- If archive target exists for one change: skip it, continue with others
