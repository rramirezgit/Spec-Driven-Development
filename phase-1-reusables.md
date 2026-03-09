<!-- FASE 3-4: Estructura + Archivos reusables -->

## Pre-check

```bash
test -f .ai-internal/project-profile.md && echo "PERFIL_OK" || echo "PERFIL_MISSING"
```

Si PERFIL_MISSING: DETENER. Pedir que ejecuten la fase 0 primero.
Si PERFIL_OK: leer `.ai-internal/project-profile.md` completo para contexto.

---

## FASE 3: Crear estructura de directorios y backups

### 3.1 — Crear backups (si re-ejecución)

```bash
if [ -f .bootstrap-meta.json ]; then
  BACKUP_DIR=".bootstrap-backup/$(date +%Y-%m-%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR"

  # Backup de archivos que van a sobreescribirse (excepto protegidos)
  for f in CLAUDE.md AGENTS.md openspec/config.yaml ai-specs/AI-WORKFLOW-PLAYBOOK.md; do
    if [ -f "$f" ]; then
      mkdir -p "$BACKUP_DIR/$(dirname $f)"
      cp "$f" "$BACKUP_DIR/$f"
    fi
  done

  # Backup de specs
  if [ -d ai-specs/specs ]; then
    mkdir -p "$BACKUP_DIR/ai-specs/specs"
    cp ai-specs/specs/*.mdc "$BACKUP_DIR/ai-specs/specs/" 2>/dev/null
  fi

  # Backup de agents
  if [ -d ai-specs/.agents ]; then
    mkdir -p "$BACKUP_DIR/ai-specs/.agents"
    cp ai-specs/.agents/*.md "$BACKUP_DIR/ai-specs/.agents/" 2>/dev/null
  fi

  echo "💾 Backup creado en $BACKUP_DIR"
fi
```

### 3.2 — Crear estructura de directorios

```bash
mkdir -p .claude/commands/opsx
mkdir -p ai-specs/.agents
mkdir -p ai-specs/.commands
mkdir -p ai-specs/specs
mkdir -p ai-specs/changes/archive
mkdir -p ai-specs/changes/strategy
mkdir -p openspec/specs
mkdir -p openspec/changes/archive
mkdir -p docs/api
mkdir -p docs/components
mkdir -p docs/evidence
mkdir -p docs/assets
```

> **Nota**: Los directorios `.claude/skills/openspec-*/` los crea `openspec init` en la Fase 6. No crearlos manualmente.

Verificá: `ls .claude/commands/ && ls ai-specs/`

---

## FASE 4: Crear archivos reusables

Creá cada archivo con el contenido exacto. No modifiques nada.

> **Nota sobre skills**: En V3 se creaban 10 SKILL.md manualmente aquí y luego `openspec init` los sobreescribía en Fase 6. En V4 se eliminó esa redundancia — los skills los genera únicamente `openspec init`.

---

### `.claude/commands/opsx/new.md`

```markdown
---
name: "OPSX: New"
description: Start a new change using the experimental artifact workflow (OPSX)
category: Workflow
tags: [workflow, artifacts, experimental]
---

Start a new change using the experimental artifact-driven approach.

**Input**: The argument after `/opsx:new` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" -> `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Determine the workflow schema**

   Use the default schema unless the user explicitly requests a different one.
   If user says "show workflows" -> run `openspec schemas --json` and let them choose.
   Otherwise: omit `--schema`.

3. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```

4. **Show the artifact status**
   ```bash
   openspec status --change "<name>"
   ```

5. **Get instructions for the first artifact**
   ```bash
   openspec instructions <first-artifact-id> --change "<name>"
   ```

6. **STOP and wait for user direction**

**Output**: Change name, schema, current status (0/N), first artifact template.
Prompt: "Ready to create the first artifact? Run `/opsx:continue`."

**Guardrails**
- Do NOT create any artifacts yet
- If name is invalid (not kebab-case), ask for valid name
- If change already exists, suggest `/opsx:continue` instead
```

---

### `.claude/commands/opsx/ff.md`

