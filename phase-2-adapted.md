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

> **Si MULTI_TARGET_MODE == true**: el CLAUDE.md incluye una **tabla de servicios** al inicio (después del título), una entrada por cada subproyecto del array `SDD_SUBPROJECT_SLUGS`. Formato:
>
> ```markdown
> ## Subproyectos (modo multi-target)
>
> | Servicio | Path | Tipo | Framework | Comando dev | Standards |
> |----------|------|------|-----------|-------------|-----------|
> | auth-service | services/auth | backend | NestJS 10 | `/develop-auth-service` | `ai-specs/specs/auth-service-standards.mdc` |
> | payments-service | services/payments | backend | Go 1.22 | `/develop-payments-service` | `ai-specs/specs/payments-service-standards.mdc` |
> | shell | apps/shell | frontend | Next.js 14 | `/develop-shell` | `ai-specs/specs/shell-standards.mdc` |
>
> > **Cada ticket apunta a UN subproyecto.** Antes de planificar, el menú pregunta cuál y registra el target con `sdd_set_target_subproject`. El comando de develop a usar es siempre `/develop-{slug}`.
> ```
>
> Después de la tabla, omitir las secciones genéricas "Architecture" / "Adding a New Resource" / "Key Patterns" del CLAUDE.md base — esos detalles viven ahora en cada `{slug}-standards.mdc`. Mantener solo: comandos globales del repo (si los hay — ej. `pnpm install` en raíz), guidelines transversales (idioma, branching, commits) y el link a la tabla.
>
> **Si el tipo es `monorepo-fullstack` Y MULTI_TARGET_MODE == false**: el CLAUDE.md incluye AMBOS stacks en secciones separadas.
> La sección Architecture tiene subsecciones `### Frontend ({path_front}/)` y `### Backend ({path_back}/)`.
> Los comandos de desarrollo incluyen los de ambos subdirectorios (ej: `cd {path_front} && npm run dev`, `cd {path_back} && npm run start:dev`).
> La sección "Adding a New Resource" tiene dos subsecciones: una para el frontend y otra para el backend.

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
>
> **Si MULTI_TARGET_MODE == true**: generá **un archivo de agent por cada subproyecto** listado en `SDD_SUBPROJECT_SLUGS`. Nombre: `ai-specs/.agents/{slug}-developer.md`. Cada uno con el stack y framework de su subproyecto.
>
> **Si el tipo es `monorepo-fullstack` Y MULTI_TARGET_MODE == false**: generá **DOS** archivos de agent — uno para frontend y otro para backend.
> Cada agent es especialista en su subdirectorio y stack. Los datos de cada uno vienen de la sección `## Subprojects` del `project-profile.md`.

**Para tipo `monorepo-fullstack`**, generar:

1. **`ai-specs/.agents/frontend-developer.md`** — usando los datos de `### frontend` del profile:
   - `{framework}` = framework del subproject frontend
   - Las secciones de expertise cubren: Data Layer, Components, Routing, State, Forms, Styling
   - El campo `description` incluye el path del subdirectorio: "Expert {framework} architect for {nombre} ({path_front}/)"
   - Agregar al Role: "Trabaja exclusivamente en el subdirectorio `{path_front}/`."

2. **`ai-specs/.agents/backend-developer.md`** — usando los datos de `### backend` del profile:
   - `{framework}` = framework del subproject backend
   - Las secciones de expertise cubren: Data Layer/ORM, Controllers/Services, Auth, Validation, Error Handling
   - El campo `description` incluye el path del subdirectorio: "Expert {framework} architect for {nombre} ({path_back}/)"
   - Agregar al Role: "Trabaja exclusivamente en el subdirectorio `{path_back}/`."

**Para otros tipos**, generar UN solo archivo como siempre:

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

