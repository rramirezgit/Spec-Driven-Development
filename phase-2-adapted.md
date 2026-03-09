<!-- FASE 5: Archivos adaptados al proyecto -->

## Pre-check

```bash
test -f .ai-internal/project-profile.md && echo "PERFIL_OK" || echo "PERFIL_MISSING"
test -d .claude/commands/opsx && echo "REUSABLES_OK" || echo "REUSABLES_MISSING"
```

Si falta algo: DETENER. Pedir que ejecuten las fases anteriores.

Leer `.ai-internal/project-profile.md` completo. TODOS los archivos usan esos datos.

---

## FASE 5: Crear archivos adaptados al proyecto detectado

Usando el `PROYECTO_PERFIL` construido en la Fase 0-1, creá cada archivo. **Reemplazá TODOS los placeholders antes de escribir el archivo.** No dejes ningún `{PLACEHOLDER}` sin reemplazar.

**Para cada archivo adaptado**: Si está en la lista de `archivos_protegidos` → SKIP con mensaje "🛡️ Saltando [archivo] (protegido por el usuario)".

### 5.0 — Reglas de MCP tools en archivos adaptados

Al generar archivos que referencian MCP tools (create-tickets, enrich-ticket, commit, etc.), usá los **prefijos reales detectados** en el paso 0.0b.

| Si MCP disponible | Usar prefijo real | Ejemplo |
|---|---|---|
| Atlassian detectado | `{atlassian_prefix}getJiraIssue` | `Atlassian:getJiraIssue` |
| Atlassian NO detectado | Comentario con instrucción de setup | `# TODO: Configurar Atlassian MCP — ver docs` |
| GitHub detectado | `{github_prefix}...` | ... |
| Figma detectado | `{figma_prefix}...` | ... |

**Nunca hardcodear nombres de MCP tools.** Siempre derivar del prefijo real detectado.

---

### `CLAUDE.md`

Generá este archivo con los valores reales del proyecto detectado:

```markdown
# CLAUDE.md — {nombre}

## Commands

```bash
{comando_dev}         # Start development server
{comando_build}       # Build for production
{comando_test}        # Run tests
{comando_lint}        # Lint
{comando_format}      # Format
```

## Architecture

**Stack**: {framework} {version} + {ui_library} + {backend_type}
**API**: {descripcion_backend}. URL: `{env_var_api}`
**Auth**: {metodo_auth}
**State**: server={server_state} | auth={auth_state} | forms={form_lib}+{validation_lib}

### Adding a New Resource
1. Types → `{ruta_types}/{resource}.types.ts`
2. API hook → `{ruta_hooks}/use-{resource}.ts`
3. Components → `{ruta_components}/{resource}/`
4. Routes → `{ruta_routes}`
{pasos_adicionales}

### Key Patterns
- Data fetching: {patron_fetching}
- Forms: {patron_forms}
- Routing: {patron_routing}
- Styling: {patron_styling}

## Key Files
| File | Purpose |
|------|---------|
| `{ruta_http_client}` | HTTP client |
| `{ruta_auth_store}` | Auth state |
{archivos_detectados}

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
{env_vars_detectadas}
```

---

### `AGENTS.md`

```markdown
# Development Standards — {nombre}

## Core Principles
- Small, focused changes — never rewrite working code
- Test appropriately
- Strict {lenguaje} — no `any`
- Consistent naming conventions
- Incremental changes
- Question assumptions before acting
- Pattern detection — check existing code first

## Language
- Code, comments: **{idioma_tecnico}**
- UI text, error messages: **{idioma_ui}**
- Tickets ({tracker}): **{idioma_tickets}**
- Commits, PRs (título + descripción): **{idioma_tickets}**
- Evidencia (`docs/evidence/`): **{idioma_tickets}**
- Documentación técnica (`docs/`): **{idioma_tickets}**

**Regla**: Evidencia, documentación y PRs van SIEMPRE en el idioma de tickets. Sin excepciones.

## Naming Conventions
{tabla_naming_del_proyecto}

## Tech Stack
{framework} {version} + {ui_library} + {backend_type}

## References
- `CLAUDE.md` — Architecture quick reference
- `ai-specs/specs/` — Detailed standards
```

---

### `openspec/config.yaml`

