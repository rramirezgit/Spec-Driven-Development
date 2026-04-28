---
name: "Bootstrap: Setup AI Workflow"
description: Configura el sistema completo de flujos AI en este proyecto (V4.13)
category: Setup
tags: [bootstrap, setup, workflow]
---

# Bootstrap AI Workflow V4.13

Sos el orquestador del bootstrap. Tu trabajo es ejecutar las fases en orden, una a la vez, cargando el archivo correspondiente.

## Paso 0: Detectar upgrade pendiente

**ANTES de cualquier otra lógica**, verificar si hay un upgrade pendiente:

```bash
echo "=== UPGRADE CHECK ==="
test -f .ai-internal/.upgrade-pending && echo "UPGRADE_FILE=EXISTS" && cat .ai-internal/.upgrade-pending || echo "UPGRADE_FILE=NOT_FOUND"
test -f .bootstrap-meta.json && echo "META_EXISTS=true" || echo "META_EXISTS=false"
test -f .bootstrap-meta.json && grep -o '"bootstrap_version"[[:space:]]*:[[:space:]]*"[^"]*"' .bootstrap-meta.json | head -1 | cut -d'"' -f4 | xargs echo "CURRENT_VERSION=" || echo "CURRENT_VERSION=none"
test -f .bootstrap-meta.json && grep -o '"content_hash"[[:space:]]*:[[:space:]]*"[^"]*"' .bootstrap-meta.json | head -1 | cut -d'"' -f4 | xargs echo "CURRENT_HASH=" || echo "CURRENT_HASH=none"
```

Determinar `UPGRADE_PENDING`:

1. **Tier 1 — Archivo explícito**: Si `.ai-internal/.upgrade-pending` existe → `UPGRADE_PENDING=true` (leer `from_version`, `to_version`, `trigger`, `from_hash`, `to_hash` del JSON)
2. **Tier 2 — Versión diferente**: Si no existe `.upgrade-pending` pero sí `.bootstrap-meta.json`: comparar la versión de este archivo (`bootstrap_version`) con la versión de este bootstrap (V4.13). Si son distintas → `UPGRADE_PENDING=true` (fallback)
3. **Tier 3 — Hash ausente**: Si la versión es igual PERO `content_hash` está vacío o no existe en `.bootstrap-meta.json` → `UPGRADE_PENDING=true` (el proyecto fue bootstrapped antes de la detección por hash; forzar upgrade para computar el hash inicial)
4. Si no existe `.bootstrap-meta.json` → `UPGRADE_PENDING=false` (instalación nueva, flujo normal)

**Si `UPGRADE_PENDING=true` → ir directamente al Paso 0b: Modo Upgrade. NO seguir con Paso 1.**

Si `UPGRADE_PENDING=false` → continuar con Paso 1 (flujo normal).

---

## Paso 0b: Modo Upgrade

> Este paso se ejecuta SOLO cuando se detecta un upgrade pendiente.
> Ejecuta TODO en una sola invocación (no requiere múltiples runs de /bootstrap).

### 0b.0 — Fail-safe pre-flight (V4.13)

Antes de empezar, verificar que el upgrade no esté huérfano de un intento previo:

```bash
# Si .upgrade-pending lleva más de 2 horas sin tocar, probablemente es huérfano
# de una ejecución anterior que abortó. Avisar al usuario.
if [ -f .ai-internal/.upgrade-pending ]; then
  AGE_MINUTES=$(( ($(date +%s) - $(stat -f %m .ai-internal/.upgrade-pending 2>/dev/null || stat -c %Y .ai-internal/.upgrade-pending 2>/dev/null || echo $(date +%s))) / 60 ))
  if [ "$AGE_MINUTES" -gt 120 ]; then
    echo "⚠️  .upgrade-pending tiene ${AGE_MINUTES} minutos. Probable huérfano de un upgrade anterior que abortó."
    echo "    Si el upgrade anterior completó OK pero el archivo no se borró, podés borrarlo:"
    echo "      rm -f .ai-internal/.upgrade-pending"
    echo "    Si querés reintentar el upgrade ahora, continúa — el flujo regenera todo de forma idempotente."
  fi
fi
```

