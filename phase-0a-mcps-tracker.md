# Phase 0a — MCPs y Tracker

> Sub-fase de `phase-0-detect.md`. Detecta MCPs disponibles, elige tracker (Jira/Notion) y verifica su workflow.
> **Cargá y ejecutá este archivo PRIMERO**, antes de `phase-0b-codebase.md` y `phase-0c-confirm.md`.

---

## 0.0 — Verificar que openspec está instalado y es compatible

```bash
openspec --version 2>&1 || echo "NOT_FOUND"
```

**Si el comando falla o no existe → DETENER completamente** y mostrar:

```
❌ openspec-cli no está instalado o no está en el PATH.

Instalalo con:
  npm install -g openspec-cli

Verificá con:
  openspec --version

Una vez instalado, volvé a correr este prompt.
```

**Si el comando retorna una versión < 0.5.0 → DETENER completamente** y mostrar:

```
❌ openspec-cli versión [VERSION_DETECTADA] es incompatible.
Este prompt requiere openspec-cli >= 0.5.0.

Actualizá con:
  npm install -g openspec-cli@latest

Verificá con:
  openspec --version

Una vez actualizado, volvé a correr este prompt.
```

**No continúes ningún paso siguiente hasta que openspec esté disponible y sea compatible.**

---

## 0.0a — Detectar y limpiar archivos legacy

> Proyectos bootstrapped antes de V4.3 pueden tener archivos obsoletos que interfieren con el flujo actual.

```bash
echo "=== LEGACY FILE DETECTION ==="
test -f .claude/commands/start.md && echo "LEGACY_START_MD=true" || echo "LEGACY_START_MD=false"
test -f .claude/settings.local.json && echo "LEGACY_SETTINGS=true" || echo "LEGACY_SETTINGS=false"
```

**Si `LEGACY_START_MD=true`**:
- Crear backup: `mkdir -p .bootstrap-backup && cp .claude/commands/start.md .bootstrap-backup/start.md`
- Eliminar: `rm .claude/commands/start.md`
- Mostrar: "🗑️ Archivo legacy eliminado: `.claude/commands/start.md` (backup en `.bootstrap-backup/start.md`)"

**Si `LEGACY_SETTINGS=true`**:
- Verificar si contiene credenciales Jira (email/token):
  ```bash
  grep -q "jira\|atlassian\|email\|token" .claude/settings.local.json 2>/dev/null && echo "HAS_JIRA_CREDS=true" || echo "HAS_JIRA_CREDS=false"
  ```
- Si tiene credenciales Jira: mostrar "⚠️ `.claude/settings.local.json` contiene credenciales Jira legacy. Desde V4.2 se usa MCP Atlassian — las credenciales manuales ya no son necesarias."

Si no se detectaron archivos legacy, continuar silenciosamente.

---

## 0.0b — Detectar MCPs disponibles

```bash
# Intentar detectar MCPs disponibles en el entorno
echo "=== MCP DETECTION ==="

# Jira / Atlassian
(claude mcp list 2>/dev/null || echo "") | grep -i "atlassian\|jira" && echo "MCP_ATLASSIAN=available" || echo "MCP_ATLASSIAN=not_found"

# Notion
(claude mcp list 2>/dev/null || echo "") | grep -i "notion" && echo "MCP_NOTION=available" || echo "MCP_NOTION=not_found"

# GitHub
(claude mcp list 2>/dev/null || echo "") | grep -i "github" && echo "MCP_GITHUB=available" || echo "MCP_GITHUB=not_found"

# Figma
(claude mcp list 2>/dev/null || echo "") | grep -i "figma" && echo "MCP_FIGMA=available" || echo "MCP_FIGMA=not_found"

# Playwright
(claude mcp list 2>/dev/null || echo "") | grep -i "playwright" && echo "MCP_PLAYWRIGHT=available" || echo "MCP_PLAYWRIGHT=not_found"

# gh CLI (para PRs)
gh --version 2>/dev/null && echo "GH_CLI=available" || echo "GH_CLI=not_found"
```

Construí internamente:

```
MCPS_DISPONIBLES:
  atlassian: [available | not_found]
  notion: [available | not_found]
  github: [available | not_found]
  figma: [available | not_found]
  playwright: [available | not_found]
  gh_cli: [available | not_found]

  # Nombres reales de tools MCP detectados (para usar en comandos)
  atlassian_prefix: [el prefijo real detectado, ej: "mcp__atlassian__" o "Atlassian:"]
  notion_prefix: [el prefijo real detectado, ej: "mcp__notion__" o "Notion:"]
  github_prefix: [el prefijo real]
  figma_prefix: [el prefijo real]
```

> **Nota**: Si `claude mcp list` no está disponible, no fallar. Marcar todos como "unknown" y preguntar en Fase 1.

---

## 0.0b2 — Elección de tracker

Determinar qué tracker usar basándose en los MCPs disponibles:

- **Si solo MCP_ATLASSIAN=available** (y MCP_NOTION=not_found) → `TRACKER=jira` (automático)
- **Si solo MCP_NOTION=available** (y MCP_ATLASSIAN=not_found) → `TRACKER=notion` (automático)
- **Si ambos disponibles** → Usá **AskUserQuestion** (single_select):
  "¿Qué tracker usás para gestionar tickets?"
  Opciones: "Jira (Atlassian)" / "Notion"
- **Si ninguno disponible** → BLOQUEAR:
  ```
  ❌ No se detectó ningún tracker configurado.

  Necesitás al menos uno:
    - MCP de Atlassian (para Jira) — configurar en Claude Code Settings → MCP Servers
    - MCP de Notion — configurar en Claude Code Settings → MCP Servers

  Configurá al menos un tracker y volvé a ejecutar el bootstrap.
  ```

Guardar el resultado como `TRACKER` (será "jira" o "notion").

Mostrar:
```
✅ Tracker seleccionado: {TRACKER}
```

---

## 0.0c — Configurar tracker (condicional Jira / Notion)

**Si TRACKER=jira**:

> El siguiente bloque solo se ejecuta para proyectos que usan Jira.

**Si MCP_ATLASSIAN=not_found → BLOQUEAR inmediatamente** y mostrar:

```
❌ MCP de Atlassian no está configurado.

Configuralo en Claude Code antes de ejecutar el bootstrap.
Sin Atlassian MCP no se pueden crear ni gestionar tickets.

Instrucciones:
  1. Configurá el MCP de Atlassian en Claude Code (Settings → MCP Servers)
  2. Verificá que esté autenticado correctamente
  3. Volvé a correr este prompt
```

**No continúes ningún paso siguiente hasta que el MCP de Atlassian esté disponible.**

**Si MCP_ATLASSIAN=available**, ejecutar la detección automática:

1. **Obtener cloudId** — Llamar `getAccessibleAtlassianResources` (usando el `atlassian_prefix` detectado en 0.0b):
   → Retorna lista de sites Atlassian, cada uno con `id` (cloudId), `name`, `url`

   - **Si 1 site** → usar ese `id` como cloudId, guardar el `name` como workspace_name
   - **Si N sites** → Usá **AskUserQuestion** (single_select): "¿Cuál workspace de Atlassian?" con opciones mostrando `name (url)` de cada site
   - **Si 0 sites o error** → BLOQUEAR:
     ```
     ❌ No se encontraron workspaces en Atlassian.
     Verificá la configuración y autenticación del MCP de Atlassian.
     ```

2. **Obtener project key** — Llamar `getVisibleJiraProjects` con el cloudId obtenido:
   → Retorna lista de proyectos con `key`, `name`

   - **Si 1 proyecto** → usar ese `key` como project_key
   - **Si N proyectos** → Usá **AskUserQuestion** (single_select): "¿Cuál proyecto de Jira?" con opciones mostrando `name (key)` de cada proyecto
   - **Si 0 proyectos** → BLOQUEAR:
     ```
     ❌ No hay proyectos visibles en Jira para este workspace.
     Creá el proyecto en Jira antes de continuar.
     ```

3. **Guardar en PROYECTO_PERFIL**:
   - `tracker`: "jira"
   - `cloud_id`: {el cloudId obtenido}
   - `workspace_name`: {el name del site}
   - `project_key`: {el key del proyecto}

Mostrar confirmación:
```
✅ Jira detectado automáticamente:
   Workspace: {workspace_name} (cloudId: {cloud_id})
   Proyecto: {project_key}
```