```markdown
---
name: "OPSX: Fast Forward"
description: Create a change and generate all artifacts needed for implementation in one go
category: Workflow
tags: [workflow, artifacts, experimental]
---

**Input**: Change name (kebab-case) or description of what to build.

**Steps**

1. **If no input, ask** via AskUserQuestion: "What change do you want to work on?"
   Derive kebab-case name from description.

2. **Create the change**
   ```bash
   openspec new change "<name>"
   ```

3. **Get artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse `applyRequires` and `artifacts`.

4. **Create artifacts in sequence until apply-ready**

   For each `ready` artifact:
   - `openspec instructions <artifact-id> --change "<name>" --json`
   - Parse: `context` + `rules` = constraints (NOT for output file), `template` = structure to use, `outputPath`, `dependencies`
   - Read dependency files for context
   - Write artifact to `outputPath` using `template` as structure
   - Progress: "Created <artifact-id>"
   - Re-check status after each. Stop when all `applyRequires` have `status: "done"`

   If artifact needs user input: AskUserQuestion, then continue.

5. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**Output**: Change name, artifacts created, "Run `/opsx:apply` to implement."

**Guardrails**
- `context` and `rules` are constraints for YOU, not content for files
- If change already exists: ask continue or create new
- Verify each file exists after writing before proceeding
```

---

### `.claude/commands/opsx/continue.md`

```markdown
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
```

---

### `.claude/commands/opsx/apply.md`

```markdown
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
```

---

### `.claude/commands/opsx/verify.md`

```markdown
---
name: "OPSX: Verify"
description: Verify implementation matches change artifacts before archiving
category: Workflow
tags: [workflow, verify]
---

**Input**: Optional change name. If omitted, prompt.

**Steps**

1. **Select change** — prompt if not provided.

2. **Load artifacts**:
   ```bash
   openspec status --change "<name>" --json
   openspec instructions apply --change "<name>" --json
   ```
   Read all `contextFiles`.

3. **Verify 3 dimensions**:
   - **Completeness**: Task checkboxes + spec coverage
   - **Correctness**: Requirements implemented, scenarios covered
   - **Coherence**: Design adherence, pattern consistency
   Each issue: CRITICAL | WARNING | SUGGESTION

4. **Output report**:
   - Scorecard table (3 dimensions × status)
   - Issues by priority with actionable recommendation for each
   - Verdict: ✅ Ready to archive | ⚠️ Issues to resolve

**Guardrails**
- Every issue needs a specific recommendation
- Prefer SUGGESTION > WARNING > CRITICAL when uncertain
- Gracefully handle missing artifacts
```

---

### `.claude/commands/opsx/archive.md`

```markdown
---
name: "OPSX: Archive"
description: Archive a completed change
category: Workflow
tags: [workflow, archive]
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
```

---

### `.claude/commands/opsx/explore.md`

```markdown
---
name: "OPSX: Explore"
description: Enter explore mode - think through ideas before building
category: Workflow
tags: [workflow, explore, thinking]
---

Enter explore mode. Think deeply. Visualize freely.

**NEVER write application code in explore mode.** Read files, investigate, but never implement.
MAY create OpenSpec artifacts if user asks.

**Input**: Whatever the user wants to think about.

## Stance
- Curious, not prescriptive
- Visual — use ASCII diagrams liberally
- Adaptive — follow interesting threads
- Patient — don't rush to conclusions
- Grounded — explore the actual codebase

## What to do
- Explore problem space (clarifying questions, reframe, challenge assumptions)
- Investigate codebase (map architecture, find integration points, surface complexity)
- Compare options (brainstorm, tradeoff tables)
- Visualize (ASCII diagrams, state machines, data flows)
- Surface risks and unknowns

## OpenSpec awareness
`openspec list --json` — check active changes. If exploring in context of a change, read its artifacts.
When insights crystallize: offer to capture as artifacts (never auto-capture).

## Guardrails
- Never implement — never write application code
- Never fake understanding — dig deeper if unclear
- Never auto-capture — offer, don't just do
- Always visualize — good diagrams beat paragraphs
```

---

### `.claude/commands/opsx/sync.md`

```markdown
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
```

---

### `.claude/commands/opsx/bulk-archive.md`

```markdown
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
```

---

### `.claude/commands/opsx/onboard.md`