Si Claude detecta que el upgrade actual aborta a mitad (ej. error en sed, template missing, npm build fail), **NO borrar `.upgrade-pending`** — dejarlo para que el próximo `/bootstrap` retome desde el principio del modo upgrade. El archivo solo se borra cuando el upgrade completa exitosamente (paso 0b.5.G y similar).

### 0b.1 — Leer contexto del upgrade

```bash
echo "=== UPGRADE CONTEXT ==="
cat .ai-internal/.upgrade-pending 2>/dev/null || echo "NO_UPGRADE_FILE"
cat .ai-internal/project-profile.md 2>/dev/null || echo "NO_PROFILE"
```

Parsear del `.upgrade-pending`:
- `from_version`: versión anterior
- `to_version`: versión nueva
- `files_updated`: lista de archivos descargados

Parsear del `project-profile.md`:
- Tipo de proyecto, framework, tracker, nombre, idiomas, MCPs detectados, etc.

**Si `NO_PROFILE`**: Verificar si es un proyecto legacy (pre-meta):

- Si `from_version` es `"pre-meta"` (proyecto bootstrapped antes de V4.3):
  ```bash
  rm -f .ai-internal/.upgrade-pending
  ```
  Mostrar:
  ```
  🔄 Proyecto legacy detectado (pre-meta, sin perfil guardado).
     Se ejecutará bootstrap completo (4 fases) para configurar el sistema desde cero.
     Los archivos obsoletos (start.md, etc.) se limpiarán en Fase 0.
  ```
  **Continuar con Paso 1** (flujo normal — esto ejecutará Phase 0 desde cero, que incluye limpieza legacy).

- Si `from_version` NO es `"pre-meta"`:
  DETENER y mostrar:
  ```
  ❌ No se encontró .ai-internal/project-profile.md
     El upgrade necesita el perfil del proyecto para regenerar archivos adaptados.
     Ejecutá /bootstrap sin upgrade para completar la configuración inicial.
  ```
  Eliminar `.ai-internal/.upgrade-pending` y DETENER.

### 0b.2 — Leer changelog

```bash
echo "=== CHANGELOG ==="
test -f .ai-internal/CHANGELOG.md && cat .ai-internal/CHANGELOG.md || cat .ai-internal/phases/phase-0-detect.md | head -50
```

> Desde V4.13 el changelog vive en `CHANGELOG.md` (raíz del repo, descargado a `.ai-internal/CHANGELOG.md`). Para proyectos pre-V4.13 puede no existir todavía — fallback a leer las primeras líneas de `phase-0-detect.md` (que en versiones viejas tenía el changelog embebido).

Parsear las entradas con formato `## VX.Y — ...` y sus tablas para extraer los cambios relevantes entre `from_version` y `to_version`. Incluir TODAS las versiones intermedias en orden cronológico.

### 0b.3 — Detectar archivos modificados manualmente + gaps de infraestructura