```yaml
schema: spec-driven

context: |
  # {nombre}

  ## Tech Stack
  {lista_stack_completo}

  ## Backend
  {descripcion_backend_detallada}
  Base URL env: {env_var_api}

  ## Architecture
  {descripcion_estructura_carpetas}

  ## Conventions
  - Language: {idioma_tecnico} code/docs | {idioma_ui} UI
  - Components: {patron_componentes}
  - Hooks: {patron_hooks}
  {otras_convenciones}

  ## Current Modules
  {modulos_detectados}

rules:
  proposal:
    - Reference existing patterns before proposing new ones
    - Include "Files to modify" section
    - Include "Non-goals" section
    - One feature or fix per proposal
  tasks:
    - Chunks completable in a single session
    - Specify exact files per task
    - Include test tasks for user-facing changes
    - Reference existing components before creating new ones
  delta-spec:
    - Document new patterns introduced
    - Note changes to existing conventions
```

---

### `ai-specs/.agents/{tipo}-developer.md`

> Nombrá el archivo según el tipo detectado: `frontend-developer.md` | `backend-developer.md` | `fullstack-developer.md` | `mobile-developer.md`

```markdown
---
name: {tipo}-developer
description: Expert {framework} architect for {nombre}. Plans features — never implements directly.
model: sonnet
color: cyan
---

# {Tipo} Developer Agent — {nombre}

## Role
Senior {framework} architect. Plans production-ready features following established project patterns.

## Core Expertise

### 1. Data Layer
{patron_data_fetching_con_ejemplo_real_del_proyecto}

### 2. Components
{patron_componentes_del_proyecto}

### 3. Routing
{sistema_routing_del_proyecto}

### 4. State Management
{patron_state_del_proyecto}

### 5. Forms (if applicable)
{patron_forms_del_proyecto}

### 6. Styling
{patron_styling_del_proyecto}

## Planning Workflow
1. Understand the requirement fully
2. Explore codebase — find existing patterns for this type of change
3. Design plan following project patterns exactly
4. Define tests needed
5. List every file to create or modify

## Code Review Criteria
- {lenguaje} strict: no `any`
- {criterio_especifico_1}
- {criterio_especifico_2}
- Naming conventions followed
- Tests included for user-facing changes

## Rules
1. **NEVER implement** — only produce plans
2. **Read context first** — always explore before planning
3. **Save plan** to `ai-specs/changes/{feature}.md`
4. **Reference specs** — always consult `ai-specs/specs/`
5. **Never propose new patterns** — check codebase first
```

---

### `ai-specs/.commands/develop-{tipo}.md`

```markdown
# Role

Senior {framework} engineer for {nombre}. Implement production-ready code following established patterns.

# Arguments
- `$1` — Ticket ID or feature description
- `$2` — Design URL (optional)

# Process

## 1. Load context
- Read `CLAUDE.md`
- Read `ai-specs/specs/{tipo}-standards.mdc`
- If ticket: fetch via ticket tracker MCP (if available, else ask user for details)
- If Figma URL: fetch via Figma MCP (if available, else ask user to describe)
- If OpenSpec change: read `openspec/changes/<change>/` artifacts

## 2. Implementation plan (before writing code)
Output:
- Component/service tree
- Files to create + files to modify
- Data flow
Ask: "Does this plan look correct? Proceed?"

## 3. Implement following project patterns

### Data fetching
{patron_data_fetching_real}

### Component/service structure
{patron_estructura_real}

### Forms (if applicable)
{patron_forms_real}

### Styling
{patron_styling_real}

## 4. Feedback loop
On feedback:
1. Understand what to change
2. Extract learnings
3. Check if a spec rule should update
4. Propose update → await approval → apply

# Rules
- No new dependencies without explicit justification and approval
- No structure changes without proposing first
- TypeScript strict — no `any`
- Always check existing patterns in `ai-specs/specs/`
- If an external tool (MCP, CLI) is unavailable: inform and continue with available context
```

---

### `ai-specs/.commands/enrich-ticket.md`

```markdown
# Role
Product Owner with deep technical knowledge of {nombre}. Enrich tickets to make them immediately implementable.

# Arguments
`$ARGUMENTS` — Ticket ID

# Process

## 1. Fetch ticket

**Preflight**: Verify ticket tracker MCP is available.
If unavailable: ask user to paste ticket content manually, then continue from step 2.

Fetch ticket with ID `$ARGUMENTS` using detected MCP tool.

## 2. Analyze completeness
- UI/Components described clearly?
- API endpoints or data sources identified?
- Validation rules specified?
- Error and empty states defined?
- Files to modify listed?
- Acceptance criteria testable and specific?
- {criterio_especifico_proyecto}

## 3. Enrich if lacking
- Keep original marked as `[Original]`
- Add enhanced sections marked as `[Enhanced]`
- Be specific: component names, file paths, API endpoints

## 4. Update ticket
Update via MCP tool if available. If not: output enriched content for manual copy.

## 5. Confirm
"Ticket {ID} enriched. Added: [summary]"

# Rules
- Write in {idioma_tickets}
- Never remove original content
- Use real file paths from the codebase
- Use real component names that exist in the project
- Degrade gracefully if MCP unavailable
```

