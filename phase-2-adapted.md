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
- Code, comments, commits, docs: **{idioma_tecnico}**
- UI text, error messages: **{idioma_ui}**
- Tickets: **{idioma_tickets}**

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
After implementing: run `/commit` to create PR and transition ticket.
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
Tu trabajo es **detectar en qué punto del pipeline está el usuario y ejecutar el siguiente paso directamente**. No listás comandos — los ejecutás vos.

# Regla principal

**NUNCA digas "ahora ejecutá /comando". Ejecutalo vos directamente.** El usuario no debería tener que copiar y pegar comandos. Vos leés las instrucciones del comando y las ejecutás.

"Ejecutar un comando" significa: leer el archivo .md del comando correspondiente (`ai-specs/.commands/` o `.claude/commands/`) y seguir sus instrucciones como si fueras ese agente.

# Paso 0: Atajo rápido ($ARGUMENTS)

Si el usuario pasa un argumento directo, ir a ese flujo sin menú:
- "1" / "nuevo" / "feature" → Flujo Feature Nuevo (paso 1)
- "2" / "ticket" / ID de ticket (ej: "PROJ-123") → Flujo Ticket Existente
- "3" / "explorar" → Ejecutar flujo de exploración
- "4" / "code" / "implementar" → Flujo Directo
- "review" / "pr" → Ejecutar review-pr
- "test" → Ejecutar test-plan
- "sprint" / "7" → Flujo Sprint
- "status" → Mostrar solo el estado del pipeline sin ejecutar nada
- "evidence" / "evidencia" → Ejecutar evidence directamente

# Paso 1: Detectar estado del pipeline

```bash
echo "=== PIPELINE STATE ==="

# 1. Changes activos de OpenSpec
echo "--- OPENSPEC ---"
ls openspec/changes/ 2>/dev/null | grep -v archive | head -10 || echo "NO_CHANGES"

# 2. Planes técnicos pendientes
echo "--- PLANES ---"
ls ai-specs/changes/ 2>/dev/null | grep -v archive | grep -v strategy | head -10 || echo "NO_PLANS"

# 3. Git status
echo "--- GIT ---"
git branch --show-current 2>/dev/null || echo "NO_BRANCH"
git status --short 2>/dev/null | head -10 || echo "CLEAN"
git log --oneline -1 2>/dev/null || echo "NO_COMMITS"

# 4. Evidencia pendiente
echo "--- EVIDENCE ---"
ls docs/evidence/ 2>/dev/null | grep -v README | head -10 || echo "NO_EVIDENCE"

# 5. OpenSpec status del change activo (si hay)
ACTIVE_CHANGE=$(ls openspec/changes/ 2>/dev/null | grep -v archive | head -1)
if [ -n "$ACTIVE_CHANGE" ]; then
  echo "--- ACTIVE CHANGE: $ACTIVE_CHANGE ---"
  openspec status --change "$ACTIVE_CHANGE" 2>/dev/null || echo "STATUS_UNAVAILABLE"
fi
```

# Paso 2: Determinar punto del pipeline

Con la info del paso 1, determiná en qué estado está el usuario. Los estados posibles son:

## Estado A: Nada en curso
No hay changes, no hay planes, git limpio, no hay branch de feature.

→ Mostrar menú inicial (AskUserQuestion single_select):
```
¿Qué querés hacer?

1. 🚀 Feature nuevo — tengo una idea o requerimiento
2. 🎫 Ticket existente — ya tengo un ticket en {tracker}
3. 🔍 Explorar — pensar antes de planificar
4. ⚡ Implementar directo — ya sé qué hacer
5. 👀 Review PR — revisar un pull request
6. 🧪 Test plan — generar plan de testing
7. 🏃 Sprint — planificar varios tickets en paralelo
```

## Estado B: Change creado, sin tickets
Hay un change en `openspec/changes/` con artefactos, pero no hay tickets creados todavía.

→ **Ejecutar directamente** la creación de tickets:
```
✅ Artefactos listos: {nombre_change}
   {lista de artefactos creados}

📋 Siguiente paso: crear tickets en {tracker}

Voy a leer los artefactos y generar los tickets. ¿Procedemos?
```
Si confirma → Leer `.claude/commands/create-{tracker}-tickets.md` y ejecutar el flujo pasando el change como argumento.

## Estado C: Tickets creados, sin plan técnico
Hay tickets referenciados pero no hay planes en `ai-specs/changes/`.

→ **Preguntar qué ticket trabajar y ejecutar el plan**:
```
📋 Tickets listos. ¿Cuál querés trabajar primero?
```
AskUserQuestion con los ticket IDs como opciones (si los conocés del paso anterior), o pedir ID.
Cuando elija → Leer `ai-specs/.commands/plan-{tipo}-ticket.md` y ejecutar con ese ID.

## Estado D: Plan técnico listo, sin implementar
Hay un plan en `ai-specs/changes/{ticket}.md` pero no hay código nuevo (branch sin cambios, o branch no creada).

→ **Ejecutar la implementación**:
```
📐 Plan técnico listo: ai-specs/changes/{ticket}.md

Siguiente paso: implementar. Voy a seguir el plan.
¿Arranco?
```
Si confirma → Leer `ai-specs/.commands/develop-{tipo}.md` y ejecutar con el plan como contexto.

