# Role
Senior engineer. Create clear commits, merge to dev, and transition tickets aligned with project standards.

# Arguments
- Empty → commit all relevant changes + merge directo a dev
- Ticket IDs / feature names → commit ONLY those changes
- "dry run" / "just the message" → no-git mode: output message only

# REGLA CRÍTICA: NO crear PR para feature branches
Feature branches (feature/*) se mergean DIRECTO a dev (git merge, sin PR).
Los PR SOLO existen para:
- Release: dev → main (via /release-to-main)
- Hotfix: hotfix/* → main

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

## 6. Merge a dev (directo, sin PR)

> **Flujo**: ticket branch → merge directo a dev → QA prueba en dev → `/release-to-main` crea PR dev → main.
> El PR solo existe cuando va a main (ahí sí hay code review).

### 6.1. Resolver rama de desarrollo

```bash
CURRENT_BRANCH=$(git branch --show-current)
echo "CURRENT_BRANCH=$CURRENT_BRANCH"
```

**Si `CURRENT_BRANCH` empieza con `hotfix/`** → flujo hotfix: crear PR directo a `main` (ver 6.3).

**Si no es hotfix**, resolver `DEV_BRANCH`:

1. **Profile**: leer `Dev Branch` de `.ai-internal/project-profile.md` — si tiene valor, usar esa rama
2. **Auto-detección**: si no hay profile o el campo está vacío:
   ```bash
   git branch -r --list 'origin/dev' 'origin/develop' 'origin/development' | sed 's|origin/||' | head -1 | xargs
   ```
3. **Preguntar**: si no se encuentra ninguna, usar **AskUserQuestion** (single_select):

   "No encontré una rama de desarrollo (`dev`). ¿Cuál es la rama de desarrollo?"

   Opciones: construir dinámicamente con las ramas remotas (excluyendo `main`/`master` y la rama actual) + "Otra rama".

### 6.2. Ejecutar merge a dev

```bash
git fetch origin
git checkout {DEV_BRANCH}
git pull origin {DEV_BRANCH}
git merge {CURRENT_BRANCH} --no-edit
git push origin {DEV_BRANCH}
git checkout {CURRENT_BRANCH}
```

**Si hay conflictos de merge**: NO resolverlos automáticamente. Mostrar:
```
⚠️ Conflictos al mergear {CURRENT_BRANCH} → {DEV_BRANCH}

   Archivos en conflicto:
   {lista de archivos}

   Resolvé los conflictos manualmente y volvé a ejecutar /commit.
```
Hacer `git merge --abort`, volver a la rama original y HALT.

**Si el merge es exitoso**: continuar con paso 7.

### 6.3. Flujo hotfix (solo para branches `hotfix/*`)

Si la rama empieza con `hotfix/`:

```bash
gh --version 2>/dev/null || echo "GH_NOT_FOUND"
```

Si `gh` disponible: crear PR directo a `main` con `[HOTFIX]` en el título.
- Title: `[HOTFIX] {descripción del commit}`
- Description: resumen, link al ticket, notas de testing
- **If evidence exists**: agregar link a evidencia

Si `gh` no disponible: mostrar instrucciones manuales.

Saltar al paso 7.

## 7. Transicionar ticket a QA Review (OBLIGATORIO si hay ticket ID)

> **Flujo**: `/commit` mergea a dev y mueve a **QA Review**.
> El de servidores ve el ticket en QA Review, deploya a dev.
> QA prueba y mueve a **QA Approved** o **QA Failed**.

Si hay ticket ID (de args, branch `feature/<ID>-*`, o prefijo del commit):

### 7.0. Resolver nombre real del status

Leer tracker del profile (`.ai-internal/project-profile.md`).

**Si tracker=jira**: leer `Jira Statuses` para obtener el nombre real del status "QA Review" en este proyecto (puede ser "QA Review", "Code Review", "En QA", "En Revisión", etc.).

**Si tracker=notion**: leer `Notion Statuses` y `Notion Status Property` para obtener el nombre real del status "QA Review" en este proyecto.

Si el profile no tiene statuses configurados o están vacíos → usar nombres por defecto: "QA Review", "QA", "Code Review", "En QA", "En Revisión".

### 7.1. Llamar `sdd_transition_ticket(ticketId)`
El MCP tool retorna instrucciones de delegación con los pasos exactos a ejecutar.

### 7.2. Ejecutar los pasos de delegación
Seguir los pasos que retorna `sdd_transition_ticket`:
1. Llamar `getTransitionsForJiraIssue` con los params indicados
2. Buscar la transición cuyo nombre coincida con el status real de QA Review (del paso 7.0)
3. Llamar `transitionJiraIssue` con el ID de la transición encontrada

### 7.3. Agregar comentario completo para QA

Antes de construir el comentario, recopilar la información:

```bash
# Evidencia
test -f "docs/evidence/${TICKET_ID}.md" && echo "EVIDENCE=YES" || echo "EVIDENCE=NO"
test -f "docs/evidence/screenshots/${TICKET_ID}.png" && echo "SCREENSHOT=YES" || echo "SCREENSHOT=NO"

# Archivos modificados en el branch
git diff {DEV_BRANCH}...{CURRENT_BRANCH} --stat

# Repo URL para links
gh repo view --json url -q .url 2>/dev/null || git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|'

# Figma link (del pipeline state)
# Obtener con sdd_get_state → figmaLink
```

**Si existe evidencia** (`docs/evidence/{TICKET_ID}.md`): leer el archivo para extraer:
- Resumen del cambio
- Tabla de archivos modificados
- Pasos de verificación manual (plan de pruebas para QA)
- Casos edge
- Notas para QA

**Si NO existe evidencia**: construir un resumen básico a partir del diff y el commit message.

**Determinar tipo de proyecto** para elegir template: leer `Tipo` de `.ai-internal/project-profile.md`.

---

#### TEMPLATE BACKEND (tipo contiene "backend")

Llamar `sdd_comment_ticket(ticketId, body)` con:

```
✅ Desarrollo completado — mergeado a {DEV_BRANCH}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Resumen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{resumen conciso de qué se hizo y por qué}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Archivos modificados ({N})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{por cada archivo: ruta | tipo de cambio (nuevo/modificado/eliminado) | descripción breve}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 Endpoints afectados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{por cada endpoint nuevo o modificado:}
{METHOD} {ruta} — {descripción breve del cambio}

{si no hay endpoints afectados: "N/A — cambio interno sin impacto en API"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Plan de pruebas
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{por cada paso de verificación:}
☐ {paso}: {acción a realizar} → Resultado esperado: {qué debe pasar}

{si hay casos edge:}
⚠️ Casos edge:
☐ {caso edge 1}
☐ {caso edge 2}

{si hay notas (ambiente, datos de prueba, dependencias):}
📝 Notas: {notas}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📎 Links
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Evidencia: {GH_REPO_URL}/blob/{DEV_BRANCH}/docs/evidence/{TICKET_ID}.md
🔀 Branch: {CURRENT_BRANCH} → {DEV_BRANCH}
```

---

#### TEMPLATE FRONTEND / FULLSTACK / MOBILE (tipo contiene "frontend", "fullstack" o "mobile")

Llamar `sdd_comment_ticket(ticketId, body)` con:

```
✅ Desarrollo completado — mergeado a {DEV_BRANCH}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Resumen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{resumen conciso de qué se hizo y por qué}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 Diseño
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Figma: {FIGMA_LINK}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Archivos modificados ({N})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{por cada archivo: ruta | tipo de cambio (nuevo/modificado/eliminado) | descripción breve}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️ Pantallas a verificar
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{por cada pantalla/vista afectada:}
• {nombre de la pantalla/ruta} — {qué cambió visualmente}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Plan de pruebas
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{por cada paso de verificación:}
☐ {paso}: {acción a realizar} → Resultado esperado: {qué debe pasar}

{si hay casos edge:}
⚠️ Casos edge:
☐ {caso edge 1}
☐ {caso edge 2}

{si hay notas (ambiente, datos de prueba, dependencias):}
📝 Notas: {notas}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📎 Links
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Evidencia: {GH_REPO_URL}/blob/{DEV_BRANCH}/docs/evidence/{TICKET_ID}.md
📸 Screenshot: {GH_REPO_URL}/blob/{DEV_BRANCH}/docs/evidence/screenshots/{TICKET_ID}.png
🔀 Branch: {CURRENT_BRANCH} → {DEV_BRANCH}
```

---

> **Nota**: El comentario debe ser autocontenido — QA no debería necesitar abrir otros archivos para saber qué probar. Los links son complementarios para evidencia detallada.
> **FIGMA_LINK**: se obtiene del pipeline state (campo `figmaLink` retornado por `sdd_get_state`). Si no hay link, omitir la sección Diseño.

### 7.4. Si la transición falla

**Si no se encuentra transición compatible**:
```
⚠️ TRANSICIÓN PENDIENTE: {TICKET_ID}
   Estado actual: {estado_actual}
   Transiciones disponibles: {lista de nombres}
   Ninguna coincide con QA Review ({nombre_real}).

   ❗ Acción requerida: mover manualmente en el tracker.
```

**Si el MCP del tracker no está disponible**:
```
⚠️ TRANSICIÓN PENDIENTE: {TICKET_ID}
   MCP del tracker no disponible.

   ❗ Acción requerida: mover manualmente en el tracker.
```

**IMPORTANTE**: La falla en la transición NO bloquea el commit/merge (el código ya está subido). Pero SIEMPRE se reporta como acción pendiente.

- No ticket ID → reportar: "Sin ticket ID — no se transicionó ningún ticket"
- No-git mode → skip entirely

## 8. Resumen
Archivos commiteados, scope, merge a dev, estado de transición del ticket, estado de evidencia.

**El resumen SIEMPRE incluye el estado de la transición**:
- ✅ Ticket {ID} transicionado a QA Review — mergeado a {DEV_BRANCH}
- ⚠️ Ticket {ID} NO transicionado — requiere acción manual
- ℹ️ Sin ticket ID asociado

# Rules
- Never `git push --force` without explicit request
- If push rejected: suggest pull/rebase, never force-push
- La transición a QA Review es obligatoria — si falla, reportar como acción pendiente
- Evidence is recommended but not blocking — dev decides
- Idioma del commit y comentarios: según `AGENTS.md` § Language
- NUNCA crear PR para feature branches — merge directo a dev