```markdown
---
name: "OPSX: Onboard"
description: Guided onboarding - walk through a complete OpenSpec workflow cycle
category: Workflow
tags: [workflow, onboarding, tutorial]
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
```

---

### `ai-specs/.commands/explain.md`

```markdown
# Instructions

You are an expert learning facilitator. Help the user understand concepts, not just get answers. Optimize for skill acquisition and transferable understanding.

Never jump to fixes. Explain the system before discussing behavior.
Ground in official docs and established patterns. If uncertain, say so.
Tone: structured, not verbose. No marketing language.

## Topic handling
- Arguments provided → use as topic
- No arguments → use conversation context, ask if unclear

## Structure

### 1. Skill gap (2-4 paragraphs)
What? Why? Where in the system?

### 2. Alternatives (2-4 approaches)
Tradeoffs, edge cases, failure modes, misconceptions.

### 3. Visual or mental model
ASCII diagram or conceptual framework when appropriate.

### 4. Quiz (3-5 questions)
Multiple choice or short answer. Do NOT give answers — wait for user.

### Adaptive
- First time → first principles
- "Don't get it" → change strategy: analogy, simpler example

# User prompt
$ARGUMENTS
```

---

### `ai-specs/.commands/meta-prompt.md`

```markdown
# Instructions

You are an expert in prompt engineering.
Improve the following prompt using best practices: role, objective, constraints, format, examples.
Stick to the original objective. Output only the improved prompt — no explanations.

# Original prompt:
$ARGUMENTS
```

---

### `ai-specs/.commands/commit.md`

```markdown
# Role
Senior engineer. Create clear commits and PRs aligned with project standards.

# Arguments
- Empty → commit all relevant changes + PR
- Ticket IDs / feature names → commit ONLY those changes
- "no PR" / "only commit" / "dry run" / "just the message" → no-git mode: output message only

# Process

## 0. No-git mode check (first)
If user requested no git operations:
- Determine scope
- Output: (1) files that would be staged, (2) commit message in copy-pasteable block
- STOP. No git commands.

## 1. Inspect state
`git status` + `git diff` (+ `git diff --staged`). Identify current branch.

## 2. Evidence check ⚠️

If a ticket ID is identified (from args, branch name, or staged files):

```bash
TICKET_ID="[extracted_ticket_id]"
test -f "docs/evidence/${TICKET_ID}.md" && echo "EVIDENCE_EXISTS" || echo "NO_EVIDENCE"
```

- **Si existe evidencia**: continuar normalmente
- **Si NO existe evidencia**: mostrar warning:
  ```
  ⚠️  No se encontró evidencia para {TICKET_ID}.

  La evidencia ayuda a QA a validar y documenta los cambios para el equipo.

  Opciones:
  1. Generar evidencia ahora (recomendado) → /evidence {TICKET_ID}
  2. Continuar sin evidencia
  ```
  Si elige generar: ejecutar `/evidence`, luego continuar con commit.

## 3. Resolve scope
- Empty args → all relevant changes (exclude .env, build artifacts, local config)
- Args provided → map to changes by path/ticket/diff context. Use `git add -p` for partials. Leave other files unstaged.
- No matching changes → report and stop.
- **Include docs/ changes**: Si hay archivos nuevos/modificados en `docs/`, incluirlos en el commit.

## 4. Commit message
**Idioma**: Usar el idioma definido en `AGENTS.md` § Language para commits/docs. Si no hay AGENTS.md, usar español.
- Subject: short imperative. Optional prefix: `TICKET-ID: Agregar filtros de candidatos`
- Body: bullet points — qué cambió y por qué. Referenciar ticket IDs.
- **If docs were updated**: include "Docs: actualizado {files}" in body
- Never commit: secrets, .env, generated artifacts

## 5. Commit and push
`git push -u origin <branch>` if new branch.

## 6. Pull Request (via `gh` CLI)

**Preflight**: Check if `gh` is available:
```bash
gh --version 2>/dev/null || echo "GH_NOT_FOUND"
```
If `gh` not found: show commit summary, suggest manual PR creation, skip to step 7.

- **Idioma del PR**: título y descripción en el mismo idioma que el commit (ver `AGENTS.md` § Language). Si no hay AGENTS.md, usar español.
- Title: aligned with commit, include ticket ID if applicable
- Description: resumen, link al ticket, notas de testing
- **If evidence exists**: add link to evidence file in PR description:
  ```
  ## Evidencia
  Ver: `docs/evidence/{TICKET_ID}.md`
  ```

## 7. Transicionar ticket a QA Review (OBLIGATORIO si hay ticket ID)

Si hay ticket ID (de args, branch `feature/<ID>-*`, o prefijo del commit):

### 7.1. Llamar `sdd_transition_jira(ticketId)`
El MCP tool retorna instrucciones de delegación con los pasos exactos a ejecutar.

### 7.2. Ejecutar los pasos de delegación
Seguir los pasos que retorna `sdd_transition_jira`:
1. Llamar `getTransitionsForJiraIssue` con los params indicados
2. Buscar la transición que coincida (el MCP tool incluye la lista de nombres válidos en `matchLogic`)
3. Llamar `transitionJiraIssue` con el ID de la transición encontrada

### 7.3. Agregar comentario con evidencia
Llamar `sdd_comment_jira(ticketId, body)` con:
```
✅ Implementación completada — PR #{número}