---

### `ai-specs/.commands/plan-{tipo}-ticket.md`

```markdown
# Role
Expert {framework} architect for {nombre}. Step-by-step implementation plans with zero ambiguity.

# Ticket ID
$ARGUMENTS

# Goal
Complete plan ready to execute — no code, only the plan.

# Process

## 1. Load context
- Adopt `ai-specs/.agents/{tipo}-developer.md`
- Fetch ticket via MCP (if available, else ask user for details)
- Read `ai-specs/specs/{tipo}-standards.mdc`
- Explore relevant source files with `ls` and targeted `cat`

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
- Plan in {idioma_tecnico}
- If MCP unavailable: work with whatever context is available
```

---

### `.claude/commands/create-{tracker}-tickets.md`

> Si usa Jira → `create-jira-tickets.md`. Si usa Linear → `create-linear-tickets.md`. Adaptá los MCP tools según el tracker.

```markdown
# Role
Product Owner experto. Tickets claros y completos en {idioma_tickets}, listos para implementar.

# Arguments
`$ARGUMENTS` — Path a artefacto, nombre de OpenSpec change, o descripción.

# Process

## Step 0: Preflight — verificar MCP disponible

```bash
# El MCP de {tracker} debe estar disponible
```

Si el MCP no está disponible:
```
⚠️ El MCP de {tracker} no está disponible.
Opciones:
1. Configuralo siguiendo: [URL de docs]
2. Generó los tickets como texto para que los crees manualmente
```
Preguntar al usuario qué prefiere. Si elige texto: generar todo el contenido pero sin llamadas MCP, en formato copiable.

## Step 1: Contexto del proyecto
Obtener proyectos disponibles con cloudId `{jira_cloud_id}` (si Jira).
Si múltiples proyectos: preguntar en cuál crear.

## Step 2: Leer fuente
- Path → leer archivo
- Change OpenSpec → leer `openspec/changes/<name>/` artifacts
- Texto libre → usar directamente

## Step 3: Diseñar estructura
- **Epic** (opcional): para features con múltiples stories
- **Stories**: una por funcionalidad / flujo de usuario
- **Sub-tasks**: tareas técnicas específicas

## Step 4: Redactar en {idioma_tickets}

### Template Story:
```
**Como** [tipo de usuario]
**Quiero** [acción]
**Para** [beneficio]

**Criterios de aceptación:**
- Dado que [contexto], cuando [acción], entonces [resultado]

**Detalle técnico:**
- Componentes/servicios: [lista]
- Endpoints: [lista]
- Archivos: [lista]
- Validaciones: [lista]

**Definition of Done:**
- [ ] Código en PR
- [ ] Tests pasando
- [ ] Code review aprobado
```

### Template Sub-task:
```
**Objetivo**: [qué hacer]
**Archivo**: `[ruta]` — [create/modify] — [descripción]
**Criterio**: [cómo saber que está listo]
```

## Step 5: Mostrar resumen — esperar confirmación explícita

## Step 6: Crear tickets
Orden: Epic → Stories → Sub-tasks.
Confirmar creación de cada uno.

## Step 7: Resumen final
Tabla: ID | Tipo | Título | URL

# Reglas
- Idioma: {idioma_tickets}
- Confirmar antes de crear — NUNCA crear sin confirmación
- Usar rutas y componentes reales del proyecto
- Si MCP falla mid-process: mostrar lo creado + lo pendiente en formato texto
```

---

### `.claude/commands/menu.md`

> Se usa `menu.md` en vez de `start.md` para evitar colisión con el built-in `/status` de Claude Code (fuzzy matching).

