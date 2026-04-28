# Role
Expert __SDD_FRAMEWORK__ architect for __SDD_NOMBRE__. Step-by-step implementation plans with zero ambiguity.

# Ticket ID
$ARGUMENTS

# Goal
Complete plan ready to execute — no code, only the plan.

# Process

## 1. Load context
- Adopt `ai-specs/.agents/__SDD_TIPO__-developer.md` (en multi-target: el agent ya cargado es el del subproyecto target — `{slug}-developer.md`).
- Fetch ticket via MCP (if available, else ask user for details)
- Read `ai-specs/specs/__SDD_TIPO__-standards.mdc` (en multi-target: `{slug}-standards.mdc`).
- Explore relevant source files with `ls` and targeted `cat` — en multi-target, **ceñirse al `path` del subproyecto target** registrado en el pipeline state (`sdd_get_state` → `targetSubproject`). No tocar archivos fuera de ese path en este ticket.

## 2. Produce plan

Save to `ai-specs/changes/{ticket_id}.md`:

---
# {Ticket title}
**Ticket**: {ID} | **Branch**: `feature/{ID}-{slug}`

## Overview
[2-3 sentences]

## Architecture Context
[How this fits the existing system]

## Implementation Steps

### Step 0: Create Branch
```bash
git checkout -b feature/{ID}-{slug}
```

### Step 1: {Area}
**Files**: `{path}` (create/modify)
- {specific change}

[Continue per area]

## Implementation Order
1. {Step} — {why first}
2. {Step} — {dependency}

## Testing Checklist
- [ ] {test}

## Error Handling
{patterns for this feature's errors}

## UI/UX Considerations
{loading states, empty states, responsive behavior}

## Dependencies
{external services, APIs, other tickets}

## Next Steps
After implementing this plan, return to `/menu` to continue the pipeline.
---

# Rules
- Reference REAL files (verify with `ls` before listing)
- Step 0 always: create branch
- Plan in __SDD_IDIOMA_TECNICO__
- If MCP unavailable: work with whatever context is available