```bash
echo "=== MANUAL MODIFICATIONS ==="
if [ -f .bootstrap-meta.json ]; then
  echo "--- Modified after bootstrap ---"
  find .claude/commands/ -name "menu.md" -newer .bootstrap-meta.json 2>/dev/null && echo "menu.md (modified)" || true
  find ai-specs/.commands/ -name "*.md" -newer .bootstrap-meta.json 2>/dev/null | while read f; do echo "$(basename "$f") (modified)"; done
  test -f CLAUDE.md && [ CLAUDE.md -nt .bootstrap-meta.json ] && echo "CLAUDE.md (modified)" || true
  test -f ai-specs/AI-WORKFLOW-PLAYBOOK.md && [ ai-specs/AI-WORKFLOW-PLAYBOOK.md -nt .bootstrap-meta.json ] && echo "AI-WORKFLOW-PLAYBOOK.md (modified)" || true
fi

echo ""
echo "=== INFRASTRUCTURE GAP DETECTION ==="
# MCP Server pipeline
test -f .mcp.json && echo "MCP_JSON=EXISTS" || echo "MCP_JSON=MISSING"
test -f .mcp.json && grep -q "sdd-pipeline" .mcp.json 2>/dev/null && echo "SDD_PIPELINE_CONFIGURED=true" || echo "SDD_PIPELINE_CONFIGURED=false"
test -f .ai-internal/mcp-server/dist/index.js && echo "MCP_SERVER_COMPILED=true" || echo "MCP_SERVER_COMPILED=false"

# Docs structure
test -d docs && echo "DOCS_DIR=EXISTS" || echo "DOCS_DIR=MISSING"
test -f docs/README.md && echo "DOCS_README=EXISTS" || echo "DOCS_README=MISSING"
test -f docs/api/README.md && echo "DOCS_API=EXISTS" || echo "DOCS_API=MISSING"
test -f docs/evidence/README.md && echo "DOCS_EVIDENCE=EXISTS" || echo "DOCS_EVIDENCE=MISSING"
test -f docs/assets/README.md && echo "DOCS_ASSETS=EXISTS" || echo "DOCS_ASSETS=MISSING"

# AI Workflow Playbook
test -f ai-specs/AI-WORKFLOW-PLAYBOOK.md && echo "PLAYBOOK=EXISTS" || echo "PLAYBOOK=MISSING"

# OpenSpec
test -d .claude/skills && ls .claude/skills/ 2>/dev/null | grep -q "openspec" && echo "OPENSPEC_SKILLS=EXISTS" || echo "OPENSPEC_SKILLS=MISSING"
test -f openspec/config.yaml && echo "OPENSPEC_CONFIG=EXISTS" || echo "OPENSPEC_CONFIG=MISSING"

# Specs
test -f ai-specs/specs/documentation-standards.mdc && echo "DOC_STANDARDS=EXISTS" || echo "DOC_STANDARDS=MISSING"
test -f ai-specs/specs/base-standards.mdc && echo "BASE_STANDARDS=EXISTS" || echo "BASE_STANDARDS=MISSING"

# Pipeline tracker legacy (pre-MCP: estado en markdown)
test -f .ai-internal/pipeline-tracker.md && echo "PIPELINE_TRACKER_LEGACY=EXISTS" || echo "PIPELINE_TRACKER_LEGACY=NOT_FOUND"
test -f .ai-internal/pipeline-state.json && echo "PIPELINE_STATE_JSON=EXISTS" || echo "PIPELINE_STATE_JSON=MISSING"

# Hooks de protección (V4.6+)
test -f .ai-internal/hooks/guard-dangerous-ops.sh && echo "HOOKS_SCRIPTS=EXISTS" || echo "HOOKS_SCRIPTS=MISSING"
grep -q '"hooks"' .claude/settings.local.json 2>/dev/null && echo "HOOKS_CONFIGURED=true" || echo "HOOKS_CONFIGURED=false"

# Jira MCP (V4.3+) + Jira columns (V4.6+)
echo ""
echo "=== TRACKER MCP ==="
# Verificar MCP del tracker configurado
TRACKER_TYPE=$(grep "^# Tracker:" .ai-internal/project-profile.md 2>/dev/null | sed 's/^# Tracker: //')
echo "TRACKER_TYPE=$TRACKER_TYPE"
if [ "$TRACKER_TYPE" = "notion" ]; then
  (claude mcp list 2>/dev/null || echo "") | grep -i "notion" && echo "TRACKER_MCP=CONNECTED" || echo "TRACKER_MCP=NOT_CONNECTED"
else
  (claude mcp list 2>/dev/null || echo "") | grep -i "atlassian\|jira" && echo "TRACKER_MCP=CONNECTED" || echo "TRACKER_MCP=NOT_CONNECTED"
fi
```

Construir dos listas:

**`ARCHIVOS_MODIFICADOS_MANUALMENTE`**: archivos que el usuario editó después del último bootstrap.

**`GAPS_INFRAESTRUCTURA`**: componentes que NO existen y deben crearse. Cada gap tiene un tipo:

| Gap | Condición | Desde versión |
|-----|-----------|---------------|
| `MCP_JSON` | `.mcp.json` no existe o no tiene `sdd-pipeline` | V4.3 |
| `MCP_SERVER` | `.ai-internal/mcp-server/dist/index.js` no existe | V4.3 |
| `DOCS_STRUCTURE` | `docs/` no existe o le faltan archivos base | V4.1 |
| `PLAYBOOK` | `ai-specs/AI-WORKFLOW-PLAYBOOK.md` no existe | V4 |
| `OPENSPEC_SKILLS` | `.claude/skills/openspec-*/` no existen | V4 |
| `DOC_STANDARDS` | _(ya no es gap — se regenera siempre desde template)_ | V4.6 |
| `BASE_STANDARDS` | `ai-specs/specs/base-standards.mdc` no existe | V4 |
| `PIPELINE_MIGRATE` | `pipeline-tracker.md` existe (legacy) y `pipeline-state.json` no | pre-V4.3 |
| `HOOKS` | Hooks de protección no configurados | V4.6 |
| `TRACKER_MCP` | MCP del tracker (Atlassian o Notion) no conectado (verificar config) | V4.3 |

### 0b.4 — Pedir confirmacion al usuario

Usá AskUserQuestion (single_select) con este formato:

```
🔄 Upgrade V{from_version} → V{to_version}

Cambios en esta versión:
  - {cambio 1 del changelog}
  - {cambio 2 del changelog}
  ...

Archivos que se regeneran:
  ✏️  .claude/commands/opsx/ (10 comandos)
  ✏️  ai-specs/.commands/ (10 comandos + 1 agente)
  ✏️  .claude/commands/menu.md
  ✏️  ai-specs/.commands/develop-{tipo}.md
  ✏️  ai-specs/.commands/plan-{tipo}-ticket.md
  ✏️  ai-specs/.commands/enrich-ticket.md
  ✏️  .claude/commands/create-{tracker}-tickets.md
  ✏️  ai-specs/specs/documentation-standards.mdc
  📝 .bootstrap-meta.json (versión actualizada)

{si hay GAPS_INFRAESTRUCTURA, mostrar esta sección:}
Componentes nuevos que se crean (no existían en V{from_version}):
  {si MCP_JSON:}      🆕 .mcp.json (configuración sdd-pipeline)
  {si MCP_SERVER:}    🆕 MCP server compilado (.ai-internal/mcp-server/dist/)
  {si DOCS_STRUCTURE:} 🆕 docs/ (estructura base con contenido)
  {si PLAYBOOK:}      🆕 ai-specs/AI-WORKFLOW-PLAYBOOK.md (guía completa)
  {si OPENSPEC_SKILLS:} 🆕 .claude/skills/openspec-*/ (via openspec init)
  {si BASE_STANDARDS:} 🆕 ai-specs/specs/base-standards.mdc
  {si PIPELINE_MIGRATE:} 🔄 pipeline-tracker.md → pipeline-state.json (migración de estado)
  {si HOOKS:}            🛡️ Hooks de protección (.ai-internal/hooks/ + settings)
  {si TRACKER_MCP:}       ⚠️ MCP del tracker no conectado (verificar configuración)

Archivos que NO se tocan:
  🔒 .ai-internal/project-profile.md
  🔒 CLAUDE.md (si fue editado manualmente)
  🔒 ai-specs/specs/{tipo}-standards.mdc (si fue editado)
  🔒 openspec/config.yaml (si existe)

{si hay archivos modificados manualmente:}
  ⚠️  Archivos modificados manualmente detectados:
      {lista} → se hará backup antes de sobreescribir

¿Proceder con el upgrade?
```

Opciones: "Proceder con el upgrade" / "Cancelar (mantener versión actual)"

Si el usuario cancela:
```bash
rm -f .ai-internal/.upgrade-pending
```
Mostrar "Upgrade cancelado. Los archivos de fase se actualizaron pero los archivos adaptados mantienen la versión anterior." y DETENER.

### 0b.5 — Ejecutar upgrade

**Todo esto se ejecuta en la misma invocación:**

#### Paso A: Backups de archivos modificados manualmente

Si `ARCHIVOS_MODIFICADOS_MANUALMENTE` no está vacío:
```bash
BACKUP_DIR=".bootstrap-backup/upgrade-$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
# Para cada archivo modificado manualmente:
# cp {archivo} "$BACKUP_DIR/"
```

#### Paso B: Re-ejecutar Fase 1 (reusables)