---

**Si TRACKER=notion**:

> El siguiente bloque solo se ejecuta para proyectos que usan Notion.

1. **Buscar databases del workspace** — Llamar `API-post-search` (usando el `notion_prefix` detectado en 0.0b) con filter `{value: "database", property: "object"}`:
   → Retorna lista de databases con `id`, `title`, `properties`

   - **Si 1 database** → usarla automáticamente
   - **Si N databases** → Usá **AskUserQuestion** (single_select): "¿Cuál database de Notion usás para tickets?" con opciones mostrando el título de cada database
   - **Si 0 databases o error** → BLOQUEAR:
     ```
     ❌ No se encontraron databases en Notion.
     Verificá la configuración y permisos del MCP de Notion.
     ```

2. **Verificar propiedad unique_id** — De las propiedades de la database seleccionada, buscar una con type `unique_id`:
   - **Si existe** → guardar el nombre de la propiedad (ej: "ID", "Task ID")
   - **Si no existe** → BLOQUEAR:
     ```
     ❌ La database de Notion no tiene una propiedad de tipo "Unique ID".

     Esta propiedad es necesaria para generar IDs auto-incrementales (ej: PROJ-1, PROJ-2).

     Acción requerida:
       1. Abrí la database en Notion
       2. Agregá una propiedad de tipo "Unique ID"
       3. Volvé a ejecutar el bootstrap
     ```

3. **Detectar propiedad de status** — Buscar una propiedad con type `status` o `select` que tenga valores equivalentes a estados de workflow:
   - Guardar el nombre de la propiedad (ej: "Status", "Estado")
   - Si no se encuentra → usar "Status" como default y advertir

4. **Guardar en PROYECTO_PERFIL**:
   - `tracker`: "notion"
   - `notion_database_id`: {el id de la database}
   - `notion_database_name`: {el título de la database}
   - `notion_status_property`: {el nombre de la propiedad de status}
   - `notion_unique_id_property`: {el nombre de la propiedad unique_id}

Mostrar confirmación:
```
✅ Notion detectado automáticamente:
   Database: {notion_database_name} (ID: {notion_database_id})
   Status property: {notion_status_property}
   Unique ID property: {notion_unique_id_property}
```

---

## 0.0d — Verificar workflow del tracker (condicional Jira / Notion)

**Si TRACKER=jira**: ejecutar el flujo de verificación de columnas Jira existente (abajo).

**Si TRACKER=notion**: ejecutar verificación de propiedades Notion (al final de esta sección).

---

**Verificación Jira** (solo si TRACKER=jira):

> **Por qué**: El flujo depende de columnas específicas en Jira para transicionar tickets automáticamente. Si faltan columnas, `/commit` y `/release-to-main` no van a funcionar.

**Si el paso 0.0c falló** → ya se bloqueó en ese paso, no se llega aquí.

**Si el paso 0.0c fue exitoso**, verificar las columnas del workflow:

1. **Obtener statuses del proyecto** — Llamar `getJiraProjectStatuses` (usando el `atlassian_prefix` detectado) con el cloudId y projectKey obtenidos en 0.0c.

   > Si `getJiraProjectStatuses` no está disponible como tool, usar alternativa: buscar un issue del proyecto con `searchJiraIssuesUsingJql` (JQL: `project = {project_key} ORDER BY created DESC`) y luego llamar `getTransitionsForJiraIssue` para ver las transiciones disponibles. Repetir desde distintos estados si es posible.

2. **Columnas requeridas** — El flujo necesita estos statuses (o equivalentes):

   | Status requerido | Equivalentes aceptados | Usado por |
   |-----------------|----------------------|-----------|
   | **To Do** | Backlog, Open, Abierto, Por Hacer | Estado inicial |
   | **In Progress** | En Progreso, En Desarrollo | Developer trabajando |
   | **QA Review** | QA, En QA, Code Review, En Revisión | `/commit` transiciona aquí — código mergeado a dev, pendiente deploy y QA |
   | **QA Approved** | QA Aprobado, Approved, Aprobado, Ready for Release | `/release-to-main` lee estos |
   | **QA Failed** | QA Rechazado, QA Fallido, Rejected, Rechazado | QA rechaza, dev vuelve a fixear |
   | **Done** | Hecho, Closed, Cerrado, Completado | Post-merge a main |