> **Si MULTI_TARGET_MODE == true** (microservicios / microfrontends): generá **un develop-{slug}.md por cada subproyecto** listado en `SDD_SUBPROJECT_SLUGS`.
> - Cada archivo se especializa en `{path}/` del subproyecto correspondiente y lee `ai-specs/specs/{slug}-standards.mdc`.
> - El nombre del comando es `/develop-{slug}` (ej: `/develop-auth-service`, `/develop-payments-service`, `/develop-shell-mfe`).
> - Cada ticket elige UN subproyecto target (regla acordada V4.10). Tickets que tocan varios servicios → split en sub-tickets, cada uno con su target.
>
> **Si tipo == `monorepo-fullstack` Y MULTI_TARGET_MODE == false** (1 frontend + 1 backend clásico): generá **DOS** archivos de develop command:
> - `ai-specs/.commands/develop-frontend.md` — especializado en el subdirectorio frontend
> - `ai-specs/.commands/develop-backend.md` — especializado en el subdirectorio backend
>
> Cada archivo sigue la misma estructura pero con el stack y patrones de su subdirectorio.
> En el paso "1. Load context", cada uno lee sus propios standards:
> - Frontend: `ai-specs/specs/frontend-standards.mdc`
> - Backend: `ai-specs/specs/backend-standards.mdc`
>
> En el paso "0. Crear rama", la rama es compartida (un ticket puede tocar front y back).
> El develop-frontend trabaja solo en `{path_front}/` y el develop-backend solo en `{path_back}/`.
>
> **Para tickets que tocan ambos** (solo modo clásico): el usuario ejecuta primero `/develop-backend {ID}` y luego `/develop-frontend {ID}` (o viceversa), ambos en la misma rama feature.

```markdown
# Role

Senior {framework} engineer for {nombre}. Implement production-ready code following established patterns.

# Arguments
- `$1` — Ticket ID or feature description
- `$2` — Design URL (optional)

# Process

## 0. Crear rama para el ticket (obligatorio)

Verificar rama actual:
```bash
git branch --show-current
```

- Si ya estás en una rama `feature/{ID}-*` que coincide con el ticket → continuar
- Si estás en `main`/`master`/`develop` u otra rama → crear rama nueva:

```bash
git checkout -b feature/{ID}-{slug}
```

Donde `{slug}` es el título del ticket en kebab-case (máximo 40 chars, sin caracteres especiales).
Ejemplo: `feature/PROJ-123-login-con-google`

> **NUNCA implementar directamente en `main`/`master`/`develop`.** Cada ticket = una rama.

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

> **⚠️ ESTE ARCHIVO SE GENERA DESDE UN TEMPLATE DESCARGABLE — NO SE GENERA POR CLAUDE.**
> Template en `.ai-internal/templates/enrich-ticket-template.md`.

#### Proceso de generación (determinístico):

```bash
# Verificar template
if [ ! -f .ai-internal/templates/enrich-ticket-template.md ]; then
  echo "ENRICH_TEMPLATE=MISSING"
else
  echo "ENRICH_TEMPLATE=OK"
fi
```

Si `ENRICH_TEMPLATE=MISSING`: DETENER con error "Template de enrich-ticket no encontrado. Ejecutá install-bootstrap.sh primero."

**Leer los valores del project-vars.sh y generar**:

```bash
source .ai-internal/project-vars.sh

echo "Generando enrich-ticket.md desde template..."

sed "s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_IDIOMA_TICKETS__/$SDD_IDIOMA_TICKETS/g; s/__SDD_CRITERIO_PROYECTO__/$SDD_CRITERIO_PROYECTO/g" \
    .ai-internal/templates/enrich-ticket-template.md > ai-specs/.commands/enrich-ticket.md

ENRICH_LINES=$(wc -l < ai-specs/.commands/enrich-ticket.md)
echo "enrich-ticket.md generado ($ENRICH_LINES líneas)"
```

**NO modificar el archivo después de generarlo.** El template es la fuente de verdad.

---

### `ai-specs/.commands/plan-{tipo}-ticket.md`

> **⚠️ ESTE ARCHIVO SE GENERA DESDE UN TEMPLATE DESCARGABLE — NO SE GENERA POR CLAUDE.**
> Template en `.ai-internal/templates/plan-ticket-template.md`.
>
> **Si el tipo es `monorepo-fullstack`**: generá **DOS** archivos de plan:
> - `plan-frontend-ticket.md` (con SDD_TIPO=frontend y SDD_FRAMEWORK del subproject frontend)
> - `plan-backend-ticket.md` (con SDD_TIPO=backend y SDD_FRAMEWORK del subproject backend)

#### Proceso de generación (determinístico):

```bash
# Verificar template
if [ ! -f .ai-internal/templates/plan-ticket-template.md ]; then
  echo "PLAN_TEMPLATE=MISSING"