Leer `.ai-internal/phases/phase-1-reusables.md` y ejecutar sus instrucciones para sobreescribir:
- Los 10 comandos OPSX en `.claude/commands/opsx/`
- Los 10 comandos AI en `ai-specs/.commands/`
- El agente en `ai-specs/.agents/`

Estos son idénticos en todos los proyectos → siempre se sobreescriben sin preguntar.

#### Paso C: Re-ejecutar Fase 2 (adaptados)

**Primero**: Generar `project-vars.sh` si no existe (proyectos pre-V4.6 no lo tienen):

```bash
if [ ! -f .ai-internal/project-vars.sh ]; then
  echo "Generando project-vars.sh desde project-profile.md..."
fi
```

Si no existe: leer las instrucciones de generación de `project-vars.sh` en `.ai-internal/phases/phase-0c-confirm.md` (sección "GUARDAR ESTADO") y ejecutarlas usando los datos del `project-profile.md` existente.

**Después**: Leer `.ai-internal/phases/phase-2-adapted.md` y usar los datos del `project-profile.md` existente para regenerar:
- `.claude/commands/menu.md` — **IMPORTANTE: este archivo se genera desde template con `sed`, NO por Claude. Seguir las instrucciones de phase-2-adapted.md al pie de la letra.**
- `ai-specs/.commands/develop-{tipo}.md`
- `ai-specs/.commands/plan-{tipo}-ticket.md`
- `ai-specs/.commands/enrich-ticket.md`
- `.claude/commands/create-{tracker}-tickets.md`
- `ai-specs/specs/documentation-standards.mdc` — **template-based: siempre regenerar con sed**
- `ai-specs/specs/base-standards.mdc` (si gap `BASE_STANDARDS`)

**Ejecutar la validación 5.1 de phase-2-adapted.md** después de regenerar todos los archivos. Si la validación falla, corregir antes de continuar.

**NO re-preguntar datos del proyecto** — usar el profile existente.

#### Paso D: Rellenar gaps de infraestructura

Este paso detecta componentes que no existían en la versión anterior del proyecto y los crea. **Solo se ejecutan los gaps detectados en 0b.3** — si el componente ya existe, se salta.

##### D.1 — Gap `DOCS_STRUCTURE`: Crear estructura /docs

Si `docs/` no existe o le faltan archivos base:

Leer las instrucciones del paso 5b de `.ai-internal/phases/phase-3-finalize.md` y ejecutarlas usando los datos del `project-profile.md`. Esto crea:
- `docs/README.md` — índice con estructura del proyecto
- `docs/api/README.md` — convenciones API
- `docs/evidence/README.md` — estándares de evidencia
- `docs/assets/README.md` — convenciones de diagramas
- `docs/components/README.md` (solo si frontend)

**Solo crear archivos que no existan** — si `docs/README.md` ya existe, no sobreescribirlo.

##### D.2 — Gap `PLAYBOOK`: Crear AI-WORKFLOW-PLAYBOOK.md

Si `ai-specs/AI-WORKFLOW-PLAYBOOK.md` no existe:

Leer las instrucciones del `AI-WORKFLOW-PLAYBOOK.md` template en `.ai-internal/phases/phase-3-finalize.md` y generarlo con los datos del `project-profile.md`. Incluye las 10 secciones: Vista general, Estructura, Flujos, Comandos, Agentes, Integraciones, Standards, Replicar, Ampliar, Bootstrap.

Si ya existe pero la versión es antigua (no menciona `sdd-pipeline` ni `/evidence`): regenerarlo con backup del anterior.

##### D.3 — Gap `MCP_SERVER`: Compilar MCP server

Si `.ai-internal/mcp-server/dist/index.js` no existe pero `.ai-internal/mcp-server/package.json` sí:

```bash
cd .ai-internal/mcp-server && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null
cd - >/dev/null
test -f .ai-internal/mcp-server/dist/index.js && echo "MCP_COMPILED=OK" || echo "MCP_COMPILED=FAIL"
```

Si la compilación falla, mostrar instrucciones manuales pero **no detener** el upgrade.

##### D.4 — Gap `MCP_JSON`: Configurar .mcp.json