```markdown
Sos el orquestador principal de flujo de trabajo para {nombre}.
Usás herramientas MCP del server `sdd-pipeline` para controlar el pipeline de forma determinística.

# REGLAS (leer antes de CUALQUIER acción)

1. **UN paso por invocación.** Después HALT — mostrar resumen y esperar input.
2. **SIEMPRE empezar llamando `sdd_check_config`.** Si falla → HALT con el error.
3. **Llamar `sdd_get_state`** para saber en qué estado está el pipeline y qué sigue.
4. **Ejecutar SOLO el comando que indica `nextCommand`.** No encadenar pasos.
5. **Al terminar un paso**, llamar `sdd_advance` con el nuevo estado.
6. **Mostrar resumen** + AskUserQuestion si quiere continuar.
7. **Si el usuario dice "hacé todo"**: ejecutá solo el siguiente paso, después preguntá de nuevo.
8. **RECORDATORIO POST-EJECUCIÓN**: Después de ejecutar un subcomando (.md), volvé acá y ejecutá HALT.

# Flujo de cada invocación

```
1. sdd_check_config → si error, mostrar y HALT
2. sdd_get_state → leer state, nextAction, nextCommand
3. Si IDLE → mostrar menú (7 opciones)
4. Si no → mostrar estado actual + "Siguiente: {nextAction}"
5. Ejecutar el comando .md correspondiente (UNO solo)
6. sdd_advance({nuevo_estado})
7. HALT con resumen
```

# Atajo rápido ($ARGUMENTS)

Si el usuario pasa un argumento directo, ir a ese flujo sin menú:
- "1" / "nuevo" / "feature" → Pedir descripción, ejecutar SOLO artefactos
- "2" / "ticket" / ID de ticket → Ejecutar SOLO enrich-ticket
- "3" / "explorar" → Ejecutar SOLO exploración
- "4" / "code" / "implementar" → Pedir ticket/desc, ejecutar SOLO develop
- "review" / "pr" → Ejecutar SOLO review-pr
- "test" → Ejecutar SOLO test-plan
- "sprint" / "7" → Flujo Sprint (ver abajo)
- "status" → Llamar sdd_get_state y mostrar sin ejecutar nada
- "evidence" / "evidencia" → Ejecutar SOLO evidence

Para detectar si el argumento es un ID de ticket: cualquier string que contenga letras + guión + números (ej: `AUTH-123`, `BACK-45`, `FE-7`) se trata como ticket ID.

**IMPORTANTE**: Incluso con atajos, SIEMPRE llamar `sdd_check_config` primero.

# Menú (solo cuando state=IDLE)

AskUserQuestion (single_select):
```
¿Qué querés hacer?

