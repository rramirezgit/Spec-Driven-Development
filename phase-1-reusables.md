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

## FASE 4: Copiar archivos reusables desde `.ai-internal/reusables/`

> **⚠️ Los archivos reusables se descargan con `install-bootstrap.sh` a `.ai-internal/reusables/`.**
> Esta fase SOLO los copia a sus destinos finales. NO genera contenido.
> En V3/V4 se generaban inline (1600+ líneas). Desde V4.5 son archivos descargables.

### 4.1 — Verificar que los reusables están descargados

```bash
echo "=== REUSABLES CHECK ==="
ls .ai-internal/reusables/opsx/*.md 2>/dev/null | wc -l | xargs echo "OPSX_FILES="
ls .ai-internal/reusables/commands/*.md 2>/dev/null | wc -l | xargs echo "COMMAND_FILES="
ls .ai-internal/reusables/agents/*.md 2>/dev/null | wc -l | xargs echo "AGENT_FILES="
```

Si `OPSX_FILES < 10` o `COMMAND_FILES < 9` o `AGENT_FILES < 1`:
```
❌ Archivos reusables incompletos en .ai-internal/reusables/
   Esperado: 10 OPSX + 9 commands + 1 agent = 20 archivos
   Encontrado: {OPSX_FILES} + {COMMAND_FILES} + {AGENT_FILES}

   Re-ejecutá install-bootstrap.sh para descargarlos.
```
DETENER.

### 4.2 — Copiar OPSX commands (10 archivos)

```bash
echo "Copiando OPSX commands..."
cp .ai-internal/reusables/opsx/*.md .claude/commands/opsx/
echo "  ✅ $(ls .claude/commands/opsx/*.md | wc -l | tr -d ' ') OPSX commands copiados"
```

Archivos resultantes:
- `.claude/commands/opsx/new.md`
- `.claude/commands/opsx/ff.md`
- `.claude/commands/opsx/continue.md`
- `.claude/commands/opsx/apply.md`
- `.claude/commands/opsx/verify.md`
- `.claude/commands/opsx/archive.md`
- `.claude/commands/opsx/explore.md`
- `.claude/commands/opsx/sync.md`
- `.claude/commands/opsx/bulk-archive.md`
- `.claude/commands/opsx/onboard.md`

### 4.3 — Copiar AI commands (9 archivos)

```bash
echo "Copiando AI commands..."
cp .ai-internal/reusables/commands/*.md ai-specs/.commands/
echo "  ✅ $(ls ai-specs/.commands/*.md | wc -l | tr -d ' ') AI commands copiados"
```

Archivos resultantes:
- `ai-specs/.commands/explain.md`
- `ai-specs/.commands/meta-prompt.md`
- `ai-specs/.commands/commit.md`
- `ai-specs/.commands/update-docs.md`
- `ai-specs/.commands/review-pr.md`
- `ai-specs/.commands/test-plan.md`
- `ai-specs/.commands/evidence.md`
- `ai-specs/.commands/generate-docs.md`
- `ai-specs/.commands/release-to-main.md`

### 4.4 — Copiar agente reusable (1 archivo)

```bash
echo "Copiando agente reusable..."
cp .ai-internal/reusables/agents/*.md ai-specs/.agents/
echo "  ✅ product-strategy-analyst.md copiado"
```

### 4.5 — Verificación post-copia

```bash
echo "=== VERIFICACIÓN FASE 4 ==="
OPSX_COUNT=$(ls .claude/commands/opsx/*.md 2>/dev/null | wc -l | tr -d ' ')
CMD_COUNT=$(ls ai-specs/.commands/*.md 2>/dev/null | wc -l | tr -d ' ')
AGENT_COUNT=$(ls ai-specs/.agents/*.md 2>/dev/null | wc -l | tr -d ' ')

echo "  OPSX commands: $OPSX_COUNT (esperado: 10)"
echo "  AI commands:   $CMD_COUNT (esperado: ≥9)"
echo "  Agents:        $AGENT_COUNT (esperado: ≥1)"

if [ "$OPSX_COUNT" -lt 10 ]; then
  echo "  ❌ Faltan OPSX commands"
elif [ "$CMD_COUNT" -lt 9 ]; then
  echo "  ❌ Faltan AI commands"
else
  echo "  ✅ Todos los reusables copiados correctamente"
fi
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
✅ Fase 3-4 completada. Archivos reusables copiados.
   Siguiente: ejecutá /bootstrap para Fase 5 (archivos adaptados)
```