Si `.mcp.json` no existe:
```json
{
  "mcpServers": {
    "sdd-pipeline": {
      "command": "node",
      "args": [".ai-internal/mcp-server/dist/index.js"]
    }
  }
}
```

Si `.mcp.json` existe pero no tiene `sdd-pipeline`: leer el archivo, parsear el JSON, agregar `sdd-pipeline` al objeto `mcpServers` sin modificar los servers existentes, y escribir el archivo actualizado.

##### D.5 — Gap `OPENSPEC_SKILLS`: Inicializar OpenSpec skills

Si `.claude/skills/openspec-*/` no existen y `openspec` está disponible:

```bash
command -v openspec >/dev/null 2>&1 && echo "OPENSPEC_AVAILABLE" || echo "OPENSPEC_NOT_FOUND"
```

Si disponible:
```bash
openspec init
```

Si no disponible: mostrar aviso pero no detener:
```
⚠️ openspec-cli no encontrado. Las skills de OpenSpec no se crearon.
   Instalá con: npm install -g openspec-cli
   Luego ejecutá: openspec init
```

##### D.6 — Gap `PIPELINE_MIGRATE`: Migrar pipeline-tracker.md → pipeline-state.json

Si `.ai-internal/pipeline-tracker.md` existe (formato legacy pre-MCP) y `.ai-internal/pipeline-state.json` NO existe:

1. Leer `.ai-internal/pipeline-tracker.md`
2. Parsear el contenido markdown para extraer:
   - **Estado** actual del pipeline (buscar `**Estado**:` o `Estado:` → uno de: IDLE, ARTEFACTOS, TICKETS, PLAN, IMPLEMENTACION, EVIDENCIA, COMMIT, COMPLETADO)
   - **Change** activo (buscar `**Change**:` o `Change:`)
   - **Ticket activo** (buscar `**Ticket activo**:`)
   - **Tickets** de la tabla (filas que matchean `| PROJ-123 | título | ...`)
3. Si el estado parseado no es válido → usar `IDLE`
4. Generar `.ai-internal/pipeline-state.json`:

```json
{
  "state": "{estado_parseado}",
  "change": "{change_o_null}",
  "activeTicket": "{ticket_activo_o_null}",
  "tickets": [
    {"id": "{ticket_id}", "title": "{titulo}", "qaTransition": null}
  ],
  "mcpAvailable": true,
  "log": [
    {
      "timestamp": "{fecha_ISO}",
      "action": "MIGRATED_FROM_TRACKER_MD",
      "detail": "Estado migrado desde pipeline-tracker.md por upgrade V{from} → V{to}"
    }
  ]
}
```

5. Hacer backup del tracker viejo:
```bash
mv .ai-internal/pipeline-tracker.md .ai-internal/pipeline-tracker.md.bak
```

6. Mostrar: "Migrado pipeline: {estado} (change: {change}, tickets: {N})"

Si `.ai-internal/pipeline-state.json` ya existe: no hacer nada (ya fue migrado o creado por el MCP server).

Si no existe `pipeline-tracker.md` ni `pipeline-state.json`: crear estado IDLE:
```json
{
  "state": "IDLE",
  "change": null,
  "activeTicket": null,
  "tickets": [],
  "mcpAvailable": true,
  "log": []
}
```

##### D.7 — Gap `TRACKER_MCP`: Verificar MCP del tracker conectado

Si `TRACKER_MCP=NOT_CONNECTED`:

Mostrar advertencia pero **no bloquear** el upgrade:

```
⚠️ MCP del tracker no detectado.
   Sin el MCP no se pueden crear ni gestionar tickets desde Claude Code.

   Para configurarlo:
   1. Abrí Claude Code Settings → MCP Servers
   2. Agregá el MCP correspondiente (Atlassian para Jira, Notion para Notion)
   3. Autenticá con tu cuenta

   El upgrade continúa normalmente — configurá el MCP cuando puedas.
```

Si `TRACKER_MCP=CONNECTED`: no hacer nada (ya está funcional).

##### D.8 — Gap `HOOKS`: Configurar hooks de protección

Si `HOOKS_SCRIPTS=EXISTS` y `HOOKS_CONFIGURED=false`:

```bash
chmod +x .ai-internal/hooks/*.sh
```