1. Feature nuevo — tengo una idea o requerimiento
2. Ticket existente — ya tengo un ticket en {tracker}
3. Explorar — pensar antes de planificar
4. Implementar directo — ya sé qué hacer
5. Review PR — revisar un pull request
6. Test plan — generar plan de testing
7. Sprint — planificar varios tickets en paralelo
```

## Acciones del menú

### Opción 1: Feature nuevo
Preguntar: "¿Qué querés construir? Describilo brevemente."
Con la descripción → leer y ejecutar `/opsx:ff`.
**Después**: `sdd_advance(ARTEFACTOS)` con el nombre del change. **HALT.**

### Opción 2: Ticket existente
Preguntar: "¿Cuál es el ID del ticket?"
Con el ID → `sdd_advance(TICKETS)`. Registrar ticket con `sdd_register_tickets`. Leer y ejecutar `/enrich-ticket <ID>`.
**Después**: `sdd_set_active_ticket(ID)`. **HALT.**

### Opción 3: Explorar
Leer y ejecutar `/opsx:explore`. **HALT después.**
(No afecta el pipeline — exploración es atómica.)

### Opción 4: Implementar directo
Preguntar: "¿Ticket ID o descripción?"
`sdd_advance(PLAN)`. Leer y ejecutar `/develop-{tipo}`.
**Después**: `sdd_advance(IMPLEMENTACION)`. **HALT.**

### Opción 5: Review PR
Preguntar: "¿Número de PR o 'current'?"
Leer y ejecutar `/review-pr`. **HALT después.**
(No afecta el pipeline — review es atómico.)

### Opción 6: Test plan
Preguntar: "¿Ticket ID o feature?"
Leer y ejecutar `/test-plan`. **HALT después.**
(No afecta el pipeline — test plan es atómico.)

### Opción 7: Modo sprint
Preguntar: "¿IDs de tickets separados por coma, o busco el sprint activo?"
Lanzar subagentes en paralelo (máximo 5) — SOLO planificación, NUNCA implementación.
**HALT después**. No elegir ticket para implementar.

# Estados del pipeline (cuando NO es IDLE)

Cuando `sdd_get_state` retorna un estado que no es IDLE, mostrar el estado actual y ofrecer el siguiente paso.
**En todos los estados**, la última opción de AskUserQuestion debe ser **"Quiero hacer otra cosa"**. Si la elige → `sdd_advance(IDLE)` (solo desde COMPLETADO) o mostrar advertencia de que perderá progreso.

## ARTEFACTOS → crear tickets
Mostrar artefactos encontrados. Ofrecer crear tickets con `/create-{tracker}-tickets`.
Después: `sdd_register_tickets([...])` + `sdd_advance(TICKETS)`.
>>>>>>> 146d180 (Add MCP server for pipeline state machine)

## TICKETS → seleccionar y planificar
Mostrar tickets con `sdd_get_state`. Pedir selección con AskUserQuestion.
Después: `sdd_set_active_ticket(ID)` + leer `/plan-{tipo}-ticket` + `sdd_advance(PLAN)`.

## PLAN → implementar
Mostrar plan técnico. Ofrecer implementar con `/develop-{tipo}`.
Después: `sdd_advance(IMPLEMENTACION)`.

## IMPLEMENTACION → evidencia
Mostrar archivos modificados. Ofrecer generar evidencia con `/evidence`.
Después: `sdd_advance(EVIDENCIA)`.

## EVIDENCIA → commit + PR
Mostrar evidencia generada. Ofrecer commit con `/commit`.
Después: `sdd_advance(COMMIT)`.

## COMMIT → completar
Intentar `sdd_transition_jira(ticketId)` para mover a QA Review.
Después: `sdd_advance(COMPLETADO)`.

## COMPLETADO → siguiente ticket o archivar
Mostrar resumen del ciclo. Si hay más tickets → ofrecer `sdd_advance(TICKETS)` + `sdd_set_active_ticket(siguiente)`.
Si no hay más → ofrecer `sdd_advance(IDLE)` (archivar primero con `/opsx:archive`).

# Protocolo HALT (obligatorio después de CADA paso)

Después de ejecutar cualquier paso:

1. Ya llamaste `sdd_advance` — el estado está persistido.
2. **Mostrar resumen**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Completado: {qué se hizo}
Artefactos: {archivos creados o modificados}
Ticket activo: {activeTicket del state}
Siguiente disponible: {nextAction del state}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
3. **AskUserQuestion**: "Continuar con {siguiente}" / "Pausar acá"

**IMPORTANTE**: Solo mencionás el paso inmediato siguiente. NUNCA listés los pasos 3, 4, 5 que vendrán después.

# Protocolo Skip Audit

Si `sdd_advance` rechaza una transición, mostrar:
```
PASO SALTADO: {nombre del paso}
Razón: {error de sdd_advance}
Alternativa: {qué puede hacer el usuario}
```

**NUNCA saltear silenciosamente.** Si algo no se hace, el usuario debe saber por qué.

# Referencia rápida de comandos
| Comando | Descripción |
|---------|-------------|
| `/menu` | Este menú — detecta estado y ejecuta siguiente paso |
| `/opsx:ff` | Nuevo change (fast-forward) |
| `/opsx:new` | Nuevo change (paso a paso) |
| `/opsx:continue` | Continuar change |
| `/opsx:apply` | Implementar tareas |
| `/opsx:verify` | Verificar implementación |
| `/opsx:archive` | Archivar change |
| `/opsx:explore` | Modo exploración |
| `/create-{tracker}-tickets` | Crear tickets en {tracker} |
| `/enrich-ticket` | Enriquecer ticket |
| `/plan-{tipo}-ticket` | Plan técnico |
| `/develop-{tipo}` | Implementar código |
| `/commit` | Commit + PR + transición ticket |
| `/review-pr` | Review de PR |
| `/test-plan` | Plan de testing |
| `/evidence` | Evidencia + doc cross-team |

# Herramientas MCP del pipeline
| Tool | Qué hace |
|------|----------|
| `sdd_check_config` | Valida project-profile, cloudId, tracker. Gate obligatorio. |
| `sdd_get_state` | Lee estado actual + nextAction + nextCommand. |
| `sdd_advance` | Transiciona estado. Rechaza transiciones ilegales. |
| `sdd_register_tickets` | Registra tickets creados en el pipeline. |
| `sdd_set_active_ticket` | Marca ticket activo (valida que existe). |
| `sdd_transition_jira` | Transiciona ticket a QA Review via Jira REST API. |

# Guardrails

**PROHIBIDO:**
- Ejecutar más de un comando por invocación de `/menu`
- Pasar de un paso al siguiente sin HALT + confirmación
- Saltear `sdd_check_config` al inicio
- Saltear `sdd_advance` al final de un paso
- Manipular `.ai-internal/pipeline-state.json` directamente (SIEMPRE usar tools MCP)
- Asumir un formato de ticket ID (no hardcodear PROJ-, DEV-, etc.)
- Describir el pipeline completo al usuario

**OBLIGATORIO:**
- `sdd_check_config` en CADA invocación
- `sdd_get_state` para saber qué sigue
- `sdd_advance` después de cada paso completado
- AskUserQuestion después de CADA paso
- Incluir "Quiero hacer otra cosa" en estados que no son IDLE
- Respuestas cortas entre pasos — el foco es el progreso
```
---