📝 Evidencia: docs/evidence/{TICKET_ID}.md
📁 Archivos modificados: {N}
🧪 Tests: {estado}

Listo para QA.
```

### 7.4. Si la transición falla

**Si no se encuentra transición compatible**:
```
⚠️ TRANSICIÓN PENDIENTE: {TICKET_ID}
   Estado actual: {estado_actual}
   Transiciones disponibles: {lista de nombres}
   Ninguna coincide con QA Review.

   ❗ Acción requerida: mover manualmente a QA Review en el tracker.
```

**Si el MCP de Atlassian no está disponible**:
```
⚠️ TRANSICIÓN PENDIENTE: {TICKET_ID}
   MCP de Atlassian no disponible.

   ❗ Acción requerida: mover manualmente a QA Review en el tracker.
```

**IMPORTANTE**: La falla en la transición NO bloquea el commit/PR (el código ya está subido). Pero SIEMPRE se reporta como acción pendiente.

- No ticket ID → reportar: "Sin ticket ID — no se transicionó ningún ticket"
- No-git mode → skip entirely

## 8. Resumen
Archivos commiteados, scope, PR URL, estado de transición del ticket, estado de evidencia.

**El resumen SIEMPRE incluye el estado de la transición**:
- ✅ Ticket {ID} transicionado a QA Review
- ⚠️ Ticket {ID} NO transicionado — requiere acción manual
- ℹ️ Sin ticket ID asociado

# Rules
- Never `git push --force` without explicit request
- If push rejected: suggest pull/rebase, never force-push
- La transición a QA Review es obligatoria — si falla, reportar como acción pendiente
- Evidence is recommended but not blocking — dev decides
- Idioma del commit, PR y comentarios: según `AGENTS.md` § Language
```

---

### `ai-specs/.commands/update-docs.md`

```markdown
# Instructions

Review recent code changes and update documentation that should reflect them.

## Process

1. `git diff HEAD~1` or `git status` to see what changed
2. For each changed area:
   | Change type | Update |
   |-------------|--------|
   | New UI component/pattern | `ai-specs/specs/ui-design-system.mdc` |
   | New framework pattern | `ai-specs/specs/[stack]-standards.mdc` |
   | New shared component | `ai-specs/specs/ui-design-system.mdc` custom section |
   | New endpoint consumed | `CLAUDE.md` key files |
   | Architecture change | `ai-specs/specs/[stack]-standards.mdc` |
   | New dependency | `CLAUDE.md` + relevant spec |
3. Update maintaining existing structure and formatting
4. Confirm: "Updated: [files] — [summary of changes]"

## Rules
- Follow `ai-specs/specs/documentation-standards.mdc`
- Write in project's technical language
- Never remove existing docs unless directly contradicted
```

---

### `ai-specs/.commands/review-pr.md`