3. **Matching** — Para cada status requerido, buscar si alguno de los statuses del proyecto coincide (case-insensitive). Un status del proyecto puede matchear por nombre exacto o por cualquiera de los equivalentes.

4. **Mostrar resultado**:

   ```
   ✅ MCP Atlassian autenticado y funcional:
      Workspace: {workspace_name}
      Proyecto: {project_key}

   📋 Columnas del workflow:
      ✅ To Do         → {nombre_real_en_jira}
      ✅ In Progress   → {nombre_real_en_jira}
      ✅ QA Review     → {nombre_real_en_jira}
      ✅ QA Approved   → {nombre_real_en_jira}
      ✅ QA Failed     → {nombre_real_en_jira}
      ✅ Done          → {nombre_real_en_jira}
   ```

   **Si faltan columnas**, mostrar cuáles y bloquear:

   ```
   ⚠️  Columnas faltantes en el workflow de Jira:
      ❌ QA Approved — necesaria para /release-to-main
      ❌ QA Failed   — necesaria para el flujo de rechazo de QA

   El flujo completo requiere estas columnas:
     To Do → In Progress → QA Review → QA Approved / QA Failed → Done

   Acción requerida:
     1. Abrí la configuración del board en Jira
     2. Agregá las columnas faltantes al workflow
     3. Volvé a ejecutar el bootstrap

   ¿Querés continuar sin las columnas faltantes? (el flujo va a funcionar parcialmente)
   ```

   Usar **AskUserQuestion** (single_select):
   - "Continuar sin las columnas faltantes" — marcar como warning, continuar
   - "Detener — voy a configurar Jira primero" — HALT

5. **Guardar en PROYECTO_PERFIL**:
   - `jira_identity`: "mcp_cloud"
   - `jira_statuses`: mapping de cada status requerido al nombre real en Jira (ej: `{"qa_review": "Code Review", "qa_approved": "QA Approved", "qa_failed": "Rejected", ...}`)
   - `jira_statuses_missing`: lista de statuses faltantes (vacía si están todos)

---

**Verificación Notion** (solo si TRACKER=notion):

1. **Obtener propiedades de la database** — Usar la database seleccionada en 0.0c para listar sus propiedades.

2. **Verificar statuses** — De la propiedad de status detectada, verificar que tenga valores equivalentes a:

   | Status requerido | Equivalentes aceptados | Usado por |
   |-----------------|----------------------|-----------|
   | **To Do** | Backlog, Open, Abierto, Por Hacer, Not started | Estado inicial |
   | **In Progress** | En Progreso, En Desarrollo, Doing | Developer trabajando |
   | **QA Review** | QA, En QA, Code Review, En Revisión, In review | `/commit` transiciona aquí |
   | **Done** | Hecho, Closed, Cerrado, Completado, Complete | Post-merge a main |

   > **Nota**: Para Notion no se requieren QA Approved / QA Failed como columnas separadas — se puede manejar con un solo status "Done" o agregando opciones adicionales si el usuario las tiene.

3. **Matching** — Para cada status requerido, buscar si alguno de los valores de la propiedad coincide (case-insensitive).

4. **Mostrar resultado**:

   ```
   ✅ MCP Notion autenticado y funcional:
      Database: {notion_database_name}

   📋 Propiedades del workflow:
      ✅ To Do         → {nombre_real_en_notion}
      ✅ In Progress   → {nombre_real_en_notion}
      ✅ QA Review     → {nombre_real_en_notion}
      ✅ Done          → {nombre_real_en_notion}
   ```

   **Si faltan statuses**, mostrar cuáles y ofrecer continuar con warning (mismo pattern que Jira).

5. **Guardar en PROYECTO_PERFIL**:
   - `notion_statuses`: mapping de cada status requerido al nombre real en Notion (ej: `{"qa_review": "In review", "done": "Complete", ...}`)
   - `notion_statuses_missing`: lista de statuses faltantes (vacía si están todos)

---

**Cuando terminés esta sub-fase**, continuá con `phase-0b-codebase.md`.
