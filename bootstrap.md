---
name: "Bootstrap: Setup AI Workflow"
description: Configura el sistema completo de flujos AI en este proyecto (V4.2)
category: Setup
tags: [bootstrap, setup, workflow]
---

# Bootstrap AI Workflow V4.2

Sos el orquestador del bootstrap. Tu trabajo es ejecutar las fases en orden, una a la vez, cargando el archivo correspondiente.

## Paso 0: Detectar estado actual

```bash
echo "=== BOOTSTRAP STATE ==="
test -f .ai-internal/project-profile.md && echo "PHASE_0=DONE" || echo "PHASE_0=PENDING"
test -d .claude/commands/opsx && ls .claude/commands/opsx/ | wc -l | xargs echo "PHASE_1_FILES=" || echo "PHASE_1=PENDING"
test -f CLAUDE.md && test -f ai-specs/AI-WORKFLOW-PLAYBOOK.md && echo "PHASE_2=DONE" || echo "PHASE_2=PENDING"
test -f .bootstrap-meta.json && echo "PHASE_3=DONE" || echo "PHASE_3=PENDING"
test -d .ai-internal/phases && ls .ai-internal/phases/ | wc -l | xargs echo "PHASE_FILES=" || echo "PHASES_NOT_INSTALLED"
```

## Paso 1: Verificar que las fases están instaladas

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

## Paso 2: Determinar qué fase ejecutar

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

## Paso 3: Ejecutar la fase

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