else
  echo "PLAN_TEMPLATE=OK"
fi
```

Si `PLAN_TEMPLATE=MISSING`: DETENER con error "Template de plan-ticket no encontrado. Ejecutá install-bootstrap.sh primero."

**Leer los valores del project-vars.sh y generar**:

```bash
source .ai-internal/project-vars.sh

if [ "$SDD_MULTI_TARGET_MODE" = "true" ] && [ -n "$SDD_SUBPROJECT_SLUGS" ]; then
  # MULTI-TARGET: un plan-ticket por subproyecto, sufijo = slug
  IFS=',' read -ra SLUG_ARRAY <<< "$SDD_SUBPROJECT_SLUGS"
  EXPECTED_PLANS=${#SLUG_ARRAY[@]}
  GENERATED_PLANS=0
  for SLUG in "${SLUG_ARRAY[@]}"; do
    SLUG_UPPER=$(echo "$SLUG" | tr '[:lower:]-' '[:upper:]_')
    SUB_FRAMEWORK_VAR="SDD_SUB_${SLUG_UPPER}_FRAMEWORK"
    SUB_TYPE_VAR="SDD_SUB_${SLUG_UPPER}_TYPE"
    SUB_FRAMEWORK="${!SUB_FRAMEWORK_VAR:-unknown}"
    SUB_TYPE="${!SUB_TYPE_VAR:-unknown}"
    echo "Generando plan-${SLUG}-ticket.md desde template..."
    sed "s/__SDD_FRAMEWORK__/$SUB_FRAMEWORK/g; s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_TIPO__/$SUB_TYPE/g; s/__SDD_IDIOMA_TECNICO__/$SDD_IDIOMA_TECNICO/g" \
        .ai-internal/templates/plan-ticket-template.md > "ai-specs/.commands/plan-${SLUG}-ticket.md"
    if [ -s "ai-specs/.commands/plan-${SLUG}-ticket.md" ]; then
      PLAN_LINES=$(wc -l < "ai-specs/.commands/plan-${SLUG}-ticket.md")
      echo "plan-${SLUG}-ticket.md generado ($PLAN_LINES líneas)"
      GENERATED_PLANS=$((GENERATED_PLANS + 1))
    else
      echo "❌ FALLO: plan-${SLUG}-ticket.md no se generó o quedó vacío"
    fi
  done
  # Validación post-loop: esperado vs generado
  if [ "$GENERATED_PLANS" -ne "$EXPECTED_PLANS" ]; then
    echo "❌ Multi-target plan generation incompleta: esperado=$EXPECTED_PLANS generado=$GENERATED_PLANS"
    echo "   Re-ejecutá Fase 2 o revisá el project-profile.md."
    exit 1
  fi
  echo "✅ Multi-target plan generation OK ($GENERATED_PLANS/$EXPECTED_PLANS)"
elif [ "$SDD_TIPO" = "monorepo-fullstack" ]; then
  # FULLSTACK CLÁSICO 1+1: mantiene backwards-compat con frontend/backend
  FRONT_FRAMEWORK=$(grep -A5 "### frontend" .ai-internal/project-profile.md | grep "Framework" | sed 's/.*\*\*Framework\*\*: //' | awk '{print $1}')
  BACK_FRAMEWORK=$(grep -A5 "### backend" .ai-internal/project-profile.md | grep "Framework" | sed 's/.*\*\*Framework\*\*: //' | awk '{print $1}')

  echo "Generando plan-frontend-ticket.md desde template..."
  sed "s/__SDD_FRAMEWORK__/$FRONT_FRAMEWORK/g; s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_TIPO__/frontend/g; s/__SDD_IDIOMA_TECNICO__/$SDD_IDIOMA_TECNICO/g" \
      .ai-internal/templates/plan-ticket-template.md > "ai-specs/.commands/plan-frontend-ticket.md"

  echo "Generando plan-backend-ticket.md desde template..."
  sed "s/__SDD_FRAMEWORK__/$BACK_FRAMEWORK/g; s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_TIPO__/backend/g; s/__SDD_IDIOMA_TECNICO__/$SDD_IDIOMA_TECNICO/g" \
      .ai-internal/templates/plan-ticket-template.md > "ai-specs/.commands/plan-backend-ticket.md"

  echo "plan-frontend-ticket.md generado ($(wc -l < ai-specs/.commands/plan-frontend-ticket.md) líneas)"
  echo "plan-backend-ticket.md generado ($(wc -l < ai-specs/.commands/plan-backend-ticket.md) líneas)"
else
  # PLANO: un solo plan-ticket
  TIPO_LOWER=$(echo "$SDD_TIPO" | tr '[:upper:]' '[:lower:]')
  echo "Generando plan-${TIPO_LOWER}-ticket.md desde template..."

  sed "s/__SDD_FRAMEWORK__/$SDD_FRAMEWORK/g; s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_TIPO__/$SDD_TIPO/g; s/__SDD_IDIOMA_TECNICO__/$SDD_IDIOMA_TECNICO/g" \
      .ai-internal/templates/plan-ticket-template.md > "ai-specs/.commands/plan-${TIPO_LOWER}-ticket.md"

  PLAN_LINES=$(wc -l < "ai-specs/.commands/plan-${TIPO_LOWER}-ticket.md")
  echo "plan-${TIPO_LOWER}-ticket.md generado ($PLAN_LINES líneas)"
fi
```

**NO modificar el archivo después de generarlo.** El template es la fuente de verdad.

---

### `.claude/commands/create-{tracker}-tickets.md`

> Si usa Jira → `create-jira-tickets.md`. Si usa Notion → `create-notion-tickets.md`.

> **⚠️ ESTE ARCHIVO SE GENERA DESDE UN TEMPLATE DESCARGABLE — NO SE GENERA POR CLAUDE.**
> Template Jira: `.ai-internal/templates/create-tickets-template.md`
> Template Notion: `.ai-internal/templates/create-tickets-template-notion.md`

#### Proceso de generación (determinístico):

```bash
source .ai-internal/project-vars.sh

TRACKER_LOWER=$(echo "$SDD_TRACKER" | tr '[:upper:]' '[:lower:]')

# Elegir template según tracker
if [ "$TRACKER_LOWER" = "notion" ]; then
  TICKETS_TEMPLATE=".ai-internal/templates/create-tickets-template-notion.md"
else
  TICKETS_TEMPLATE=".ai-internal/templates/create-tickets-template.md"
fi

# Verificar template
if [ ! -f "$TICKETS_TEMPLATE" ]; then
  echo "TICKETS_TEMPLATE=MISSING ($TICKETS_TEMPLATE)"
else
  echo "TICKETS_TEMPLATE=OK ($TICKETS_TEMPLATE)"
fi
```

Si `TICKETS_TEMPLATE=MISSING`: DETENER con error "Template de create-tickets no encontrado. Ejecutá install-bootstrap.sh primero."

**Leer los valores del project-vars.sh y generar**:

```bash
echo "Generando create-${TRACKER_LOWER}-tickets.md desde template..."

sed "s/__SDD_IDIOMA_TICKETS__/$SDD_IDIOMA_TICKETS/g; s/__SDD_TRACKER__/$SDD_TRACKER/g; s/__SDD_CLOUD_ID__/$SDD_CLOUD_ID/g; s/__SDD_PROJECT_KEY__/$SDD_PROJECT_KEY/g; s/__SDD_NOTION_DATABASE_ID__/$SDD_NOTION_DATABASE_ID/g" \
    "$TICKETS_TEMPLATE" > ".claude/commands/create-${TRACKER_LOWER}-tickets.md"

TICKETS_LINES=$(wc -l < ".claude/commands/create-${TRACKER_LOWER}-tickets.md")
echo "create-${TRACKER_LOWER}-tickets.md generado ($TICKETS_LINES líneas)"
```

**NO modificar el archivo después de generarlo.** El template es la fuente de verdad.

---

### `.claude/commands/menu.md`

> Se usa `menu.md` en vez de `start.md` para evitar colisión con el built-in `/status` de Claude Code (fuzzy matching).

> **⚠️ ESTE ARCHIVO SE GENERA DESDE UN TEMPLATE DESCARGABLE — NO SE GENERA POR CLAUDE.**
> El template está en `.ai-internal/templates/menu-template.md` (descargado por `install-bootstrap.sh`).
> Claude SOLO ejecuta los comandos bash de abajo. NO debe "generar", "resumir" ni "simplificar" el contenido.

#### Proceso de generación (determinístico):

```bash
# 1. Verificar que el template existe
if [ ! -f .ai-internal/templates/menu-template.md ]; then
  echo "MENU_TEMPLATE=MISSING"
else
  echo "MENU_TEMPLATE=OK"
fi
```

Si `MENU_TEMPLATE=MISSING`: DETENER con error "Template de menu no encontrado. Ejecutá install-bootstrap.sh primero."

**Leer los valores del project-vars.sh y generar**:

```bash
source .ai-internal/project-vars.sh

echo "Generando menu.md desde template..."
echo "  nombre=$SDD_NOMBRE"
echo "  tracker=$SDD_TRACKER"
echo "  tipo=$SDD_TIPO"

# Generar con sed (determinístico, sin intervención de Claude)
# Placeholders usan formato __SDD_XXX__ para evitar conflictos con BSD sed
sed "s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_TRACKER__/$SDD_TRACKER/g; s/__SDD_TIPO__/$SDD_TIPO/g" \
    .ai-internal/templates/menu-template.md > .claude/commands/menu.md

# Verificar resultado
MENU_LINES=$(wc -l < .claude/commands/menu.md)
echo "menu.md generado ($MENU_LINES líneas)"
```

**NO modificar el archivo después de generarlo.** El template es la fuente de verdad.
**NO generar el contenido del menu manualmente.** Siempre usar el template + sed.

#### Validación post-generación del menu (obligatoria):

```bash
echo "=== VALIDACIÓN MENU.MD ==="
MENU_ERRORS=0

# Markers obligatorios que DEBEN existir en el archivo generado
for MARKER in "sdd_check_config" "sdd_get_state" "sdd_advance" "NUNCA listés el flujo completo" "Sprint Gate" "AskUserQuestion" "HALT" "sdd_register_tickets" "sdd_set_active_ticket" "Protocolo HALT" "7. Release a main"; do
  if grep -q "$MARKER" .claude/commands/menu.md 2>/dev/null; then
    echo "  ✅ $MARKER"
  else
    echo "  ❌ FALTA: $MARKER"
    MENU_ERRORS=$((MENU_ERRORS + 1))
  fi
done

# Verificar longitud mínima (el template completo tiene ~300+ líneas)
MENU_LINES=$(wc -l < .claude/commands/menu.md | tr -d ' ')
if [ "$MENU_LINES" -lt 200 ]; then
  echo "  ❌ menu.md tiene solo $MENU_LINES líneas (mínimo esperado: 200). El template fue truncado o resumido."
  MENU_ERRORS=$((MENU_ERRORS + 1))
else
  echo "  ✅ Longitud: $MENU_LINES líneas"
fi

# Verificar que NO contiene placeholders sin reemplazar (formato __SDD_NOMBRE__)
UNREPLACED=$(grep -c -E '__SDD_[A-Z_]+__' .claude/commands/menu.md 2>/dev/null || echo "0")
if [ "$UNREPLACED" -gt 0 ]; then
  echo "  ❌ $UNREPLACED placeholders __SDD_*__ sin reemplazar"
  grep -E '__SDD_[A-Z_]+__' .claude/commands/menu.md
  MENU_ERRORS=$((MENU_ERRORS + 1))
else
  echo "  ✅ Todos los placeholders reemplazados"
fi

echo ""
if [ "$MENU_ERRORS" -gt 0 ]; then
  echo "❌ menu.md FALLÓ validación ($MENU_ERRORS errores). Regenerar desde template."
else
  echo "✅ menu.md validación OK"
fi
```

**Si la validación falla**: volver a ejecutar el sed desde el template. Si sigue fallando, el template puede estar corrupto — pedir al usuario que re-ejecute `install-bootstrap.sh`.

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

> **⚠️ ESTE ARCHIVO SE GENERA DESDE UN TEMPLATE DESCARGABLE — NO SE GENERA POR CLAUDE.**
> Template en `.ai-internal/templates/doc-standards-template.mdc`.

#### Proceso de generación (determinístico):

```bash
# Verificar template
if [ ! -f .ai-internal/templates/doc-standards-template.mdc ]; then
  echo "DOCSTANDARDS_TEMPLATE=MISSING"
else
  echo "DOCSTANDARDS_TEMPLATE=OK"
fi
```

Si `DOCSTANDARDS_TEMPLATE=MISSING`: DETENER con error "Template de doc-standards no encontrado. Ejecutá install-bootstrap.sh primero."

**Leer los valores del project-vars.sh y generar**:

```bash
source .ai-internal/project-vars.sh

echo "Generando documentation-standards.mdc desde template..."

sed "s/__SDD_NOMBRE__/$SDD_NOMBRE/g; s/__SDD_IDIOMA_TECNICO__/$SDD_IDIOMA_TECNICO/g; s/__SDD_IDIOMA_TICKETS__/$SDD_IDIOMA_TICKETS/g; s/__SDD_FRAMEWORK__/$SDD_FRAMEWORK/g; s/__SDD_TIPO__/$SDD_TIPO/g" \
    .ai-internal/templates/doc-standards-template.mdc > ai-specs/specs/documentation-standards.mdc

DOC_LINES=$(wc -l < ai-specs/specs/documentation-standards.mdc)
echo "documentation-standards.mdc generado ($DOC_LINES líneas)"
```

**NO modificar el archivo después de generarlo.** El template es la fuente de verdad.

---

### `ai-specs/specs/{tipo}-standards.mdc`

> Nombrá según el tipo detectado: `frontend-standards.mdc` | `backend-standards.mdc` | `mobile-standards.mdc`
>
> **Si MULTI_TARGET_MODE == true**: generá **un archivo de standards por cada subproyecto** listado en `SDD_SUBPROJECT_SLUGS`. Nombre: `ai-specs/specs/{slug}-standards.mdc`. Globs apuntan a `{path_subproject}/**`. Cada uno documenta el stack y convenciones específicas del subproyecto (datos del agent que lo analizó en Phase 0b).
>
> **Si tipo == `monorepo-fullstack` Y MULTI_TARGET_MODE == false**: generá **DOS** archivos de standards:
> - `ai-specs/specs/frontend-standards.mdc` — con los datos del subproject frontend, globs apuntando a `{path_front}/**`
> - `ai-specs/specs/backend-standards.mdc` — con los datos del subproject backend, globs apuntando a `{path_back}/**`
>
> Cada archivo documenta el stack, estructura, patrones y convenciones de su subdirectorio específico.

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

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. VALIDACIÓN MENU.MD (generado desde template)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "--- Validación menu.md (template-based) ---"
if [ -f .claude/commands/menu.md ]; then
  MENU_LINES=$(wc -l < .claude/commands/menu.md | tr -d ' ')

  # Markers obligatorios
  for MARKER in "sdd_check_config" "sdd_get_state" "sdd_advance" "NUNCA listés el flujo completo" "Sprint Gate" "AskUserQuestion" "HALT" "sdd_register_tickets" "sdd_set_active_ticket" "Protocolo HALT" "7. Release a main" "sdd_register_branch" "sdd_confirm_implementation" "sdd_register_evidence" "GATE DE MERGE"; do
    if grep -q "$MARKER" .claude/commands/menu.md 2>/dev/null; then
      echo "  ✅ $MARKER"
    else
      echo "  ❌ FALTA: $MARKER"
      ERRORS=$((ERRORS + 1))
    fi
  done

  # Longitud mínima (template completo ~310 líneas)
  if [ "$MENU_LINES" -lt 200 ]; then
    echo "  ❌ menu.md tiene solo $MENU_LINES líneas (mínimo: 200). El template fue truncado."
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ Longitud: $MENU_LINES líneas"
  fi

  # Placeholders __SDD_XXX__ sin reemplazar
  UNREPLACED=$(grep -c '__SDD_' .claude/commands/menu.md 2>/dev/null || echo "0")
  if [ "$UNREPLACED" -gt 0 ]; then
    echo "  ❌ $UNREPLACED placeholders __SDD_*__ sin reemplazar:"
    grep -n '__SDD_' .claude/commands/menu.md | head -5
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ Placeholders reemplazados"
  fi

  # Anti-pattern: si dice "NO ejecuta subcomandos" es la versión vieja
  if grep -q "NO ejecuta subcomandos" .claude/commands/menu.md 2>/dev/null; then
    echo "  ❌ menu.md contiene versión VIEJA (pre-V4.5). Regenerar desde template."
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ .claude/commands/menu.md NO EXISTE"
  ERRORS=$((ERRORS + 1))
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. VALIDACIÓN ARCHIVOS ADAPTADOS (generados por Claude)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "--- Validación archivos adaptados ---"

# develop-{tipo}.md: debe tener secciones clave (monorepo-fullstack tiene 2)
DEVELOP_FILE=$(ls ai-specs/.commands/develop-*.md 2>/dev/null | head -1)
if [ -n "$DEVELOP_FILE" ]; then
  for MARKER in "Load context" "Implementation plan" "Implement following" "Feedback loop" "git checkout -b feature"; do
    if ! grep -q "$MARKER" "$DEVELOP_FILE" 2>/dev/null; then
      echo "  ❌ $DEVELOP_FILE falta: $MARKER"
      ERRORS=$((ERRORS + 1))
    fi
  done
  DLINES=$(wc -l < "$DEVELOP_FILE" | tr -d ' ')
  if [ "$DLINES" -lt 40 ]; then
    echo "  ❌ $DEVELOP_FILE solo $DLINES líneas (mínimo: 40)"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ $DEVELOP_FILE ($DLINES líneas)"
  fi
else
  echo "  ❌ develop-*.md NO EXISTE"
  ERRORS=$((ERRORS + 1))
fi

# plan-{tipo}-ticket.md: debe tener secciones clave
PLAN_FILE=$(ls ai-specs/.commands/plan-*-ticket.md 2>/dev/null | head -1)
if [ -n "$PLAN_FILE" ]; then
  for MARKER in "Load context" "Produce plan" "Implementation Steps" "Testing Checklist"; do
    if ! grep -q "$MARKER" "$PLAN_FILE" 2>/dev/null; then
      echo "  ❌ $PLAN_FILE falta: $MARKER"
      ERRORS=$((ERRORS + 1))
    fi
  done
  PLINES=$(wc -l < "$PLAN_FILE" | tr -d ' ')
  if [ "$PLINES" -lt 30 ]; then
    echo "  ❌ $PLAN_FILE solo $PLINES líneas (mínimo: 30)"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ $PLAN_FILE ($PLINES líneas)"
  fi
  # Verificar placeholders sin reemplazar
  UNREPLACED_P=$(grep -c '__SDD_' "$PLAN_FILE" 2>/dev/null || echo "0")
  if [ "$UNREPLACED_P" -gt 0 ]; then
    echo "  ❌ $PLAN_FILE tiene $UNREPLACED_P placeholders __SDD_*__ sin reemplazar"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ plan-*-ticket.md NO EXISTE"
  ERRORS=$((ERRORS + 1))
fi

# create-{tracker}-tickets.md: debe tener secciones clave
TICKETS_FILE=$(ls .claude/commands/create-*-tickets.md 2>/dev/null | head -1)
if [ -n "$TICKETS_FILE" ]; then
  for MARKER in "Preflight" "Diseñar estructura" "Resumen final" "sprint"; do
    if ! grep -qi "$MARKER" "$TICKETS_FILE" 2>/dev/null; then
      echo "  ❌ $TICKETS_FILE falta: $MARKER"
      ERRORS=$((ERRORS + 1))
    fi
  done
  TLINES=$(wc -l < "$TICKETS_FILE" | tr -d ' ')
  if [ "$TLINES" -lt 50 ]; then
    echo "  ❌ $TICKETS_FILE solo $TLINES líneas (mínimo: 50)"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ $TICKETS_FILE ($TLINES líneas)"
  fi
  # Verificar placeholders sin reemplazar
  UNREPLACED_T=$(grep -c '__SDD_' "$TICKETS_FILE" 2>/dev/null || echo "0")
  if [ "$UNREPLACED_T" -gt 0 ]; then
    echo "  ❌ $TICKETS_FILE tiene $UNREPLACED_T placeholders __SDD_*__ sin reemplazar"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ create-*-tickets.md NO EXISTE"
  ERRORS=$((ERRORS + 1))
fi

# enrich-ticket.md (template-based)
if [ -f ai-specs/.commands/enrich-ticket.md ]; then
  ELINES=$(wc -l < ai-specs/.commands/enrich-ticket.md | tr -d ' ')
  if [ "$ELINES" -lt 20 ]; then
    echo "  ❌ enrich-ticket.md solo $ELINES líneas (mínimo: 20)"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ enrich-ticket.md ($ELINES líneas)"
  fi
  # Verificar placeholders sin reemplazar
  UNREPLACED_E=$(grep -c '__SDD_' ai-specs/.commands/enrich-ticket.md 2>/dev/null || echo "0")
  if [ "$UNREPLACED_E" -gt 0 ]; then
    echo "  ❌ enrich-ticket.md tiene $UNREPLACED_E placeholders __SDD_*__ sin reemplazar"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ enrich-ticket.md NO EXISTE"
  ERRORS=$((ERRORS + 1))
fi

# documentation-standards.mdc (template-based)
if [ -f ai-specs/specs/documentation-standards.mdc ]; then
  DSLINES=$(wc -l < ai-specs/specs/documentation-standards.mdc | tr -d ' ')
  if [ "$DSLINES" -lt 100 ]; then
    echo "  ❌ documentation-standards.mdc solo $DSLINES líneas (mínimo: 100)"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ documentation-standards.mdc ($DSLINES líneas)"
  fi
  UNREPLACED_DS=$(grep -c '__SDD_' ai-specs/specs/documentation-standards.mdc 2>/dev/null || echo "0")
  if [ "$UNREPLACED_DS" -gt 0 ]; then
    echo "  ❌ documentation-standards.mdc tiene $UNREPLACED_DS placeholders __SDD_*__ sin reemplazar"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ documentation-standards.mdc NO EXISTE"
  ERRORS=$((ERRORS + 1))
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. VALIDACIÓN GENERAL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "--- Placeholders sin reemplazar ---"
PLACEHOLDER_HITS=$(grep -rnE "\{[a-z_]{3,}\}" ai-specs/specs/ CLAUDE.md AGENTS.md openspec/config.yaml ai-specs/.agents/ ai-specs/.commands/ .claude/commands/create-*-tickets.md 2>/dev/null | grep -v "node_modules" | grep -v ".git" | grep -v "\.bash" | grep -vE "\{(ID|feature|slug|name|ticket_id|resource|TICKET_ID|branch|DATE|FECHA|modulo|METHOD|qué|descripcion|ruta|campo}\}" | grep -vE "^\s*(#|//|---)" | head -30)

if [ -n "$PLACEHOLDER_HITS" ]; then
  echo "❌ PLACEHOLDERS ENCONTRADOS:"
  echo "$PLACEHOLDER_HITS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No hay placeholders sin reemplazar"
fi

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

echo ""
echo "--- Specs .mdc ---"
for f in ai-specs/specs/*.mdc; do
  if [ -f "$f" ]; then
    TOTAL_LINES=$(wc -l < "$f")
    if [ "$TOTAL_LINES" -lt 20 ]; then
      echo "⚠️  $f tiene solo $TOTAL_LINES líneas — revisar contenido"
      ERRORS=$((ERRORS + 1))
    else
      echo "✅ $f ($TOTAL_LINES líneas)"
    fi
  fi
done

# 4. MCP tools hardcoded
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ $ERRORS problemas detectados. CORREGIR antes de continuar."
  echo ""
  echo "Para menu.md: si falló, re-ejecutar el sed desde .ai-internal/templates/menu-template.md"
  echo "Para otros archivos: regenerar la sección que falta desde el template de phase-2-adapted.md"
else
  echo "✅ Validación de calidad PASADA. Continuando a Fase 6."
fi
```

**Si hay errores**: corregirlos antes de pasar a la Fase 5b.

Para **archivos template-based** (menu.md, enrich-ticket.md, plan-ticket.md, create-tickets.md, documentation-standards.mdc): si falló la validación, volver a ejecutar el `sed` desde el template correspondiente en `.ai-internal/templates/`. Si sigue fallando, el template puede estar corrupto — pedir al usuario que re-ejecute `install-bootstrap.sh`.

Para **otros archivos adaptados** (generados por Claude): regenerar la sección que falta siguiendo el template correspondiente en este archivo. Verificar que el archivo regenerado pasa la validación.

---


---

Mostrá:
```
✅ Fase 5 completada. Archivos adaptados creados y validados.
   Siguiente: ejecutá /bootstrap para Fase final (docs + verificación)
```