Leer `.claude/settings.local.json` existente y agregar la configuración de hooks:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/pre-compact-marker.sh"}]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/post-compact-reminder.sh"}]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/guard-dangerous-ops.sh"}]
      },
      {
        "matcher": "mcp__.*[Aa]tlassian.*bulk|mcp__.*[Aa]tlassian.*delete[Ii]ssue",
        "hooks": [{"type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.ai-internal/hooks/guard-dangerous-ops.sh"}]
      }
    ]
  }
}
```

Preservar los campos existentes de `.claude/settings.local.json` (especialmente `permissions`). Solo agregar/sobreescribir la sección `hooks`.

Si `HOOKS_SCRIPTS=MISSING`: los hooks no se descargaron. Mostrar:
```
⚠️ Hook scripts no encontrados en .ai-internal/hooks/
   Re-ejecutá install-bootstrap.sh para descargarlos.
```

Si `HOOKS_CONFIGURED=true`: no hacer nada (ya configurados).

#### Paso E: Actualizar metadata

Actualizar `.bootstrap-meta.json`:
- `bootstrap_version` → nueva versión (4.8)
- `previous_version` → versión anterior
- `content_hash` → computar el hash actual ejecutando:
  ```bash
  cat .ai-internal/phases/phase-*.md .claude/commands/bootstrap.md .ai-internal/mcp-server/src/*.ts .ai-internal/mcp-server/package.json .ai-internal/mcp-server/tsconfig.json .ai-internal/templates/* .ai-internal/reusables/opsx/*.md .ai-internal/reusables/commands/*.md .ai-internal/reusables/agents/*.md .ai-internal/hooks/*.sh 2>/dev/null | shasum -a 256 | cut -d' ' -f1
  ```
- Mantener todos los demás campos intactos (`project_name`, `project_type`, `framework`, `tracker`, `mcps_detected`, etc.)
- Si faltan campos nuevos (ej: `mcps_detected` no existía en versiones anteriores), agregarlos con los valores del `project-profile.md`

#### Paso F: Recompilar MCP server (si fue actualizado y ya estaba compilado)

Si el MCP server ya estaba compilado antes del upgrade (no era un gap) y los archivos fuente fueron actualizados:
```bash
cd .ai-internal/mcp-server && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null
cd - >/dev/null
```

#### Paso G: Limpiar y mostrar resumen

```bash
rm -f .ai-internal/.upgrade-pending
```

Mostrar:

```
✅ Upgrade completado: V{from_version} → V{to_version}

Archivos regenerados:
  ✅ .claude/commands/opsx/ (10 comandos)
  ✅ ai-specs/.commands/ (10 comandos + 1 agente)
  ✅ .claude/commands/menu.md
  ✅ ai-specs/.commands/develop-{tipo}.md
  ✅ ai-specs/.commands/plan-{tipo}-ticket.md
  ✅ ai-specs/.commands/enrich-ticket.md
  ✅ .claude/commands/create-{tracker}-tickets.md
  ✅ ai-specs/specs/documentation-standards.mdc
  ✅ .bootstrap-meta.json (V{to_version})

{si hubo gaps rellenados:}
Componentes nuevos creados:
  {por cada gap rellenado:}
  🆕 {descripción del componente}

{si MCP recompilado:}
  ✅ MCP server recompilado

Preservados:
  🔒 .ai-internal/project-profile.md
  🔒 CLAUDE.md
  🔒 openspec/config.yaml
  {si hubo backups:} 📦 Backups en: {BACKUP_DIR}

{si hubo warnings (ej: openspec no disponible, MCP no compiló):}
Pendientes (resolver manualmente):
  ⚠️  {lista de warnings}

El sistema está actualizado. Podés seguir trabajando normalmente.
```

**DETENER** después del resumen — no continuar con el flujo normal.

---

## Paso 1: Detectar estado actual

```bash
echo "=== BOOTSTRAP STATE ==="
test -f .ai-internal/project-profile.md && echo "PHASE_0=DONE" || echo "PHASE_0=PENDING"
test -d .claude/commands/opsx && ls .claude/commands/opsx/ | wc -l | xargs echo "PHASE_1_FILES=" || echo "PHASE_1=PENDING"
test -f CLAUDE.md && test -f ai-specs/AI-WORKFLOW-PLAYBOOK.md && echo "PHASE_2=DONE" || echo "PHASE_2=PENDING"
test -f .bootstrap-meta.json && echo "PHASE_3=DONE" || echo "PHASE_3=PENDING"
test -d .ai-internal/phases && ls .ai-internal/phases/ | wc -l | xargs echo "PHASE_FILES=" || echo "PHASES_NOT_INSTALLED"
```

## Paso 2: Verificar que las fases están instaladas

Si `PHASES_NOT_INSTALLED`:
```
❌ Los archivos de fase no están instalados.

Corré primero:
  ./install-bootstrap.sh

O descargalos manualmente de tu repo privado a:
  .ai-internal/phases/phase-0-detect.md      (orquestador)
  .ai-internal/phases/phase-0a-mcps-tracker.md
  .ai-internal/phases/phase-0b-codebase.md
  .ai-internal/phases/phase-0c-confirm.md
  .ai-internal/phases/phase-1-reusables.md
  .ai-internal/phases/phase-2-adapted.md
  .ai-internal/phases/phase-3-finalize.md
```
DETENER.

## Paso 3: Determinar qué fase ejecutar

Basándote en el estado:

- Si `PHASE_0=PENDING` → ejecutar fase 0
- Si `PHASE_0=DONE` y `PHASE_1=PENDING` (o PHASE_1_FILES < 10) → ejecutar fase 1
- Si `PHASE_1_FILES=10` y `PHASE_2=PENDING` → ejecutar fase 2
- Si `PHASE_2=DONE` y `PHASE_3=PENDING` → ejecutar fase 3
- Si `PHASE_3=DONE` → ya está todo listo

Mostrá:

```
🔧 AI Workflow Bootstrap V4.13
==============================

Estado:
  {✅|⏳|⬜} Fase 0-2: Detección y perfil
  {✅|⏳|⬜} Fase 3-4: Archivos reusables (10 OPSX + 10 commands + 1 agent)
  {✅|⏳|⬜} Fase 5:   Archivos adaptados al proyecto
  {✅|⏳|⬜} Fase 5b-7: Docs base + OpenSpec + Verificación

Siguiente: Fase {N}
```

Usá AskUserQuestion (single_select): "Continuar con Fase {N}" / "Empezar de cero (re-ejecutar todo)"

Si elige empezar de cero:
```bash
rm -rf .ai-internal/project-profile.md
rm -rf .claude/commands/opsx
rm -rf ai-specs
rm -f CLAUDE.md AGENTS.md .bootstrap-meta.json
```
Y empezar desde fase 0.

## Paso 4: Ejecutar la fase

Leer el archivo de la fase correspondiente y ejecutar sus instrucciones **completas**:

- Fase 0: `cat .ai-internal/phases/phase-0-detect.md` (orquestador delgado — luego carga `phase-0a-mcps-tracker.md`, `phase-0b-codebase.md` y `phase-0c-confirm.md` en orden estricto)
- Fase 1: `cat .ai-internal/phases/phase-1-reusables.md`
- Fase 2: `cat .ai-internal/phases/phase-2-adapted.md`
- Fase 3: `cat .ai-internal/phases/phase-3-finalize.md`

**Leé el archivo completo y seguí TODAS las instrucciones que contiene, en orden.**

Al terminar la fase, mostrá el mensaje de completitud que indica el archivo y recordá que deben ejecutar `/bootstrap` de nuevo para la siguiente fase.

## Guardrails
- UNA SOLA FASE por ejecución — esto es crítico para no perder contexto
- Siempre verificar pre-checks al inicio de cada fase
- Si una fase falla a mitad: reportar qué se completó y qué falta
- Nunca saltear fases
- Si el usuario pide ejecutar una fase específica: verificar que las anteriores estén completas
- El Modo Upgrade es una excepción al guardrail de "una sola fase": ejecuta fases 1+2+gaps+metadata en una sola invocación porque reutiliza el profile existente
- Los gaps de infraestructura (Paso D) solo crean lo que falta — nunca sobreescriben componentes existentes