### `ai-specs/specs/base-standards.mdc`

```markdown
# Base Standards — {nombre}

## Core Principles
- Small, focused changes — never rewrite working code
- Test appropriately
- Strict {lenguaje} — no `any` without justification
- Consistent naming — follow conventions below
- Incremental — smallest change that solves the problem
- Question assumptions — ask before assuming scope
- Pattern detection — check existing code before creating new patterns

## Language
- Code, comments: **{idioma_tecnico}**
- UI text, error messages: **{idioma_ui}**
- Tickets ({tracker}): **{idioma_tickets}**
- Commits, PRs, evidencia, documentación (`docs/`): **{idioma_tickets}**

## Naming Conventions
{tabla_naming_del_proyecto}

## References
- `CLAUDE.md` — Quick architecture reference
- `ai-specs/specs/{tipo}-standards.mdc` — Detailed standards
{+ ui-design-system si aplica}
```

---

### `ai-specs/specs/documentation-standards.mdc`

```markdown
---
description: Documentation standards — structure, update process, language rules.
alwaysApply: true
---

# Documentation Standards — {nombre}

## Rule #1: Language
- Code comments, function descriptions: **{idioma_tecnico}**.
- ALL documentation in `docs/` (including evidence, API docs, component docs, READMEs): **{idioma_tickets}**.
- PRs (título y descripción): **{idioma_tickets}**.
- Commits: **{idioma_tickets}**.

No exceptions — applies to new files and updating existing ones.

## When to Update

| Change type | Files to update |
|-------------|----------------|
| New UI component / pattern | `ai-specs/specs/ui-design-system.mdc` |
| New {framework} pattern | `ai-specs/specs/{tipo}-standards.mdc` |
| New shared component | `ai-specs/specs/ui-design-system.mdc` custom components |
| New endpoint consumed | `CLAUDE.md` key files |
| Architecture / structure change | `ai-specs/specs/{tipo}-standards.mdc` |
| New dependency | `CLAUDE.md` + relevant spec |

## AI Learning Loop

When user provides feedback or corrections:
1. Identify which spec the feedback relates to
2. Propose specific update: "Based on feedback, I suggest updating [file] section [X] to say [Y]. Approve?"
3. Wait for explicit approval
4. Apply and confirm: "Updated [file] — [change made]"

### Anti-patterns
- Never modify specs without approval
- Never make changes beyond the feedback scope
- Never update multiple unrelated specs simultaneously

## /docs Directory Standards

### Structure
```
docs/
├── README.md                # Índice + changelog
├── arquitectura.md          # Stack (high-level), servicios, diagramas
├── api/
│   ├── README.md           # Índice de API + auth + convenciones
│   └── {modulo}.md         # Endpoints + DTOs por módulo
├── components/             # (solo frontend)
│   ├── README.md           # Índice de componentes
│   └── {modulo}.md         # Componentes + props + estados por módulo
├── evidence/
│   ├── README.md           # Convenciones de evidencia
│   └── {TICKET-ID}.md     # Evidencia por ticket (inmutable)
├── setup.md                # Instalación + troubleshooting
├── flujos.md               # Flujos principales + placeholders diagramas
├── decisiones.md           # ADRs
├── despliegue.md           # CI/CD + ambientes + rollback
└── assets/
    ├── README.md           # Convenciones de diagramas
    └── *.svg               # Diagramas exportados