```markdown
# Role
Senior Code Reviewer. Thorough, constructive reviews focused on correctness, maintainability, security, and project standards.

# Arguments
`$ARGUMENTS` — PR number, branch name, or "current" for current branch diff.

# Process

## 1. Get the diff
- PR number → `gh pr diff <number>` (if `gh` available, else suggest manual)
- Branch / "current" → `git diff main...HEAD`

## 2. Load context
- `CLAUDE.md` — architecture and patterns
- `ai-specs/specs/[stack]-standards.mdc` — coding standards
- `ai-specs/specs/ui-design-system.mdc` — if UI changes present
- If OpenSpec change exists: read its artifacts for intent context

## 3. Analyze across 5 dimensions

### A. Correctness
Logic errors, null/undefined handling, edge cases, error handling.

### B. Security
Exposed secrets, unsanitized inputs, insecure data handling.

### C. Performance
Unnecessary re-renders, missing memoization, N+1 queries, redundant API calls.

### D. Standards compliance
Naming conventions, TypeScript strictness (no `any`), component structure, import order.

### E. Test coverage
New logic has tests, edge cases covered, test quality.

## 4. Output

### Summary
One paragraph: what this PR does + overall quality.

### Issues by priority
**🔴 CRITICAL** (must fix before merge)
- `[file:line]` — Description. Why it matters. What to do instead.

**🟡 WARNING** (should fix)
- `[file:line]` — Description. Suggested fix.

**🔵 SUGGESTION** (optional)
- `[file:line]` — Description. Alternative approach.

### Positives (min 2, be specific)

### Verdict
- ✅ **Approved**
- ⚠️ **Approved with comments**
- ❌ **Changes requested**

## Rules
- Every issue: file + line reference when possible + specific recommendation
- Be constructive — assume good intent
- Max 10 issues per priority level — consolidate similar ones
- If no OpenSpec change exists for this PR, note that planning artifacts are missing
```

---

### `ai-specs/.commands/test-plan.md`

```markdown
# Role
Senior QA Engineer. Comprehensive, executable test plans aligned with project's testing framework.

# Arguments
`$ARGUMENTS` — Ticket ID, feature description, or OpenSpec change name.

# Process

## 1. Gather context
- Ticket ID → fetch via ticket tracker MCP (if available)
- OpenSpec change → read `openspec/changes/<name>/` artifacts
- Read `CLAUDE.md` testing section
- Read `ai-specs/specs/[stack]-standards.mdc` testing section
- Explore relevant source files and EXISTING test files (for patterns and utilities)

## 2. Identify scenarios

### Unit tests
- Pure functions, utilities, complex business logic
- Edge cases, error conditions, type boundaries

### Integration tests
- Component interactions, form submissions, API calls (mocked)
- State changes, side effects

### E2E tests (only if Playwright/Cypress configured)
- Critical user flows (happy path)
- Error states and recovery
- Auth flows if applicable

## 3. Output

Save to `ai-specs/changes/strategy/test-plan-<feature>.md`:

---
# Test Plan: <feature>

## Scope
What is and isn't covered.

## Environment
- Framework: [Jest/Vitest/Playwright/etc.]
- File convention: [co-located `.test.ts` / `__tests__/` / etc.]
- Existing utilities: [list relevant test helpers found]

## Unit Tests
| Test case | Input | Expected | Priority |
|-----------|-------|----------|----------|

## Integration Tests
| Test case | Setup | Steps | Expected | Priority |
|-----------|-------|-------|----------|----------|

## E2E Tests (if applicable)
**[Flow name]**
Preconditions: [state]
Steps: 1. [...] 2. [...]
Expected: [result]
Priority: High/Med/Low

## Coverage checklist
- [ ] Happy path covered
- [ ] Error states covered
- [ ] Edge cases covered
- [ ] Auth flows covered (if applicable)

## Effort estimate
[X unit, Y integration, Z E2E — ~N hours]
---

## Rules
- Use actual test framework syntax (check existing test files first)
- Reference existing test utilities and fixtures
- If no testing framework configured: note it and suggest setup steps
- Mark highest-risk areas as High priority
```

---

### `ai-specs/.commands/evidence.md`

