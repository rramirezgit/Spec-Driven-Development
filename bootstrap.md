---
name: "Bootstrap: Setup AI Workflow"
description: Configura el sistema completo de flujos AI en este proyecto (V4.2)
category: Setup
tags: [bootstrap, setup, workflow]
---

# Bootstrap AI Workflow V4.2

Sos el orquestador del bootstrap. Tu trabajo es ejecutar las fases en orden, una a la vez, cargando el archivo correspondiente.

## Paso 0: Detectar upgrade pendiente

**ANTES de cualquier otra lógica**, verificar si hay un upgrade pendiente:

```bash
echo "=== UPGRADE CHECK ==="
test -f .ai-internal/.upgrade-pending && echo "UPGRADE_FILE=EXISTS" && cat .ai-internal/.upgrade-pending || echo "UPGRADE_FILE=NOT_FOUND"
test -f .bootstrap-meta.json && echo "META_EXISTS=true" || echo "META_EXISTS=false"
test -f .bootstrap-meta.json && grep -o '"bootstrap_version"[[:space:]]*:[[:space:]]*"[^"]*"' .bootstrap-meta.json | head -1 | cut -d'"' -f4 | xargs echo "CURRENT_VERSION=" || echo "CURRENT_VERSION=none"
```

Determinar `UPGRADE_PENDING`:

1. Si `.ai-internal/.upgrade-pending` existe → `UPGRADE_PENDING=true` (leer `from_version` y `to_version` del JSON)
2. Si no existe `.upgrade-pending` pero sí `.bootstrap-meta.json`: comparar la versión de este archivo (`bootstrap_version`) con la versión de este bootstrap (V4.2). Si son distintas → `UPGRADE_PENDING=true` (fallback)
3. Si no existe `.bootstrap-meta.json` → `UPGRADE_PENDING=false` (instalación nueva, flujo normal)

**Si `UPGRADE_PENDING=true` → ir directamente al Paso 0b: Modo Upgrade. NO seguir con Paso 1.**

Si `UPGRADE_PENDING=false` → continuar con Paso 1 (flujo normal).

---

## Paso 0b: Modo Upgrade

> Este paso se ejecuta SOLO cuando se detecta un upgrade pendiente.
> Ejecuta TODO en una sola invocación (no requiere múltiples runs de /bootstrap).

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
- Tipo de proyecto, framework, tracker, etc. (todo lo necesario para regenerar archivos adaptados)

### 0b.2 — Leer changelog

```bash
echo "=== CHANGELOG ==="
head -35 .ai-internal/phases/phase-0-detect.md
```

Parsear las líneas que empiezan con `> -` del bloque `Changelog V{from} → V{to}` para extraer los cambios relevantes.

### 0b.3 — Detectar archivos modificados manualmente

```bash
echo "=== MANUAL MODIFICATIONS ==="
if [ -f .bootstrap-meta.json ]; then
  echo "--- Modified after bootstrap ---"
  find .claude/commands/ -name "menu.md" -newer .bootstrap-meta.json 2>/dev/null && echo "menu.md (modified)" || true
  find ai-specs/.commands/ -name "*.md" -newer .bootstrap-meta.json 2>/dev/null | while read f; do echo "$(basename "$f") (modified)"; done
  test -f CLAUDE.md && [ CLAUDE.md -nt .bootstrap-meta.json ] && echo "CLAUDE.md (modified)" || true
fi
```

Construir lista `ARCHIVOS_MODIFICADOS_MANUALMENTE`.

### 0b.4 — Pedir confirmación al usuario

Usá AskUserQuestion (single_select) con este formato:

```
🔄 Upgrade V{from_version} → V{to_version}

Cambios en esta versión:
  - {cambio 1 del changelog}
  - {cambio 2 del changelog}
  ...

Archivos que se regeneran:
  ✏️  .claude/commands/menu.md
  ✏️  ai-specs/.commands/develop-{tipo}.md
  ✏️  ai-specs/.commands/plan-{tipo}-ticket.md
  ✏️  ai-specs/.commands/enrich-ticket.md
  ✏️  .claude/commands/create-{tracker}-tickets.md
  🔧 .ai-internal/mcp-server/ (recompilado si cambió)
  📝 .bootstrap-meta.json (versión actualizada)

Archivos que NO se tocan:
  🔒 .ai-internal/project-profile.md
  🔒 CLAUDE.md (si fue editado manualmente)
  🔒 ai-specs/specs/*.mdc (si fueron editados)
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
- Los 9 comandos AI en `ai-specs/.commands/`
- El agente en `ai-specs/.agents/`

Estos son idénticos en todos los proyectos → siempre se sobreescriben sin preguntar.

#### Paso C: Re-ejecutar Fase 2 (adaptados)

Leer `.ai-internal/phases/phase-2-adapted.md` y usar los datos del `project-profile.md` existente para regenerar:
- `.claude/commands/menu.md`
- `ai-specs/.commands/develop-{tipo}.md`
- `ai-specs/.commands/plan-{tipo}-ticket.md`
- `ai-specs/.commands/enrich-ticket.md`
- `.claude/commands/create-{tracker}-tickets.md`

**NO re-preguntar datos del proyecto** — usar el profile existente.

#### Paso D: Actualizar metadata

```bash
# Leer .bootstrap-meta.json actual, actualizar la versión
```

Actualizar `.bootstrap-meta.json`:
- `bootstrap_version` → nueva versión (V4.2)
- `previous_version` → versión anterior
- Mantener todos los demás campos intactos (project_name, project_type, etc.)

#### Paso E: Recompilar MCP server (si es necesario)

Si `.ai-internal/mcp-server/` fue actualizado:
```bash
cd .ai-internal/mcp-server && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null
cd - >/dev/null
```

#### Paso F: Limpiar y mostrar resumen

```bash
rm -f .ai-internal/.upgrade-pending
```

Mostrar:

```
✅ Upgrade completado: V{from_version} → V{to_version}

Archivos regenerados:
  ✅ .claude/commands/opsx/ (10 comandos)
  ✅ ai-specs/.commands/ (9 comandos + 1 agente)
  ✅ .claude/commands/menu.md
  ✅ ai-specs/.commands/develop-{tipo}.md
  ✅ ai-specs/.commands/plan-{tipo}-ticket.md
  ✅ ai-specs/.commands/enrich-ticket.md
  ✅ .claude/commands/create-{tracker}-tickets.md
  ✅ .bootstrap-meta.json (V{to_version})
  {si MCP recompilado:} ✅ MCP server recompilado

Preservados:
  🔒 .ai-internal/project-profile.md
  🔒 CLAUDE.md
  {si hubo backups:} 📦 Backups en: {BACKUP_DIR}

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
  .ai-internal/phases/phase-0-detect.md
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
🔧 AI Workflow Bootstrap V4.2
==============================

Estado:
  {✅|⏳|⬜} Fase 0-2: Detección y perfil
  {✅|⏳|⬜} Fase 3-4: Archivos reusables (10 OPSX + 9 commands + 1 agent)
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

- Fase 0: `cat .ai-internal/phases/phase-0-detect.md`
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
- El Modo Upgrade es una excepción al guardrail de "una sola fase": ejecuta fases 1+2+metadata en una sola invocación porque reutiliza el profile existente
