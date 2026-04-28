<!-- sdd-version: 1.0 -->
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

## 2. Evidence check (opcional)

If a ticket ID is identified (from args, branch name, or staged files), opcionalmente verificar si hay doc local de evidencia:

```bash
TICKET_ID="[extracted_ticket_id]"
test -f "docs/evidence/${TICKET_ID}.md" && echo "EVIDENCE_EXISTS" || echo "NO_EVIDENCE"
```

> El archivo local `docs/evidence/{TICKET_ID}.md` es **opcional**. El comentario al ticket (sección 7.3) se construye con la plantilla estándar y NO depende del archivo local. Si existe, podés usarlo como insumo para redactar; si no, redactás directamente desde el diff.

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

Después del commit local, **antes** de cualquier `git push`:

1. Mostrar el estado al usuario: rama actual, último commit (subject + 1 línea), si la rama existe en remoto o es nueva.
2. **AskUserQuestion** (single_select): `"¿Pushear {CURRENT_BRANCH} a origin?"`
   Opciones:
   - `"Sí, pushear"` → ejecutar `git push -u origin <branch>` (con `-u` si la rama es nueva).
   - `"No pushear todavía"` → HALT con mensaje: "Commit local hecho. Pushea manualmente cuando quieras."
3. Solo después de respuesta afirmativa: ejecutar el push.

> **Por qué**: el guard hook (V4.11+) ya no bloquea push a `dev` ni a feature branches.
> La confirmación interactiva pasa a hacerse acá en `/commit` para que el usuario
> tenga siempre un punto de control antes de subir código a remoto.

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
```

**Antes del `git push origin {DEV_BRANCH}`** (push del merge a remoto):

1. Mostrar resumen: archivos mergeados, número de commits incorporados, head local vs remoto.
2. **AskUserQuestion** (single_select): `"¿Pushear el merge a origin/{DEV_BRANCH}?"`
   Opciones:
   - `"Sí, pushear merge a {DEV_BRANCH}"` → ejecutar `git push origin {DEV_BRANCH}`.
   - `"No pushear todavía — quiero revisar"` → HALT. Dejar el merge local hecho. Volver a la rama original con `git checkout {CURRENT_BRANCH}` y avisar: "Merge local hecho en {DEV_BRANCH}. No se pushea hasta que confirmes."
3. Solo después de respuesta afirmativa:
   ```bash
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

### 7.3. Agregar comentario estándar al ticket

El comentario es **una plantilla fija**, igual para todos los tipos de proyecto (backend, frontend, fullstack, mobile, infra). Tiene **dos secciones obligatorias**, ambas redactadas en lenguaje **no técnico** — entendibles por QA, PM o cualquier persona del negocio sin necesidad de abrir el código.

#### Cómo redactar cada sección

**📋 Qué se hizo**: 3 a 6 frases en lenguaje claro. Describir el cambio desde la perspectiva de quien usa el producto.
- ✅ Sí: "Ahora el usuario puede recuperar su contraseña desde la pantalla de login."
- ❌ No: nombres de archivos, librerías, endpoints, funciones, métodos HTTP, rutas de código, nombres de tablas, frameworks.

**🧪 Cómo probarlo**: pasos numerados que cualquier persona pueda seguir, en lenguaje de usuario final.
- ✅ Sí: "1. Entrar a la pantalla de login. 2. Tocar 'Olvidé mi contraseña'. 3. Verificar que llega un email."
- ❌ No: "llamar al endpoint POST /auth/reset", "verificar el insert en la tabla users".

**⚠️ A tener en cuenta** (opcional, omitir el bloque si no aplica): limitaciones o casos especiales en lenguaje no técnico.

#### Plantilla — usar exactamente esta estructura

Llamar `sdd_comment_ticket(ticketId, body)` con:

```
✅ Trabajo completado — {TICKET_ID}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Qué se hizo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{3 a 6 frases en lenguaje no técnico explicando qué cambió desde la perspectiva del usuario o del negocio. Sin nombres técnicos.}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Cómo probarlo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. {Acción concreta — "entrar a X", "tocar Y", "completar el formulario con tales datos"}
2. {Acción concreta}
3. {Resultado esperado — "debería ver Z", "debería recibir el email"}

{si hay un caso especial o limitación, agregar al final:}
⚠️ A tener en cuenta:
- {Limitación o caso especial en lenguaje no técnico}
```

---

> **Reglas**:
> - **Misma plantilla para todos los tipos de proyecto.** No hay variantes por backend/frontend/fullstack/mobile.
> - **Sin links a Figma, screenshots, evidencia local, branches, archivos modificados ni endpoints.** El comentario es 100 % autocontenido y legible por no programadores.
> - **Idioma**: según `AGENTS.md` § Language. Si no hay AGENTS.md, español.
> - Si el cambio es puramente interno (refactor, infra) y no hay nada visible para el usuario final, redactar "Qué se hizo" en términos del impacto (ej. "El sistema ahora responde más rápido al guardar formularios") y "Cómo probarlo" como verificación funcional ("Entrar a X y guardar — debería responder igual que antes, sin errores").

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