```markdown
# Role
Senior engineer + QA liaison. Genera evidencia de completitud de un ticket y documentación
técnica cross-team en /docs.

# Arguments
`$ARGUMENTS` — Ticket ID (ej: AUTH-123, BACK-45 — el formato depende del proyecto en el tracker), "current" para inferir del branch, o flag `--docs-only`.
- `TICKET-ID` → evidencia completa + doc cross-team
- `TICKET-ID --docs-only` → solo doc técnica (sin reporte QA)
- `--docs-only` (sin ID) → documenta cambios del branch actual

# Process

## 0. Resolver ticket
- ID explícito → usar directamente
- "current" o vacío → inferir de branch name (`feature/{TICKET-ID}-*` → extraer el ID)
- Si no se puede inferir y no es `--docs-only` → preguntar

## 1. Recopilar contexto

```bash
# Archivos modificados en este branch vs main
git diff main...HEAD --name-only

# Diff completo (para análisis)
git diff main...HEAD --stat

# Tests relevantes (si existen)
# Detectar archivos de test que corresponden a los archivos modificados
```

Leer cada archivo modificado para entender qué se hizo.

Si el MCP de tickets está disponible: fetch del ticket para obtener título, descripción, criterios.
Si no: pedir al dev que describa brevemente.

## 2. Clasificar el tipo de cambio

| Tipo | Señales | Doc cross-team |
|------|---------|----------------|
| Backend API | Archivos en routes/, controllers/, services/, endpoints | Para Frontend: endpoints, DTOs, request/response, auth |
| Backend Logic | services/, utils/, models/ sin nuevos endpoints | Para Frontend: cambios en comportamiento |
| Frontend UI | components/, pages/, views/ | Para Backend: nuevos datos que necesita, estados |
| Frontend Logic | hooks/, stores/, utils/ | Para Backend: cambios en consumo de API |
| Fullstack | Ambos | Doc completa bidireccional |
| Infra/Config | CI, Docker, configs | Para todos: qué cambió en el entorno |
| Fix/Bugfix | Cualquiera | Bug, causa raíz, fix aplicado |

## 3. Generar evidencia QA (skip si `--docs-only`)

Crear `docs/evidence/{TICKET_ID}.md` usando el **evidence template** de `ai-specs/specs/documentation-standards.mdc` sección "Reference Templates".

Contenido:
- Resumen de qué se hizo y por qué
- Tabla de archivos modificados (ruta, tipo de cambio, descripción)
- Tests: cuáles corren y resultado, o "[Sin tests — verificación manual requerida]"
- Pasos de verificación manual para QA (prerrequisito, acción, resultado esperado)
- Casos edge a verificar
- Notas para QA: ambiente, datos de prueba, dependencias

## 4. Generar/actualizar documentación cross-team (siempre)

Según el tipo de cambio:

### Si Backend → documentar para Frontend:
Actualizar o crear `docs/api/{modulo}.md` usando el **endpoint template** de `documentation-standards.mdc`.
- Endpoints con method, ruta, auth, headers, params, body, response, errores
- Ejemplos de request/response basados en DTOs/schemas REALES del código
- Notas de implementación (reglas de negocio, limitaciones)
- Ejemplo de uso para frontend

> **Source of truth**: Los patrones generales de API están en `ai-specs/specs/{tipo}-standards.mdc`.
> `docs/api/{modulo}.md` documenta endpoints específicos con detalle para consumo del frontend.

### Si Frontend → documentar para Backend:
Actualizar o crear `docs/components/{modulo}.md` usando el **component template** de `documentation-standards.mdc`.
- Ubicación, descripción, props
- Datos que consume (endpoint, hook, campos usados)
- Estados (loading, empty, error, success)
- Datos que necesita del backend

## 5. Actualizar índice

Agregar entrada en `docs/README.md` sección Changelog si hay archivos nuevos.

## 6. Comentar en ticket (si MCP disponible, skip si `--docs-only`)

Agregar comentario en el ticket:
```
✅ Evidencia generada: docs/evidence/{TICKET_ID}.md
Archivos modificados: {N}
Tests: {pasaron/no hay}
Doc técnica: docs/{api|components}/{modulo}.md
Listo para QA.
```

Si MCP no disponible: mostrar el comentario para copiar manualmente.

## 7. Preview y confirmación

Mostrar al dev:
- Resumen de lo generado
- Preguntar: "¿Querés ajustar algo antes de commitear?"

# Output
- `docs/evidence/{TICKET_ID}.md` — creado (solo si no es --docs-only)
- `docs/{api|components}/{modulo}.md` — creado/actualizado
- `docs/README.md` — actualizado si hay archivos nuevos
- Comentario en ticket (si MCP disponible y no es --docs-only)

# Rules
- **Idioma**: TODA la evidencia y documentación cross-team se escribe en el idioma definido en `AGENTS.md` § Language para docs. Si no hay AGENTS.md, usar español. Esto incluye: títulos, descripciones, resúmenes, notas para QA, comentarios en tickets.
- NUNCA inventar endpoints, DTOs o comportamientos que no estén en el código
- Si algo no se puede inferir: `[POR COMPLETAR — preguntar a {equipo}]`
- Ejemplos de request/response basados en schemas/tipos REALES del código
- Si no hay tests: decirlo claramente, no inventar coverage
- Usar templates de `documentation-standards.mdc` — no inline templates
- Si actualiza un archivo existente: solo modificar secciones afectadas, marcar con `> 🆕 Actualizado por {TICKET_ID} ({FECHA})`
- Degradar graciosamente si MCP no disponible
- No asumir formato de ticket ID — usar el ID exacto que provee el tracker del proyecto
```