```

### Content Ownership (evitar duplicación)

| Contenido | Source of truth | docs/ hace... |
|-----------|----------------|---------------|
| Stack tecnológico | `CLAUDE.md` | Cross-reference: "Ver CLAUDE.md" |
| Patrones y convenciones | `ai-specs/specs/{tipo}-standards.mdc` | Cross-reference |
| Env vars detalladas | `ai-specs/specs/{tipo}-standards.mdc §12` | Cross-reference + troubleshooting adicional |
| Endpoints por módulo | `docs/api/{modulo}.md` | **Source of truth** (detalle para frontend) |
| Componentes por módulo | `docs/components/{modulo}.md` | **Source of truth** (detalle para backend) |
| Evidencia QA | `docs/evidence/{TICKET-ID}.md` | **Source of truth** |
| Flujos del sistema | `docs/flujos.md` | **Source of truth** (con diagramas) |
| ADRs | `docs/decisiones.md` | **Source of truth** |

### Naming conventions
- API docs: `docs/api/{modulo}.md` — kebab-case (ej: `user-management.md`)
- Component docs: `docs/components/{modulo}.md` — kebab-case
- Evidence: `docs/evidence/{TICKET-ID}.md` — ID exacto del ticket
- Assets: `docs/assets/{tipo}-{descripcion}.svg` (ej: `flujo-autenticacion.svg`)

### Update rules
- Every file has `> Última actualización: {DATE}` after title
- When updating: only modify affected sections, never rewrite unrelated content
- Mark recent updates: `> 🆕 Actualizado por {TICKET_ID} ({DATE})`
- API module docs are living documents — grow as endpoints are added
- Evidence files are immutable after creation (snapshot of completion)

## Reference Templates

### Endpoint template (for docs/api/{modulo}.md)

```
### {METHOD} {ruta}

**Descripción**: {qué hace}
**Auth**: {tipo de auth, header esperado}

**Headers**:
| Header | Requerido | Descripción |

**Query params / Request body**:
| Param/Campo | Tipo | Requerido | Default | Descripción |

**Request body ejemplo**:
(JSON basado en DTO/schema real)

**Response (200)**:
(JSON basado en modelo/response type real)

**Errores**:
| Código | Causa | Response body |

**Notas de implementación**:
- {reglas de negocio}

**Ejemplo de uso (frontend)**:
(código con el http client del proyecto)
```

### Component template (for docs/components/{modulo}.md)

```
## {NombreComponente}

**Ubicación**: `{ruta}`
**Descripción**: {qué hace}

**Props**:
| Prop | Tipo | Requerido | Default | Descripción |

**Datos que consume**:
| Endpoint | Hook/Service | Campos usados |

**Estados**:
| Estado | Trigger | Comportamiento visual |

**Datos que necesita del backend**: {si aplica}
```

### Evidence template (for docs/evidence/{TICKET-ID}.md)

```
# {TICKET_ID}: {Título}

> Última actualización: {FECHA}
> Autor: {git config user.name}
> Branch: `{branch}`
> PR: {URL si existe}

## Resumen
{2-3 oraciones}

## Archivos modificados
| Archivo | Tipo de cambio | Descripción |

## Evidencia de funcionamiento

### Tests
{resultado o "[Sin tests — verificación manual requerida]"}

### Verificación manual
1. {Prerrequisito}
2. {Acción}
3. {Resultado esperado}

### Casos edge a verificar
- {caso}

## Impacto en otros equipos
{cross-team doc reference}

## Notas para QA
- Ambiente: {dev/staging}
- Datos de prueba: {descripción}
- Dependencias: {tickets/servicios}
```

```

---

### `ai-specs/specs/{tipo}-standards.mdc`

> Nombrá según el tipo detectado: `frontend-standards.mdc` | `backend-standards.mdc` | `mobile-standards.mdc`

```markdown
---
description: {Tipo} development standards, patterns, and conventions for {nombre}.
globs: {globs_del_proyecto}
alwaysApply: true
---

# {Tipo} Development Standards — {nombre}

## 1. Technology Stack

### Core
- **{framework}** ({version}) — {descripcion_routing_rendering}
- **{lenguaje}** — {config_typescript}

### {UI / Services / Infra}
{seccion_relevante_al_tipo}

### Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
{dependencias_clave_del_package_json}

---

## 2. Project Structure

```
{estructura_real_detectada_con_anotaciones}
```

---

## 3. Adding a New Resource

{patron_detectado_del_codebase}

---

## 4. Coding Standards

### Naming
{tabla_naming_del_proyecto}

### {lenguaje} Rules
{reglas_typescript_o_equivalente}

---

## 5. Import Order
{orden_inferido_de_eslint_config_o_archivos_existentes}

---

## 6. {Data Fetching / API Handlers / Service Layer} Pattern

```{lenguaje}
{patron_real_inferido_de_archivos_existentes}
```

---

## 7. {Forms / Validation / DTOs} Pattern

```{lenguaje}
{patron_real_inferido_de_archivos_existentes}
```

---

## 8. {HTTP Client / Controllers / Routers}

```{lenguaje}
{configuracion_real_detectada}
```

---

## 9. Routing
{patron_routing_del_proyecto}

---

## 10. {Styling / Error Handling / Logging}
{patron_relevante_al_tipo}

---

## 11. Testing
- Framework: {testing_framework}
- Location: {donde_van_tests}
- Run: `{comando_test}`
{reglas_testing}

---

## 12. Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
{env_vars_detectadas}

---

## 13. Key Reference Files
| File | Purpose |
|------|---------|
{archivos_clave_detectados}
```