## Estado E: Código implementado, sin evidencia
Hay cambios en git (`git status` muestra archivos modificados o commits en un feature branch), pero no hay evidencia en `docs/evidence/` para ese ticket.

→ **Ejecutar evidencia**:
```
✅ Implementación completada ({N} archivos modificados)

📝 Siguiente paso: generar evidencia y documentación.
¿Genero la evidencia para {ticket_id}?
```
Si confirma → Leer `ai-specs/.commands/evidence.md` y ejecutar con el ticket ID.

## Estado F: Evidencia generada, sin commit/PR
Hay evidencia en `docs/evidence/` y cambios sin pushear.

→ **Ejecutar commit**:
```
📝 Evidencia lista: docs/evidence/{ticket}.md
   Documentación actualizada: {archivos de docs}

🚀 Siguiente paso: commit + PR + transicionar ticket.
¿Procedemos?
```
Si confirma → Leer `ai-specs/.commands/commit.md` y ejecutar.

## Estado G: Todo completado
Branch mergeada o PR creado. Change archivable.

→ **Ofrecer archivar y siguiente**:
```
🎉 Ciclo completado:
  ✅ Artefactos → ✅ Tickets → ✅ Plan → ✅ Código → ✅ Evidencia → ✅ PR

¿Qué hacemos?
```
AskUserQuestion: "Archivar change y empezar otro" / "Trabajar otro ticket del mismo change" / "Nada por ahora"

# Paso 3: Ejecutar el sub-flujo elegido

## Flujo: Feature Nuevo
Pipeline completo. Ejecutar paso a paso con confirmación entre cada uno:

1. Preguntar: "¿Qué querés construir? Describilo brevemente."
2. Con la descripción → ejecutar el flujo de `/opsx:ff` (leer el archivo y seguir instrucciones)
3. Al terminar artefactos → **automáticamente** pasar a crear tickets (Estado B)
4. Al terminar tickets → preguntar qué ticket trabajar primero (Estado C)
5. Al elegir ticket → ejecutar plan técnico (Estado D)
6. Al terminar plan → ejecutar implementación (Estado E)
7. Al terminar código → ejecutar evidencia (Estado F)
8. Al terminar evidencia → ejecutar commit (Estado G)

**Entre cada paso**: mostrar resumen breve de qué se completó y qué viene, pedir confirmación con AskUserQuestion: "Continuar" / "Pausar acá" / "Saltar este paso"

Si elige "Pausar": mostrar resumen de dónde quedó y decir que `/menu` retoma.
Si elige "Saltar": pasar al siguiente paso con warning de que se salteó.

## Flujo: Ticket Existente
1. Pedir ID del ticket
2. Verificar si necesita enriquecimiento → si le falta detalle, ejecutar enrich-ticket
3. Ejecutar plan técnico
4. Ejecutar implementación
5. Ejecutar evidencia
6. Ejecutar commit

## Flujo: Exploración
1. Ejecutar el flujo de `/opsx:explore`
2. Al terminar: "¿Querés capturar esto como change? Puedo crear los artefactos."
3. Si sí → pasar a Feature Nuevo desde paso 2

## Flujo: Directo
1. Pedir ticket ID o descripción
2. Ejecutar implementación directamente
3. Si tiene ticket → ejecutar evidencia
4. Ejecutar commit

## Flujo: Review PR
1. Pedir número de PR o "current"
2. Ejecutar review-pr

## Flujo: Test Plan
1. Pedir ticket o feature
2. Ejecutar test-plan

## Flujo: Sprint
1. Pedir IDs o buscar sprint activo
2. Confirmar lista
3. Lanzar subagentes en paralelo (max 5)
4. Reportar resultados
5. Preguntar cuál implementar primero → pasar a Estado D

# Reglas de ejecución

1. **Ejecutá los comandos, no los sugieras.** Leé el .md del comando y seguí las instrucciones.
2. **Confirmación antes de cada paso**, pero NO con "corré /comando" sino con "¿Arranco con [descripción]?"
3. **Contexto entre pasos**: cuando termina un paso, pasá el output relevante al siguiente (ej: IDs de tickets creados → plan técnico).
4. **Si algo falla**: reportá qué falló, ofrecé reintentar o saltar al siguiente paso.
5. **Si el usuario interrumpe**: registrar dónde quedó. Al volver a correr `/menu`, retomar desde ahí.
6. **Respuestas cortas entre pasos** — no explicar el sistema, solo mostrar progreso y pedir confirmación.
7. **Modo sprint**: máximo 5 tickets en paralelo, nunca implementar automáticamente.

# Formato de transición entre pasos

Usá este formato al pasar de un paso al siguiente:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ {paso completado}
→  {qué viene ahora}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

AskUserQuestion (single_select): "Continuar" / "Pausar acá"
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
- Code, comments, commits, docs: **{idioma_tecnico}**
- UI text, error messages: **{idioma_ui}**
- Tickets ({tracker}): **{idioma_tickets}**

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
ALL technical documentation, code comments, function descriptions: **{idioma_tecnico}**.
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