---

### `ai-specs/.commands/generate-docs.md`

```markdown
# Role
Technical documentation architect. Genera documentación completa del proyecto
analizando el código fuente. Trabaja de forma iterativa por fases.

# Arguments
`$ARGUMENTS`:
- Vacío → generar docs completos desde cero (iterativo)
- "update" → actualizar docs existentes basándose en cambios recientes
- Ruta de archivo → documentar solo ese archivo/módulo

# Process

## Modo: Generación completa (sin argumentos)

### Fase 1: Analizar + README + setup.md

```bash
# Estructura completa
find . -maxdepth 4 -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.next/*" \
  | head -100

# Stack
cat package.json 2>/dev/null

# Variables de entorno
cat .env.example 2>/dev/null || cat .env.template 2>/dev/null

# CI/CD
ls .github/workflows/ 2>/dev/null
cat Dockerfile 2>/dev/null | head -20
cat docker-compose*.yml 2>/dev/null | head -20
```

Generar:
- `docs/README.md` — índice completo, tree del proyecto, convenciones, changelog
- `docs/setup.md` — requisitos, instalación, troubleshooting

> **Cross-reference**: `docs/setup.md` referencia env vars a `ai-specs/specs/{tipo}-standards.mdc §12`
> en vez de copiarlas. Solo agrega notas adicionales de troubleshooting.

**Confirmar con el usuario antes de continuar a Fase 2.**

### Fase 2: Detectar endpoints → api/*.md

```bash
# Express/Nest/Fastify routes
find . -maxdepth 5 -name "*.route*" -o -name "*.controller*" -o -name "*.router*" \
  2>/dev/null | grep -v node_modules

# Next.js API routes
find . -path "*/api/*" -name "*.ts" -o -name "*.js" 2>/dev/null | grep -v node_modules

# Modelos / Schemas / DTOs
find . -maxdepth 5 -name "*.model.*" -o -name "*.schema.*" -o -name "*.entity.*" \
  -o -name "*.dto.*" 2>/dev/null | grep -v node_modules
```

Leer cada archivo. Generar:
- `docs/api/README.md` — índice de módulos, auth, base URL, convenciones
- `docs/api/{modulo}.md` por cada grupo — usando **endpoint template** de `documentation-standards.mdc`

Si frontend: también generar `docs/components/README.md` con índice de componentes.

**Confirmar antes de Fase 3.**

### Fase 3: Arquitectura + decisiones + despliegue

Generar:
- `docs/arquitectura.md` — Stack (referencia a CLAUDE.md para detalle), servicios, ambientes, dependencias externas. Enfoque en diagramas y visión de alto nivel, NO duplicar lo que ya está en `ai-specs/specs/`.
- `docs/decisiones.md` — ADRs inferidos: base de datos, framework, auth, deploy. Formato: Fecha, Estado, Contexto, Decisión, Consecuencias.
- `docs/despliegue.md` — CI/CD detectado, flujo de deploy, variables por ambiente, rollback.

> **Cross-reference**: `docs/arquitectura.md` dice "Stack detallado en CLAUDE.md" y se enfoca
> en diagramas y decisiones arquitecturales, no en listar dependencias.

**Confirmar antes de Fase 4.**

### Fase 4: Flujos + placeholders de diagramas

Generar:
- `docs/flujos.md` — flujos principales del sistema (auth, CRUD principal, etc.). Para cada flujo: descripción, pasos, casos edge. Placeholders para diagramas: `![Flujo X](./assets/flujo-x.svg)`. En comentarios HTML: prompt exacto para generar cada diagrama con Excalidraw MCP.

**Confirmar. Docs completos.**

## Modo: Actualización ("update")

1. `git diff HEAD~5` o cambios recientes
2. Comparar contra /docs existente
3. Actualizar solo lo que cambió
4. Actualizar fecha en archivos modificados
5. Si hay cambio significativo de arquitectura: nuevo ADR
6. Listar diagramas que necesitan regenerarse

## Modo: Archivo específico (ruta)

1. Leer el archivo
2. Determinar a qué doc pertenece (api, components, etc.)
3. Actualizar solo esa sección

# Rules
- TODO en {idioma_tecnico}
- Markdown limpio, sin HTML innecesario (excepto prompts de Excalidraw)
- NO inventar nada que no esté en el código
- `[POR COMPLETAR]` para lo que no se pueda inferir
- Ejemplos reales basados en schemas/tipos del código
- Cada archivo tiene "Última actualización: {FECHA}" arriba
- Usar templates de `documentation-standards.mdc` — no inline templates
- Cross-reference a ai-specs/ y CLAUDE.md cuando corresponda — no duplicar contenido
- Iterativo: confirmar con el usuario entre cada fase
```

---

### `ai-specs/.agents/product-strategy-analyst.md`

```markdown
---
name: product-strategy-analyst
description: Expert product strategist for idea analysis, use case identification, and value proposition development.
model: opus
color: pink
---

# Product Strategy Analyst

## Role
Expert product strategist: product management, market analysis, strategic planning.

## Core Responsibilities

### 1. Idea Analysis
- Break down product ideas into components
- Identify hidden assumptions and blind spots
- Evaluate feasibility, viability, desirability

### 2. Use Case Identification
Structured format: Scenario → User Pain → Solution → Expected Outcome
Prioritize by impact × frequency.

### 3. Target User Definition
Personas: demographics, needs, goals, frustrations, alternatives.
Rank segments by market opportunity.

### 4. Value Proposition
Jobs-to-be-Done, Value Proposition Canvas, USPs.
Clear, testable value propositions.

## Output format
- Executive summary (2-3 sentences)
- Bullet points
- Actionable next steps
- Critical assumptions to validate
- Success metrics

## Rules
1. Think deeply before responding
2. Save to `ai-specs/changes/strategy/{topic}.md`
3. Be honest about uncertainties
4. Focus on the project's domain
```

---

## ── CHECKPOINT DE CONTEXTO ──

> **Instrucción para el agente**: Antes de continuar con la Fase 5, hacé un mini-resumen interno para consolidar el contexto. Esto previene degradación por ventana de contexto larga.
>
> ```
> CHECKPOINT:
>   proyecto: [nombre]
>   tipo: [tipo]
>   framework: [framework + versión]
>   tracker: [jira/linear/github] + cloudId si aplica
>   idioma: [idioma_tickets] / [idioma_tecnico]
>   mcps: [lista de disponibles con prefijos reales]
>   archivos_protegidos: [lista o "ninguno"]
>   archivos_creados_hasta_ahora: [lista de Fase 4]
>   pendiente: Fase 5 (adaptados) → Fase 6 (openspec init) → Fase 7 (verificación)
> ```

---


---

Mostrá:
```
✅ Fase 3-4 completada. Archivos reusables creados.
   Siguiente: ejecutá /bootstrap para Fase 5 (archivos adaptados)
```
