---
name: "OPSX: Onboard"
description: Guided onboarding - walk through a complete OpenSpec workflow cycle
category: Workflow
tags: [workflow, onboarding, tutorial]
sdd_version: "1.0"
---

Guide the user through their first complete OpenSpec workflow cycle.

## Preflight
`openspec status --json 2>&1 || echo "NOT_INITIALIZED"`

## Phases — follow EXPLAIN → DO → SHOW → PAUSE pattern

1. **Welcome** — Full cycle: explore → new → proposal → specs → design → tasks → apply → archive
2. **Task Selection** — Scan for TODO/FIXME, missing tests, type issues. Present 3-4 real suggestions.
3. **Explore Demo** — Investigate relevant code, ASCII diagram if helpful
4. **Create Change** — `openspec new change "<name>"`
5. **Proposal** — Draft and save proposal.md
6. **Specs** — WHEN/THEN/AND format
7. **Design** — Context, Goals/Non-Goals, Decisions
8. **Tasks** — Checkboxes
9. **Apply** — Implement, mark complete
10. **Archive** — `openspec archive "<name>"`
11. **Recap** — Command reference table

**Guardrails**
- Use REAL codebase tasks, not fake examples
- Don't skip phases even if change is small
- Handle user exits gracefully