---

### `ai-specs/specs/ui-design-system.mdc` (solo si frontend con design system)

> Creá este archivo SOLO si el proyecto es frontend Y tiene un design system custom (MUI theme, Tailwind config con tokens, etc.).
> Si el proyecto es backend o no tiene design system: saltear este archivo.

```markdown
---
description: UI Design System — theme, tokens, component overrides for {nombre}.
globs: {globs_ui}
alwaysApply: true
---

# UI Design System — {nombre}

## 1. Design Tokens
{tokens_del_tema_detectado}

## 2. Color Palette
{paleta_detectada_del_theme_file}

## 3. Typography
{tipografia_detectada}

## 4. Component Overrides
{overrides_detectados}

## 5. Custom Shared Components
{componentes_compartidos_detectados}

## 6. Styling Conventions
{convenciones_detectadas_de_archivos_existentes}
```

---

### 5.1 — Validación de calidad post-generación

Después de crear TODOS los archivos adaptados, ejecutá esta validación:

```bash
echo "=== VALIDACIÓN DE CALIDAD (Fase 5) ==="

ERRORS=0

# 1. Buscar placeholders sin reemplazar (patrón: {palabra_con_underscore} o {palabra})
echo "--- Placeholders sin reemplazar ---"
PLACEHOLDER_HITS=$(grep -rnE "\{[a-z_]{3,}\}" ai-specs/specs/ CLAUDE.md AGENTS.md openspec/config.yaml ai-specs/.agents/ ai-specs/.commands/ .claude/commands/menu.md .claude/commands/create-*-tickets.md 2>/dev/null | grep -v "node_modules" | grep -v ".git" | grep -v "\.bash" | grep -vE "\{(ID|feature|slug|name|ticket_id|resource}\}" | grep -vE "^\s*(#|//|```)" | head -30)

if [ -n "$PLACEHOLDER_HITS" ]; then
  echo "❌ PLACEHOLDERS ENCONTRADOS:"
  echo "$PLACEHOLDER_HITS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No hay placeholders sin reemplazar"
fi

# 2. Verificar que archivos adaptados tienen contenido sustancial (no vacíos o solo headers)
echo ""
echo "--- Archivos con contenido insuficiente ---"
for f in CLAUDE.md AGENTS.md openspec/config.yaml; do
  if [ -f "$f" ]; then
    LINES=$(wc -l < "$f")
    if [ "$LINES" -lt 10 ]; then
      echo "⚠️  $f tiene solo $LINES líneas — probablemente incompleto"
      ERRORS=$((ERRORS + 1))
    else
      echo "✅ $f ($LINES líneas)"
    fi
  fi
done

# 3. Verificar que los specs .mdc tienen secciones con contenido real
echo ""
echo "--- Specs con secciones vacías ---"
for f in ai-specs/specs/*.mdc; do
  if [ -f "$f" ]; then
    EMPTY_SECTIONS=$(grep -c "^$" "$f" | head -1)
    TOTAL_LINES=$(wc -l < "$f")
    if [ "$TOTAL_LINES" -lt 20 ]; then
      echo "⚠️  $f tiene solo $TOTAL_LINES líneas — revisar contenido"
      ERRORS=$((ERRORS + 1))
    else
      echo "✅ $f ($TOTAL_LINES líneas)"
    fi
  fi
done

# 4. Verificar que MCP tools referenciados existen (no hardcoded incorrectamente)
echo ""
echo "--- Referencias a MCP tools ---"
MCP_REFS=$(grep -rn "mcp__" ai-specs/.commands/ .claude/commands/ 2>/dev/null | head -10)
if [ -n "$MCP_REFS" ]; then
  echo "⚠️  Referencias hardcoded a MCP tools detectadas (deberían usar prefijo dinámico):"
  echo "$MCP_REFS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No hay referencias hardcoded a MCP tools"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "⚠️  $ERRORS problemas detectados. Corregir antes de continuar."
else
  echo "✅ Validación de calidad pasada. Continuando a Fase 6."
fi
```

**Si hay errores**: corregirlos antes de pasar a la Fase 5b. Mostrar cada error y la corrección aplicada.

---


---

Mostrá:
```
✅ Fase 5 completada. Archivos adaptados creados y validados.
   Siguiente: ejecutá /bootstrap para Fase final (docs + verificación)
```
